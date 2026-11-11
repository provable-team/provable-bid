import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { createHmac, randomUUID } from 'node:crypto';
import type { AgentAdapter, EvaluatorAdapter } from '../../../packages/agent-interface/src/index.js';
import type { components } from '../../../packages/api-client/src/schema.js';
import { operations, resolve, validator, validateResponse } from '../../../scripts/contract.js';
import { gateHtml, prepareHtml } from './html.js';
import {
  HOUSE_AGENTS, HOUSE_OPERATOR_ID, hashToken, newSecret, newToken, resolvePrincipal,
  type AgentPrincipal, type AgentRecord, type Credential, type Operator, type Principal,
} from './identity.js';
import { agentPayoutFor, commissionFor, POLICY, processingFeeFor } from './money.js';
import { ProviderError, type PaymentProvider } from './provider/types.js';
import { Store } from './store.js';

type S = components['schemas'];

export class Fault extends Error {
  constructor(public status: number, public code: S['Problem']['code'], message: string, public retryable = false) { super(message); }
}
function demand(ok: unknown, code: S['Problem']['code'] = 'INVALID_STATE', message = 'Command is not valid in the current state.', status = 409): asserts ok {
  if (!ok) throw new Fault(status, code, message);
}
function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value ?? null);
}
const id = (prefix: string) => `${prefix}_${randomUUID()}`;
const money = (amount_minor: number): S['Money'] => ({ currency: 'USD', amount_minor });
const digests = (s: S['Submission']): S['ArtifactDigest'][] => s.artifacts.map(a => ({ asset_id: a.asset_id, sha256: a.sha256 }));

/** One provider command in the financial operation journal. request_id is persisted BEFORE the provider call. */
export type Operation = {
  id: string;
  kind: 'create_order' | 'authorize' | 'capture_authorization' | 'capture_order' | 'void' | 'payout' | 'refund';
  payment_id: string | null; allocation_id: string | null; refund_id: string | null;
  request_id: string;
  state: 'queued' | 'running' | 'waiting' | 'unknown' | 'succeeded' | 'failed';
  attempts: number; next_at: number; last_error: string | null; created_at: string; updated_at: string;
};
type StoredAsset = { metadata: S['Asset']; original_base64: string; preview: string };

export interface ApiOptions {
  store: Store;
  provider: PaymentProvider;
  evaluator: EvaluatorAdapter;
  /** The web app (buyer frontend); PayPal returns buyers here, operators land here after login. */
  webOrigin: string;
  /** This API's public origin, used in preview/delivery URLs and the Log in with PayPal callback. */
  apiOrigin: string;
  corsOrigins?: string[];
  adminToken?: string | null;
  houseOperatorPayerId?: string | null;
  /** House agents (null when no model key is configured). They use the public API with their own credentials. */
  houseAgents?: Record<string, AgentAdapter> | null;
  now?: () => number;
  strictResponses?: boolean;
  /** Record payouts as simulated instead of calling the provider. Defaults to true with the fake provider. */
  simulatePayouts?: boolean;
  log?: (msg: string, extra?: unknown) => void;
  notify?: (url: string, body: string, signature: string) => Promise<void>;
}

export async function createApi(o: ApiOptions) {
  const log = o.log ?? ((m: string, x?: unknown) => console.log(`[api] ${m}`, x ?? ''));
  const app: FastifyInstance = Fastify({ logger: false, bodyLimit: 1_000_000, requestIdHeader: false, genReqId: () => id('req') });
  const origins = [o.webOrigin, ...(o.corsOrigins ?? []), 'http://localhost:3000', 'http://127.0.0.1:3000'];
  await app.register(cors, { origin: origins, exposedHeaders: ['X-Request-Id'], allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'] });

  const mockMode = o.provider.mode === 'mock';
  const simulatePayouts = o.simulatePayouts ?? mockMode;
  let offset = 0;
  const time = () => (o.now?.() ?? Date.now()) + offset;
  const stamp = () => new Date(time()).toISOString();
  const at = (ms: number) => new Date(ms).toISOString();
  const policy = POLICY;

  // ---------------------------------------------------------------- state
  const st = o.store;
  const competitions = st.collection<S['Competition']>('competition');
  const submissions = st.collection<S['Submission']>('submission');
  const submissionAccounting = st.collection<{ operator_id: string; recipient_id: string }>('submission_accounting');
  const assets = st.collection<StoredAsset>('asset');
  const payments = st.collection<S['Payment']>('payment');
  const purchases = st.collection<S['Purchase']>('purchase');
  const refunds = st.collection<S['Refund']>('refund');
  const allocations = st.collection<S['Allocation']>('allocation');
  const checkouts = st.collection<S['Checkout']>('checkout');
  const deliveries = st.collection<{ purchase: string; asset: string; buyer: string; expires: number }>('delivery');
  const replays = st.collection<{ fingerprint: string; status: number; body: unknown; cache?: string }>('replay');
  const webhookEvents = st.collection<{ event_type: string; received_at: string }>('webhook_event');
  const ops = st.collection<Operation>('operation');
  const credentials = st.collection<Credential>('credential');
  const operators = st.collection<Operator>('operator');
  const agents = st.collection<AgentRecord>('agent');
  const oauthStates = st.collection<{ expires: number }>('oauth_state');

  // House operator + house agents (labelled; payouts go to the house operator's verified PayPal account).
  const houseOperator: Operator = operators.get(HOUSE_OPERATOR_ID) ?? { id: HOUSE_OPERATOR_ID, name: 'provable.bid', email: null, paypal_payer_id: null, recipient_id: 'recipient_provable', house: true, created_at: stamp() };
  houseOperator.paypal_payer_id = o.houseOperatorPayerId ?? houseOperator.paypal_payer_id;
  operators.set(HOUSE_OPERATOR_ID, houseOperator);
  const houseTokens = new Map<string, string>();
  for (const h of HOUSE_AGENTS) {
    const existing = agents.get(h.id);
    for (const hash of existing?.credential_hashes ?? []) credentials.delete(hash); // fresh credentials each boot
    const token = newToken('pba');
    const principal: AgentPrincipal = { id: `cred_${h.id}`, role: 'agent', agent_id: h.id, operator_id: HOUSE_OPERATOR_ID, recipient_id: houseOperator.recipient_id };
    credentials.set(hashToken(token), { principal, created_at: stamp(), revoked: false });
    houseTokens.set(h.id, token);
    agents.set(h.id, {
      profile: { id: h.id, name: h.name, description: h.description, style: h.style, capabilities: ['html'], internal: true,
        status: o.houseAgents?.[h.id] ? 'available' : 'unavailable', avatar_color: h.avatar_color, operator_id: HOUSE_OPERATOR_ID, operator_name: 'provable.bid' },
      operator_id: HOUSE_OPERATOR_ID, webhook_url: null, webhook_secret: null, credential_hashes: [hashToken(token)], created_at: existing?.created_at ?? stamp(),
    });
  }
  // Anything left "running" when the process stopped has an unknown provider outcome: retry it with the same request ID.
  for (const op of ops.values()) if (op.state === 'running') { op.state = 'unknown'; op.next_at = 0; }
  st.flush();

  // ---------------------------------------------------------------- helpers
  const view = <T extends object>(value: T): T => structuredClone({ ...value, server_time: stamp() });
  const fetchOne = <T>(map: Map<string, T>, key: string): T => {
    const value = map.get(key);
    demand(value, 'NOT_FOUND', 'Resource not found.', 404);
    return value;
  };
  const owner = (c: S['Competition'], p: Principal) => demand(p.role === 'buyer' && c.buyer_id === p.id, 'NOT_FOUND', 'Resource not found.', 404);
  const admin = (p: Principal) => demand(p.role === 'admin', 'FORBIDDEN', 'Admin credential required.', 403);
  const readCompetition = (c: S['Competition'], p: Principal) => demand(c.opens_at || p.id === c.buyer_id || p.role === 'admin', 'NOT_FOUND', 'Resource not found.', 404);
  const readPayment = (pay: S['Payment'], who: Principal) => demand(pay.buyer_id === who.id || who.role === 'admin', 'NOT_FOUND', 'Resource not found.', 404);
  const compSubmissions = (c: S['Competition']) => [...submissions.values()].filter(s => s.competition_id === c.id);
  const update = (c: S['Competition']) => { c.version++; };
  function canReadSubmission(s: S['Submission'], p: Principal) {
    const c = fetchOne(competitions, s.competition_id);
    return p.role === 'admin' || (p.role === 'agent' && s.agent_id === p.agent_id) || (p.role === 'buyer' && c.buyer_id === p.id && s.qualification_status === 'qualified');
  }
  function requireOpen(c: S['Competition']) {
    demand(c.state === 'open' && time() < Date.parse(c.submission_deadline!), 'DEADLINE_PASSED', 'Submission window is not open.');
  }
  const entitled = (p: S['Payment']) => p.capture_state === 'completed' && p.refund_state === 'none' && p.refunded_minor === 0 && p.reversal_state === 'none' && p.reversed_minor === 0 && ['none', 'won'].includes(p.dispute_state);
  function purchaseView(p: S['Purchase']): S['Purchase'] {
    const pay = fetchOne(payments, p.payment_id);
    const status: S['Purchase']['status'] = pay.reversal_state === 'reversed' ? 'reversed'
      : ['open', 'lost'].includes(pay.dispute_state) ? 'disputed'
      : pay.refunded_minor > 0 ? 'refunded'
      : pay.capture_state === 'completed' ? 'payment_completed'
      : pay.capture_state === 'failed' ? 'payment_failed'
      : pay.capture_state === 'pending' ? 'payment_pending' : 'awaiting_approval';
    return view({ ...p, status, delivery_unlocked: entitled(pay), checkout: p.checkout ? (checkouts.get(p.payment_id) ?? p.checkout) : null });
  }
  function agentProfile(agentId: string) { return agents.get(agentId)?.profile; }

  // ---------------------------------------------------------------- operation journal
  function newOp(kind: Operation['kind'], refs: Partial<Pick<Operation, 'payment_id' | 'allocation_id' | 'refund_id'>>, requestId = randomUUID()): Operation {
    const op: Operation = { id: id('op'), kind, payment_id: refs.payment_id ?? null, allocation_id: refs.allocation_id ?? null, refund_id: refs.refund_id ?? null,
      request_id: requestId, state: 'queued', attempts: 0, next_at: 0, last_error: null, created_at: stamp(), updated_at: stamp() };
    ops.set(op.id, op);
    return op;
  }
  const backoff = (attempts: number) => time() + Math.min(60_000, 1000 * 2 ** Math.min(attempts, 6)) + Math.floor(Math.random() * 500);
  const providerFault = (e: unknown): Fault => {
    if (e instanceof Fault) return e;
    if (e instanceof ProviderError) {
      return e.kind === 'unknown'
        ? new Fault(503, 'PROVIDER_UNAVAILABLE', 'PayPal did not answer. Retry the same request; it will not be charged twice.', true)
        : new Fault(422, 'PAYMENT_NOT_READY', e.issue === 'ORDER_NOT_APPROVED' ? 'Approve the PayPal checkout first.' : `PayPal declined: ${e.issue ?? e.message}`);
    }
    throw e;
  };

  function makePayment(c: S['Competition'], purpose: S['Payment']['purpose']): S['Payment'] {
    const p: S['Payment'] = {
      id: id('pay'), competition_id: c.id, buyer_id: c.buyer_id, purpose, amount: { ...c.total },
      authorization_state: purpose === 'additional_purchase' ? 'not_applicable' : 'none',
      capture_state: 'none', operation_state: 'idle', operation_id: null,
      provider_order_id: null, provider_authorization_id: null, provider_capture_id: null,
      authorized_at: null, authorization_expires_at: null, captured_minor: 0, refunded_minor: 0,
      refund_state: 'none', dispute_state: 'none', reversal_state: 'none', reversed_minor: 0, provider_expense_minor: null, last_error_code: null,
      created_at: stamp(), updated_at: stamp(), server_time: stamp(),
    };
    payments.set(p.id, p);
    return p;
  }

  /** Create (or resume) the PayPal order for a payment. The request ID is flushed to disk before the call. */
  async function ensureOrder(c: S['Competition'], pay: S['Payment'], intent: 'AUTHORIZE' | 'CAPTURE'): Promise<S['Checkout']> {
    const existing = checkouts.get(pay.id);
    if (existing && time() < Date.parse(existing.expires_at)) return existing;
    if (existing && pay.provider_order_id) {
      // Expired checkout: only replace an order PayPal confirms was never approved/authorized/captured.
      const order = await o.provider.getOrder(pay.provider_order_id).catch(e => { throw providerFault(e); });
      demand(order.status === 'CREATED' || order.status === 'PAYER_ACTION_REQUIRED', 'PAYMENT_NOT_READY', 'The previous PayPal checkout was already approved. Continue with it instead.');
    }
    let op = [...ops.values()].find(x => x.kind === 'create_order' && x.payment_id === pay.id && ['queued', 'unknown', 'running'].includes(x.state));
    if (!op) op = newOp('create_order', { payment_id: pay.id });
    op.state = 'running'; op.attempts++; op.updated_at = stamp();
    pay.operation_id = op.id; pay.operation_state = 'running';
    st.flush(); // persist the PayPal-Request-Id before PayPal sees it
    const returnTo = `${o.webOrigin}/competitions/${c.id}`;
    const kind = pay.purpose === 'initial' ? 'authorize' : 'purchase';
    try {
      const r = await o.provider.createOrder({
        intent, amountMinor: pay.amount.amount_minor, referenceId: c.id, customId: pay.id, requestId: op.request_id,
        description: `provable.bid: ${c.title}`.slice(0, 127),
        returnUrl: `${returnTo}?paypal=return&kind=${kind}&payment_id=${pay.id}`, cancelUrl: `${returnTo}?paypal=cancel&kind=${kind}&payment_id=${pay.id}`,
      });
      op.state = 'succeeded'; op.updated_at = stamp(); op.last_error = null;
      pay.provider_order_id = r.orderId; pay.operation_state = 'succeeded'; pay.last_error_code = null; pay.updated_at = stamp();
      const checkout: S['Checkout'] = { payment_id: pay.id, provider_order_id: r.orderId, intent, approval_url: r.approvalUrl,
        expires_at: intent === 'AUTHORIZE' ? at(time() + 3 * 3600_000) : c.decision_deadline!, server_time: stamp() };
      checkouts.set(pay.id, checkout);
      return checkout;
    } catch (e) {
      const unknown = e instanceof ProviderError && e.kind === 'unknown';
      op.state = unknown ? 'unknown' : 'failed'; op.last_error = (e as Error).message; op.updated_at = stamp();
      pay.operation_state = unknown ? 'unknown' : 'failed'; pay.last_error_code = e instanceof ProviderError ? e.issue : 'INTERNAL'; pay.updated_at = stamp();
      throw providerFault(e);
    }
  }

  function queueOp(pay: S['Payment'], kind: Operation['kind']) {
    const op = newOp(kind, { payment_id: pay.id });
    pay.operation_id = op.id; pay.operation_state = 'queued'; pay.updated_at = stamp();
    return op;
  }
  function queueCapture(pay: S['Payment'], purpose: S['Payment']['purpose']) {
    demand(pay.capture_state === 'none');
    demand(pay.authorization_state === 'authorized' || pay.authorization_state === 'not_applicable', 'PAYMENT_NOT_READY', 'Authorization is not available.');
    pay.purpose = purpose; pay.capture_state = 'pending';
    queueOp(pay, pay.authorization_state === 'authorized' ? 'capture_authorization' : 'capture_order');
  }
  function voidAuthorization(pay: S['Payment']) {
    if (pay.capture_state !== 'none' || pay.authorization_state !== 'authorized') return;
    pay.authorization_state = 'void_pending';
    queueOp(pay, 'void');
  }

  // ---------------------------------------------------------------- settlement
  function captureAccounting(p: S['Payment']): S['CaptureAccounting'] {
    const c = fetchOne(competitions, p.competition_id);
    const price = c.bid.amount_minor;
    const processing = Math.max(0, p.captured_minor - price);
    const deducted = Math.min(p.provider_expense_minor ?? 0, processing);
    return { payment_id: p.id, currency: 'USD', gross_minor: p.captured_minor, commission_minor: commissionFor(price),
      provider_expense_minor: p.provider_expense_minor, deducted_expense_minor: deducted,
      platform_absorbed_expense_minor: p.provider_expense_minor === null ? null : Math.max(0, p.provider_expense_minor - processing),
      distributable_minor: p.captured_minor > 0 ? agentPayoutFor(price) : 0, expense_state: p.provider_expense_minor === null ? 'unknown' : 'confirmed' };
  }
  function allocate(p: S['Payment']) {
    if ([...allocations.values()].some(a => a.payment_id === p.id)) return;
    const purchase = [...purchases.values()].find(x => x.payment_id === p.id);
    if (!purchase) return;
    const submission = fetchOne(submissions, purchase.submission_id);
    const recipient = fetchOne(submissionAccounting, submission.id);
    const amount = captureAccounting(p).distributable_minor;
    const a: S['Allocation'] = {
      id: id('alloc'), competition_id: p.competition_id, payment_id: p.id, operator_id: recipient.operator_id, recipient_id: recipient.recipient_id,
      kind: 'winner', amount: money(amount), agent_shares: [{ agent_id: submission.agent_id, amount_minor: amount }],
      ledger_state: 'allocated', payout_state: simulatePayouts ? 'simulated' : 'queued', provider_payout_id: null, created_at: stamp(),
    };
    allocations.set(a.id, a);
    // A dispute/refund/reversal that arrived before the capture completed holds the payout from the start.
    if (!entitled(p)) { holdAllocations(p, p.reversal_state === 'reversed' || p.refunded_minor > 0); return; }
    if (!simulatePayouts) newOp('payout', { allocation_id: a.id, payment_id: p.id });
  }
  function holdAllocations(p: S['Payment'], reversed: boolean) {
    for (const a of allocations.values()) if (a.payment_id === p.id) {
      if (a.ledger_state !== 'reversed') a.ledger_state = reversed ? 'reversed' : 'held';
      if (a.payout_state !== 'paid' && a.payout_state !== 'pending') a.payout_state = 'blocked'; // already-sent payouts can't be recalled
    }
  }
  function completeCapture(p: S['Payment'], cap: { id: string; amountMinor: number; feeMinor: number | null }) {
    if (p.capture_state === 'completed') return;
    p.capture_state = 'completed'; p.operation_state = 'succeeded'; p.last_error_code = null;
    if (p.authorization_state !== 'not_applicable') p.authorization_state = 'captured';
    p.provider_capture_id = cap.id; p.captured_minor = cap.amountMinor; p.provider_expense_minor = cap.feeMinor ?? p.provider_expense_minor; p.updated_at = stamp();
    allocate(p);
  }
  function failCapture(p: S['Payment'], code: string) {
    p.capture_state = 'failed'; p.operation_state = 'failed'; p.last_error_code = code; p.updated_at = stamp();
  }
  function applyDispute(p: S['Payment'], state: S['Payment']['dispute_state']) {
    p.dispute_state = state; p.updated_at = stamp();
    if (state === 'won' && entitled(p)) {
      for (const a of allocations.values()) if (a.payment_id === p.id && a.ledger_state === 'held') { a.ledger_state = 'allocated'; if (a.payout_state === 'blocked') { a.payout_state = simulatePayouts ? 'simulated' : 'queued'; if (!simulatePayouts) newOp('payout', { allocation_id: a.id, payment_id: p.id }); } }
    } else if (state !== 'won') holdAllocations(p, false);
  }
  function applyRefunded(p: S['Payment'], amountMinor: number) {
    p.refunded_minor = Math.min(p.captured_minor, p.refunded_minor + amountMinor); p.refund_state = p.refunded_minor >= p.captured_minor ? 'refunded' : 'partially_refunded'; p.updated_at = stamp();
    for (const r of refunds.values()) if (r.payment_id === p.id && r.state !== 'completed') r.state = 'completed';
    holdAllocations(p, true);
  }

  // ---------------------------------------------------------------- deadlines
  function tick() {
    for (const c of competitions.values()) {
      if (!c.opens_at || ['closed', 'cancelled'].includes(c.state)) continue;
      const p = fetchOne(payments, c.initial_payment_id!);
      if (p.authorization_expires_at && time() >= Date.parse(p.authorization_expires_at) && p.authorization_state === 'authorized') p.authorization_state = 'expired';
      if (['expired', 'voided', 'failed'].includes(p.authorization_state) && !c.first_purchase_id) { c.state = 'cancelled'; c.outcome = 'cancelled'; update(c); continue; }
      if (time() >= Date.parse(c.submission_deadline!) && c.state === 'open') { c.state = 'qualifying'; update(c); }
      if (time() >= Date.parse(c.qualification_deadline!) && c.state === 'qualifying') {
        const all = compSubmissions(c);
        for (const s of all) if (s.qualification_status === 'pending') {
          s.qualification_status = 'error';
          s.qualification = { status: 'error', checks: [], reason: 'Qualification did not finish before the deadline.', evaluator_version: 'deadline-v1', failure_code: null, artifact_hashes: digests(s) };
        }
        if (c.first_purchase_id) { c.state = 'closed'; c.outcome = 'winner_selected'; }
        else if (!all.some(s => s.qualification_status === 'qualified')) {
          c.state = 'closed'; c.outcome = all.some(s => s.qualification_status === 'error') ? 'infrastructure_failure' : 'no_qualifiers'; voidAuthorization(p);
        } else c.state = 'deciding';
        update(c);
      }
      if (c.state === 'deciding' && time() >= Date.parse(c.decision_deadline!)) { c.state = 'closed'; c.outcome = 'no_decision'; voidAuthorization(p); update(c); }
    }
    for (const [token, d] of deliveries) if (time() > d.expires + 86_400_000) deliveries.delete(token);
    for (const [state, s] of oauthStates) if (time() > s.expires) oauthStates.delete(state);
  }

  // ---------------------------------------------------------------- assets & submissions
  function ingest(input: S['UploadAsset'], who: Principal): S['Asset'] {
    demand(who.role === 'agent', 'FORBIDDEN', 'Agent credential required.', 403);
    const c = fetchOne(competitions, input.competition_id); readCompetition(c, who); requireOpen(c);
    demand([...assets.values()].filter(a => a.metadata.competition_id === c.id && a.metadata.owner_agent_id === who.agent_id).length < 3, 'INVALID_STATE', 'At most three staged assets per agent and competition.');
    let prepared: ReturnType<typeof prepareHtml>;
    try { prepared = prepareHtml(input.content_base64); } catch (e) { throw new Fault(400, 'VALIDATION_ERROR', (e as Error).message); }
    const assetId = id('asset');
    const metadata: S['Asset'] = {
      id: assetId, competition_id: c.id, owner_agent_id: who.agent_id, type: 'html', mime_type: 'text/html',
      size_bytes: prepared.original.length, sha256: prepared.sha256, width: null, height: null,
      preview: { url: `${o.apiOrigin}/v1/assets/${assetId}/preview`, mime_type: 'text/html', width: null, height: null, text_excerpt: prepared.title },
      created_at: stamp(), server_time: stamp(),
    };
    assets.set(assetId, { metadata, original_base64: input.content_base64, preview: prepared.preview.toString('utf8') });
    return metadata;
  }
  function submit(c: S['Competition'], who: AgentPrincipal, title: string, refs: { asset_id: string }[]): S['Submission'] {
    requireOpen(c);
    demand(!compSubmissions(c).some(s => s.agent_id === who.agent_id), 'DUPLICATE_SUBMISSION', 'One immutable submission per registered agent.');
    const originals = refs.map(r => fetchOne(assets, r.asset_id));
    demand(originals.every(a => a.metadata.owner_agent_id === who.agent_id && a.metadata.competition_id === c.id), 'NOT_FOUND', 'Resource not found.', 404);
    const artifacts: S['Artifact'][] = originals.map(({ metadata: a }) => ({ asset_id: a.id, type: a.type, mime_type: a.mime_type, size_bytes: a.size_bytes, sha256: a.sha256, width: null, height: null, preview: a.preview }));
    const s: S['Submission'] = { id: id('sub'), competition_id: c.id, agent_id: who.agent_id, operator_id: who.operator_id,
      title, artifacts, qualification_status: 'pending', qualification: null, created_at: stamp(), server_time: stamp() };
    submissions.set(s.id, s);
    submissionAccounting.set(s.id, { operator_id: who.operator_id, recipient_id: who.recipient_id });
    return s;
  }

  // ---------------------------------------------------------------- serialized commands
  let tail = Promise.resolve();
  async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>(r => { release = r; });
    await previous;
    try { return await fn(); } finally { st.flush(); release(); }
  }

  function page(items: any[], query: any, decorate = true) {
    items.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id));
    const limit = query.limit ?? 20;
    const start = query.cursor ? items.findIndex(i => Buffer.from(i.id).toString('base64url') === query.cursor) + 1 : 0;
    demand(!query.cursor || start > 0, 'VALIDATION_ERROR', 'Invalid cursor.', 400);
    const slice = items.slice(start, start + limit).map(item => decorate ? view(item) : structuredClone(item));
    return { items: slice, next_cursor: start + limit < items.length ? Buffer.from(slice.at(-1).id).toString('base64url') : null, server_time: stamp() };
  }

  type Result = { status: number; body?: any; cache?: string; type?: string; location?: string; after?: () => void };
  async function execute(op: string, p: Principal | undefined, params: any, body: any, query: any, headers: any): Promise<Result> {
    const ok = (body: any, status = 200): Result => ({ status, body });
    const who = () => { demand(p, 'UNAUTHENTICATED', 'Valid bearer credential required.', 401); return p; };
    switch (op) {
      case 'getHealth': return ok({ status: 'ok', mode: o.provider.mode, server_time: stamp() });
      case 'getConfig': return ok({
        mode: o.provider.mode, currency: 'USD', terms_version: policy.terms_version, policy,
        capabilities: { authorization: true, additional_checkout: true, external_agents: true, payouts: simulatePayouts ? 'simulated' : 'paypal_sandbox',
          ai_evaluation: o.evaluator.version.startsWith('claude'), house_agents: !!o.houseAgents && Object.keys(o.houseAgents).length > 0, operator_onboarding: 'paypal_login' },
        server_time: stamp(),
      });

      // ---------------- identity
      case 'createBuyerSession': {
        const token = newToken('pbb'); const buyerId = id('buyer');
        credentials.set(hashToken(token), { principal: { id: buyerId, role: 'buyer' }, created_at: stamp(), revoked: false });
        return { status: 201, body: { buyer_id: buyerId, token, server_time: stamp() }, cache: 'no-store' };
      }
      case 'connectOperator': {
        const state = randomUUID(); oauthStates.set(state, { expires: time() + 600_000 });
        return { status: 302, location: o.provider.identityAuthorizeUrl(`${o.apiOrigin}/v1/operators/connect/callback`, state) };
      }
      case 'operatorConnectCallback': {
        const back = (fragment: Record<string, string>) => ({ status: 302, location: `${o.webOrigin}/operators#${new URLSearchParams(fragment)}` });
        const state = String(query.state ?? '');
        if (!state || !oauthStates.has(state)) return back({ error: 'That login link expired. Please connect again.' });
        oauthStates.delete(state);
        if (query.error || !query.code) return back({ error: 'PayPal login was cancelled.' });
        let identity;
        try { identity = await o.provider.identityFromCode(String(query.code), `${o.apiOrigin}/v1/operators/connect/callback`); }
        catch (e) { log('operator login failed', (e as Error).message); return back({ error: 'PayPal login failed. Please try again.' }); }
        let op = [...operators.values()].find(x => x.paypal_payer_id === identity.payerId && !x.house);
        if (!op) { op = { id: id('operator'), name: identity.name, email: identity.email, paypal_payer_id: identity.payerId, recipient_id: id('recipient'), house: false, created_at: stamp() }; }
        op.name = identity.name; op.email = identity.email; operators.set(op.id, op);
        const token = newToken('pbo');
        credentials.set(hashToken(token), { principal: { id: op.id, role: 'operator', operator_id: op.id }, created_at: stamp(), revoked: false });
        return back({ operator_token: token });
      }
      case 'getOperator': {
        const me = who(); demand(me.role === 'operator', 'OPERATOR_REQUIRED', 'Connect PayPal as an agent operator first.', 403);
        const op = fetchOne(operators, me.operator_id);
        const mine = [...agents.values()].filter(a => a.operator_id === op.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
        return ok({ id: op.id, name: op.name, paypal_account_verified: !!op.paypal_payer_id, server_time: stamp(), agents: mine.map(a => {
          const subs = [...submissions.values()].filter(s => s.agent_id === a.profile.id);
          const won = [...purchases.values()].filter(x => subs.some(s => s.id === x.submission_id));
          const paid = [...allocations.values()].filter(x => x.agent_shares.some(s => s.agent_id === a.profile.id) && ['paid', 'simulated'].includes(x.payout_state)).reduce((sum, x) => sum + x.amount.amount_minor, 0);
          return { agent: a.profile, webhook_url: a.webhook_url, submissions: subs.length, wins: won.length, paid_minor: paid };
        }) });
      }
      case 'registerAgent': {
        const me = who(); demand(me.role === 'operator', 'OPERATOR_REQUIRED', 'Connect PayPal as an agent operator first.', 403);
        demand(!body.webhook_url || /^https:\/\//.test(body.webhook_url) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(body.webhook_url), 'VALIDATION_ERROR', 'webhook_url must be https.', 400);
        demand([...agents.values()].filter(a => a.operator_id === me.operator_id).length < 10, 'INVALID_STATE', 'At most 10 agents per operator.');
        const op = fetchOne(operators, me.operator_id);
        const agentId = id('agent');
        const record: AgentRecord = {
          profile: { id: agentId, name: body.name, description: body.description, style: body.style, capabilities: ['html'], internal: false, status: 'available',
            avatar_color: body.avatar_color ?? '#3f6ad8', operator_id: op.id, operator_name: op.name },
          operator_id: op.id, webhook_url: body.webhook_url ?? null, webhook_secret: null, credential_hashes: [], created_at: stamp(),
        };
        agents.set(agentId, record);
        return { status: 201, body: issueAgentCredential(record, op), cache: 'no-store' };
      }
      case 'rotateAgentCredential': {
        const me = who(); demand(me.role === 'operator', 'OPERATOR_REQUIRED', 'Connect PayPal as an agent operator first.', 403);
        const record = fetchOne(agents, params.agent_id); demand(record.operator_id === me.operator_id, 'NOT_FOUND', 'Resource not found.', 404);
        return { status: 201, body: issueAgentCredential(record, fetchOne(operators, me.operator_id)), cache: 'no-store' };
      }
      case 'getAgentSelf': {
        const me = who(); demand(me.role === 'agent', 'FORBIDDEN', 'Agent credential required.', 403);
        return ok(fetchOne(agents, me.agent_id).profile);
      }
      case 'listAgents': return ok(page([...agents.values()].map(a => structuredClone(a.profile)), query, false)); // agent-ID order (no created_at)
      case 'getAgent': { const a = agentProfile(params.agent_id); demand(a, 'NOT_FOUND', 'Agent not found.', 404); return ok(a); }

      // ---------------- assets / submissions
      case 'uploadAsset': return ok(view(ingest(body, who())), 201);
      case 'getAsset': {
        const me = who(); const asset = fetchOne(assets, params.asset_id);
        demand((me.role === 'agent' && asset.metadata.owner_agent_id === me.agent_id) || me.role === 'admin', 'NOT_FOUND', 'Resource not found.', 404);
        return ok(view(asset.metadata));
      }
      case 'getAssetPreview': {
        const me = who(); const asset = fetchOne(assets, params.asset_id);
        const bound = [...submissions.values()].find(s => s.artifacts.some(a => a.asset_id === asset.metadata.id));
        demand(me.role === 'admin' || (me.role === 'agent' && asset.metadata.owner_agent_id === me.agent_id) || (bound && canReadSubmission(bound, me)), 'NOT_FOUND', 'Resource not found.', 404);
        return { status: 200, body: asset.preview, type: 'text/html', cache: 'no-store' };
      }
      case 'submitWork': {
        const me = who(); demand(me.role === 'agent', 'FORBIDDEN', 'Agent credential required.', 403);
        const c = fetchOne(competitions, params.competition_id); readCompetition(c, me);
        return ok(view(submit(c, me, body.title, body.artifacts)), 201);
      }
      case 'listSubmissions': {
        const me = who(); const c = fetchOne(competitions, params.competition_id);
        demand(me.id === c.buyer_id || me.role === 'agent' || me.role === 'admin', 'NOT_FOUND', 'Resource not found.', 404);
        return ok(page(compSubmissions(c).filter(s => canReadSubmission(s, me)), query));
      }
      case 'getSubmission': {
        const me = who(); const s = fetchOne(submissions, params.submission_id);
        demand(canReadSubmission(s, me), 'NOT_FOUND', 'Resource not found.', 404); return ok(view(s));
      }

      // ---------------- competitions
      case 'createCompetition': {
        const me = who(); demand(me.role === 'buyer', 'FORBIDDEN', 'Buyer credential required.', 403);
        demand(body.accepted_terms_version === policy.terms_version, 'TERMS_MISMATCH', 'Read and accept the current terms.', 422);
        demand(new Set(body.requirements.map((r: any) => r.id)).size === body.requirements.length, 'VALIDATION_ERROR', 'Requirement IDs must be unique.', 400);
        const fee = processingFeeFor(body.bid.amount_minor);
        const c: S['Competition'] = {
          id: id('cmp'), buyer_id: me.id, title: body.title, brief: body.brief, bid: body.bid, requirements: body.requirements,
          processing_fee: money(fee), total: money(body.bid.amount_minor + fee),
          submission_window_seconds: body.submission_window_seconds, decision_window_seconds: body.decision_window_seconds,
          policy: { ...policy }, state: 'draft', outcome: 'undecided', initial_payment_id: null, first_purchase_id: null,
          created_at: stamp(), opens_at: null, submission_deadline: null, qualification_deadline: null, decision_deadline: null, version: 1, server_time: stamp(),
        };
        competitions.set(c.id, c); return ok(view(c), 201);
      }
      case 'listCompetitions': { const me = who(); return ok(page([...competitions.values()].filter(c => c.opens_at || c.buyer_id === me.id || me.role === 'admin'), query)); }
      case 'getCompetition': { const c = fetchOne(competitions, params.competition_id); readCompetition(c, who()); return ok(view(c)); }
      case 'createInitialCheckout': {
        const c = fetchOne(competitions, params.competition_id); owner(c, who());
        demand(['draft', 'awaiting_authorization'].includes(c.state));
        if (!c.initial_payment_id) { c.initial_payment_id = makePayment(c, 'initial').id; c.state = 'awaiting_authorization'; update(c); }
        const checkout = await ensureOrder(c, fetchOne(payments, c.initial_payment_id), 'AUTHORIZE');
        return ok(view(checkout), 201);
      }
      case 'authorizeCompetition': {
        const c = fetchOne(competitions, params.competition_id); owner(c, who());
        const pay = fetchOne(payments, c.initial_payment_id ?? 'missing');
        if (c.opens_at) return ok(view(pay), 202);
        demand(c.state === 'awaiting_authorization');
        demand(pay.provider_order_id, 'PAYMENT_NOT_READY', 'Start the PayPal checkout first.');
        let order;
        try { order = await o.provider.getOrder(pay.provider_order_id); } catch (e) { throw providerFault(e); }
        let authorization = order.authorization;
        if (!authorization) {
          demand(order.status === 'APPROVED', 'PAYMENT_NOT_READY', 'Approve the PayPal checkout first.');
          // The processing fee covers US PayPal pricing; cross-border adds 1.5%. Refuse before any money is held.
          demand(!order.payerCountry || order.payerCountry === 'US', 'PAYMENT_NOT_READY', 'Only US PayPal accounts can fund briefs for now. Nothing was charged.', 422);
          let op = [...ops.values()].find(x => x.kind === 'authorize' && x.payment_id === pay.id && x.state !== 'failed');
          if (!op) op = newOp('authorize', { payment_id: pay.id });
          op.state = 'running'; op.attempts++; pay.operation_id = op.id; pay.operation_state = 'running'; pay.authorization_state = 'pending';
          st.flush();
          try { authorization = await o.provider.authorizeOrder(pay.provider_order_id, op.request_id); }
          catch (e) {
            if (e instanceof ProviderError && e.issue === 'ORDER_ALREADY_AUTHORIZED') authorization = (await o.provider.getOrder(pay.provider_order_id)).authorization;
            else {
              const unknown = e instanceof ProviderError && e.kind === 'unknown';
              op.state = unknown ? 'unknown' : 'failed'; op.last_error = (e as Error).message;
              pay.operation_state = unknown ? 'unknown' : 'failed'; pay.authorization_state = unknown ? 'pending' : 'failed'; pay.last_error_code = e instanceof ProviderError ? e.issue : 'INTERNAL';
              throw providerFault(e);
            }
          }
          op.state = 'succeeded'; op.updated_at = stamp();
        }
        demand(authorization && ['CREATED', 'PENDING'].includes(authorization.status), 'PAYMENT_NOT_READY', `PayPal authorization is ${authorization?.status ?? 'missing'}.`);
        const created = Date.parse(authorization.createTime);
        const schedule = (c.submission_window_seconds + policy.qualification_grace_seconds + c.decision_window_seconds) * 1000;
        demand(time() + schedule + 900_000 < created + 3 * 86_400_000, 'PAYMENT_NOT_READY', 'The PayPal authorization is too old to cover the decision window.');
        pay.authorization_state = 'authorized'; pay.provider_authorization_id = authorization.id; pay.authorized_at = at(created);
        pay.authorization_expires_at = authorization.expirationTime ?? at(created + 29 * 86_400_000); pay.operation_state = 'succeeded'; pay.last_error_code = null; pay.updated_at = stamp();
        c.opens_at = stamp(); c.submission_deadline = at(time() + c.submission_window_seconds * 1000);
        c.qualification_deadline = at(Date.parse(c.submission_deadline) + policy.qualification_grace_seconds * 1000);
        c.decision_deadline = at(Date.parse(c.qualification_deadline) + c.decision_window_seconds * 1000);
        c.state = 'open'; update(c);
        const opened = structuredClone(c);
        return { status: 202, body: view(pay), after: () => announce(opened) };
      }
      case 'selectFirstWinner': {
        const c = fetchOne(competitions, params.competition_id); owner(c, who());
        if (c.first_purchase_id) {
          const existing = fetchOne(purchases, c.first_purchase_id);
          demand(existing.submission_id === body.submission_id, 'DECISION_LOCKED', 'First winner already committed.');
          return ok(purchaseView(existing), 202);
        }
        demand(['open', 'qualifying', 'deciding'].includes(c.state) && time() < Date.parse(c.decision_deadline!), 'DEADLINE_PASSED', 'Decision window is closed.');
        const s = fetchOne(submissions, body.submission_id); demand(s.competition_id === c.id && s.qualification_status === 'qualified', 'INVALID_STATE', 'Only qualified work can be selected.');
        const pay = fetchOne(payments, c.initial_payment_id!); queueCapture(pay, 'first_purchase');
        const purchase: S['Purchase'] = { id: id('pur'), competition_id: c.id, submission_id: s.id, kind: 'first', price: { ...c.bid }, payment_id: pay.id,
          status: 'payment_pending', delivery_unlocked: false, checkout: null, created_at: stamp(), server_time: stamp() };
        purchases.set(purchase.id, purchase); c.first_purchase_id = purchase.id; c.outcome = 'winner_selected';
        if (c.state === 'deciding') c.state = 'closed';
        update(c); return { status: 202, body: purchaseView(purchase), after: kick };
      }
      case 'rejectAll': {
        const c = fetchOne(competitions, params.competition_id); owner(c, who());
        demand(!c.first_purchase_id, 'DECISION_LOCKED', 'First winner already committed.');
        const pay = fetchOne(payments, c.initial_payment_id!);
        if (c.outcome === 'rejected') return ok(view(pay), 202);
        demand(['open', 'qualifying', 'deciding'].includes(c.state) && time() < Date.parse(c.decision_deadline!), 'INVALID_STATE', 'This brief is already decided.');
        voidAuthorization(pay); c.state = 'closed'; c.outcome = 'rejected'; update(c);
        return { status: 202, body: view(pay), after: kick };
      }
      case 'createAdditionalPurchase': {
        const c = fetchOne(competitions, params.competition_id); owner(c, who());
        demand(c.first_purchase_id, 'PAYMENT_NOT_READY', 'Select and pay for the first winner.');
        const first = fetchOne(purchases, c.first_purchase_id);
        demand(entitled(fetchOne(payments, first.payment_id)), 'PAYMENT_NOT_READY', 'The first payment must complete first.');
        demand(time() < Date.parse(c.decision_deadline!), 'DEADLINE_PASSED', 'Purchase window is closed.');
        const s = fetchOne(submissions, body.submission_id); demand(s.competition_id === c.id && s.qualification_status === 'qualified', 'INVALID_STATE', 'Only qualified work can be bought.');
        demand(s.id !== first.submission_id, 'INVALID_STATE', 'That entry is already yours.');
        let purchase = [...purchases.values()].find(x => x.competition_id === c.id && x.submission_id === s.id);
        if (!purchase) {
          const pay = makePayment(c, 'additional_purchase');
          purchase = { id: id('pur'), competition_id: c.id, submission_id: s.id, kind: 'additional', price: { ...c.bid }, payment_id: pay.id,
            status: 'awaiting_approval', delivery_unlocked: false, checkout: null, created_at: stamp(), server_time: stamp() };
          purchases.set(purchase.id, purchase);
        }
        const pay = fetchOne(payments, purchase.payment_id);
        if (pay.capture_state === 'none') purchase.checkout = await ensureOrder(c, pay, 'CAPTURE');
        return ok(purchaseView(purchase), 201);
      }
      case 'listPurchases': {
        const c = fetchOne(competitions, params.competition_id); owner(c, who());
        return ok(page([...purchases.values()].filter(x => x.competition_id === c.id).map(purchaseView), query));
      }
      case 'getPurchase': { const purchase = fetchOne(purchases, params.purchase_id); readPayment(fetchOne(payments, purchase.payment_id), who()); return ok(purchaseView(purchase)); }
      case 'captureAdditionalPurchase': {
        const purchase = fetchOne(purchases, params.purchase_id); const c = fetchOne(competitions, purchase.competition_id); owner(c, who());
        demand(purchase.kind === 'additional'); const pay = fetchOne(payments, purchase.payment_id);
        if (pay.capture_state !== 'none') return ok(purchaseView(purchase), 202);
        demand(time() < Date.parse(c.decision_deadline!), 'DEADLINE_PASSED', 'Purchase window is closed.');
        demand(pay.provider_order_id, 'PAYMENT_NOT_READY', 'Start the PayPal checkout first.');
        const order = await o.provider.getOrder(pay.provider_order_id).catch(e => { throw providerFault(e); });
        demand(order.status === 'APPROVED' || order.status === 'COMPLETED', 'PAYMENT_NOT_READY', 'Approve the PayPal checkout first.');
        demand(!order.payerCountry || order.payerCountry === 'US', 'PAYMENT_NOT_READY', 'Only US PayPal accounts can pay for now. Nothing was charged.', 422);
        queueCapture(pay, 'additional_purchase'); return { status: 202, body: purchaseView(purchase), after: kick };
      }
      case 'getPayment': { const pay = fetchOne(payments, params.payment_id); readPayment(pay, who()); return ok(view(pay)); }
      case 'reconcilePayment': {
        admin(who()); const pay = fetchOne(payments, params.payment_id);
        for (const x of ops.values()) if (x.payment_id === pay.id && ['unknown', 'waiting', 'queued'].includes(x.state)) x.next_at = 0;
        return { status: 202, body: view(pay), after: kick };
      }
      case 'createDeliveryAccess': {
        const me = who(); const purchase = fetchOne(purchases, params.purchase_id); const pay = fetchOne(payments, purchase.payment_id);
        owner(fetchOne(competitions, purchase.competition_id), me); demand(entitled(pay), 'DELIVERY_LOCKED', 'Payment not complete, or the funds are held or reversed.');
        const artifacts = fetchOne(submissions, purchase.submission_id).artifacts.map(a => {
          const token = id('dl'); deliveries.set(token, { purchase: purchase.id, asset: a.asset_id, buyer: me.id, expires: time() + 60_000 });
          return { asset_id: a.asset_id, url: `${o.apiOrigin}/v1/deliveries/${token}`, mime_type: a.mime_type, size_bytes: a.size_bytes };
        });
        return { status: 201, body: { artifacts, expires_at: at(time() + 60_000), server_time: stamp() }, cache: 'no-store' };
      }
      case 'downloadDelivery': {
        const me = who(); const d = fetchOne(deliveries, params.token); demand(d.buyer === me.id, 'NOT_FOUND', 'Resource not found.', 404);
        const purchase = fetchOne(purchases, d.purchase);
        demand(time() < d.expires && entitled(fetchOne(payments, purchase.payment_id)), 'DELIVERY_LOCKED', 'Delivery access is expired or revoked.');
        return { status: 200, body: Buffer.from(fetchOne(assets, d.asset).original_base64, 'base64').toString('utf8'), type: 'text/html', cache: 'no-store' };
      }
      case 'createRefund': {
        admin(who()); const pay = fetchOne(payments, params.payment_id);
        demand(pay.capture_state === 'completed' && pay.captured_minor > pay.refunded_minor && pay.reversal_state === 'none' && pay.refund_state !== 'pending');
        const r: S['Refund'] = { id: id('ref'), payment_id: pay.id, amount: money(pay.captured_minor - pay.refunded_minor), reason: body.reason,
          state: 'queued', provider_refund_id: null, created_at: stamp(), server_time: stamp() };
        refunds.set(r.id, r); pay.refund_state = 'pending'; pay.updated_at = stamp(); holdAllocations(pay, false);
        newOp('refund', { payment_id: pay.id, refund_id: r.id });
        return { status: 202, body: view(r), after: kick };
      }
      case 'getRefund': { const r = fetchOne(refunds, params.refund_id); readPayment(fetchOne(payments, r.payment_id), who()); return ok(view(r)); }
      case 'getSettlement': {
        const me = who(); const c = fetchOne(competitions, params.competition_id);
        demand(c.buyer_id === me.id || me.role === 'admin', 'NOT_FOUND', 'Resource not found.', 404);
        return ok({ competition_id: c.id, payout_mode: simulatePayouts ? 'simulated' : 'paypal_sandbox', allocations: [...allocations.values()].filter(a => a.competition_id === c.id),
          accounting: [...payments.values()].filter(x => x.competition_id === c.id && x.capture_state === 'completed').map(captureAccounting), server_time: stamp() });
      }
      case 'getAgentEarnings': {
        const me = who(); demand(me.role === 'agent', 'FORBIDDEN', 'Agent credential required.', 403);
        const result = page([...allocations.values()].filter(a => a.agent_shares.some(s => s.agent_id === me.agent_id)), query);
        result.items = result.items.map(({ server_time: _t, ...a }: any) => a); return ok(result);
      }
      case 'receivePayPalWebhook': {
        const genuine = await o.provider.verifyWebhook(headers, body).catch(() => false);
        demand(genuine, 'INVALID_WEBHOOK', 'Webhook signature could not be verified with PayPal.', 400);
        if (!webhookEvents.has(body.id)) {
          webhookEvents.set(body.id, { event_type: body.event_type, received_at: stamp() });
          return { status: 200, body: { accepted: true, event_id: body.id }, after: () => track(reconcileFromEvent(body).catch(e => log('webhook reconcile failed', (e as Error).message))) };
        }
        return ok({ accepted: true, event_id: body.id });
      }

      // ---------------- fake-provider development controls
      case 'advanceMockClock': demand(mockMode, 'NOT_FOUND', 'Not found.', 404); admin(who()); offset += body.seconds * 1000; tick(); return ok({ status: 'ok', mode: 'mock', server_time: stamp() });
      case 'observeMockPayment': {
        demand(mockMode, 'NOT_FOUND', 'Not found.', 404); admin(who());
        const pay = fetchOne(payments, params.payment_id); const ob = body.observation as string;
        if (ob === 'disputed') applyDispute(pay, 'open');
        else if (ob === 'dispute_won') applyDispute(pay, 'won');
        else if (ob === 'dispute_lost') applyDispute(pay, 'lost');
        else if (ob === 'refunded') applyRefunded(pay, pay.captured_minor);
        else if (ob === 'reversed') { pay.reversal_state = 'reversed'; pay.reversed_minor = pay.captured_minor; holdAllocations(pay, true); }
        else if (ob === 'reversal_pending') { pay.reversal_state = 'pending'; holdAllocations(pay, false); }
        else if (ob === 'expired' || ob === 'voided') { demand(pay.capture_state === 'none'); pay.authorization_state = ob; }
        else if (ob === 'failed') failCapture(pay, 'FAKE_DECLINED');
        else if (ob === 'completed') completeCapture(pay, { id: pay.provider_capture_id ?? id('FAKECAP'), amountMinor: pay.amount.amount_minor, feeMinor: body.provider_expense_minor ?? null });
        else pay.operation_state = ob === 'unknown' ? 'unknown' : 'running';
        pay.updated_at = stamp(); tick(); return ok(view(pay));
      }
      default: throw new Error(`No handler for ${op}`);
    }
  }

  function issueAgentCredential(record: AgentRecord, op: Operator): S['AgentCredential'] {
    for (const h of record.credential_hashes) { const c = credentials.get(h); if (c) c.revoked = true; }
    const token = newToken('pba');
    const hash = hashToken(token);
    credentials.set(hash, { principal: { id: id('cred'), role: 'agent', agent_id: record.profile.id, operator_id: op.id, recipient_id: op.recipient_id }, created_at: stamp(), revoked: false });
    record.credential_hashes = [hash];
    record.webhook_secret = record.webhook_url ? newSecret() : null;
    return { agent: record.profile, token, webhook_secret: record.webhook_secret, server_time: stamp() };
  }

  // ---------------------------------------------------------------- notifications & house agents (after commit, outside the lock)
  const pending = new Set<Promise<unknown>>();
  const track = (pr: Promise<unknown>) => { pending.add(pr); pr.finally(() => pending.delete(pr)); };
  function announce(c: S['Competition']) {
    const notification: S['AgentNotification'] = { id: id('evt'), type: 'competition.opened', competition: c, sent_at: stamp() };
    const raw = JSON.stringify(notification);
    for (const a of agents.values()) {
      if (a.profile.internal || !a.webhook_url || !a.webhook_secret) continue;
      const signature = createHmac('sha256', a.webhook_secret).update(raw).digest('hex');
      const send = o.notify ?? (async (url: string, b: string, sig: string) => {
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Provable-Signature': sig }, body: b, signal: AbortSignal.timeout(10_000) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      });
      track((async () => {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try { await send(a.webhook_url!, raw, signature); return; } catch (e) { if (attempt === 3) log(`notify ${a.profile.id} failed`, (e as Error).message); else await new Promise(r => setTimeout(r, 1000 * attempt)); }
        }
      })());
    }
    if (o.houseAgents) for (const [agentId, adapter] of Object.entries(o.houseAgents)) track(runHouseAgent(agentId, adapter, c));
  }

  /** House agents act through the public API with their own credentials, exactly like an outside agent. */
  async function runHouseAgent(agentId: string, adapter: AgentAdapter, c: S['Competition']) {
    const token = houseTokens.get(agentId)!;
    const call = async (method: 'POST', url: string, payload: unknown, key: string) => {
      const r = await app.inject({ method, url, payload: payload as any, headers: { authorization: `Bearer ${token}`, 'idempotency-key': key } });
      if (r.statusCode >= 300) throw new Error(`${url} → ${r.statusCode} ${r.body.slice(0, 200)}`);
      return r.json();
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, Date.parse(c.submission_deadline!) - time() - 5000));
    try {
      await adapter.run({
        competition: c, signal: controller.signal,
        uploadAsset: (asset, key) => call('POST', '/v1/assets', asset, key),
        submit: (work, key) => call('POST', `/v1/competitions/${c.id}/submissions`, work, key),
      });
    } catch (e) { log(`house agent ${agentId} on ${c.id} failed`, (e as Error).message); }
    finally { clearTimeout(timer); }
  }

  // ---------------------------------------------------------------- worker: evaluation + provider operations
  const evaluating = new Set<string>();
  async function evaluatePending() {
    const due = [...submissions.values()].filter(s => s.qualification_status === 'pending' && !evaluating.has(s.id));
    for (const s of due) {
      evaluating.add(s.id);
      track((async () => {
        const c = competitions.get(s.competition_id)!;
        const files = s.artifacts.map(a => ({ metadata: a, bytes: new Uint8Array(Buffer.from(assets.get(a.asset_id)!.original_base64, 'base64')) }));
        let result: S['QualificationResult'];
        const gate = gateHtml(Buffer.from(files[0].bytes).toString('utf8'));
        if (gate) result = { status: 'failed', failure_code: gate.code, checks: [], reason: gate.reason, evaluator_version: 'gates-v1', artifact_hashes: digests(s) };
        else {
          try {
            const r = await o.evaluator.qualify({ title: c.title, brief: c.brief, requirements: c.requirements, artifacts: files, signal: AbortSignal.timeout(90_000) });
            result = { ...r, artifact_hashes: digests(s) }; // bind to the server-computed digests, never evaluator claims
          } catch (e) {
            log(`evaluator failed on ${s.id}`, (e as Error).message);
            result = { status: 'error', failure_code: null, checks: [], reason: 'The evaluator could not finish.', evaluator_version: o.evaluator.version, artifact_hashes: digests(s) };
          }
        }
        await exclusive(async () => {
          const current = submissions.get(s.id);
          if (current?.qualification_status === 'pending' && time() < Date.parse(c.qualification_deadline!)) { current.qualification_status = result.status; current.qualification = result; }
        });
      })().finally(() => evaluating.delete(s.id)));
    }
  }

  async function runOperation(op: Operation) {
    // Journal first: mark running (with the persisted request ID) before talking to PayPal.
    await exclusive(async () => { op.state = 'running'; op.attempts++; op.updated_at = stamp(); });
    const pay = op.payment_id ? payments.get(op.payment_id) ?? null : null;
    try {
      if (op.kind === 'capture_authorization' || op.kind === 'capture_order') {
        const cap = op.kind === 'capture_authorization'
          ? await o.provider.captureAuthorization(pay!.provider_authorization_id!, pay!.amount.amount_minor, op.request_id)
          : await o.provider.captureOrder(pay!.provider_order_id!, op.request_id);
        await exclusive(async () => {
          if (cap.status === 'COMPLETED') { completeCapture(pay!, cap); op.state = 'succeeded'; }
          else if (cap.status === 'PENDING') { pay!.provider_capture_id = cap.id; pay!.operation_state = 'running'; op.state = 'waiting'; op.next_at = time() + 5000; }
          else { failCapture(pay!, `CAPTURE_${cap.status}`); op.state = 'failed'; }
        });
      } else if (op.kind === 'void') {
        const a = await o.provider.voidAuthorization(pay!.provider_authorization_id!, op.request_id);
        await exclusive(async () => { pay!.authorization_state = a.status === 'VOIDED' ? 'voided' : pay!.authorization_state; pay!.operation_state = 'succeeded'; pay!.updated_at = stamp(); op.state = 'succeeded'; });
      } else if (op.kind === 'refund') {
        const r = await o.provider.refundCapture(pay!.provider_capture_id!, refunds.get(op.refund_id!)!.amount.amount_minor, op.request_id);
        await exclusive(async () => {
          const refund = refunds.get(op.refund_id!)!; refund.provider_refund_id = r.id;
          if (r.status === 'COMPLETED') { applyRefunded(pay!, refund.amount.amount_minor); refund.state = 'completed'; op.state = 'succeeded'; }
          else { refund.state = 'pending'; op.state = 'waiting'; op.next_at = time() + 10_000; }
        });
      } else if (op.kind === 'payout') {
        const alloc = allocations.get(op.allocation_id!)!;
        if (alloc.payout_state === 'blocked') { await exclusive(async () => { op.state = 'failed'; op.last_error = 'Payout blocked by a refund/dispute hold.'; }); return; }
        if (!alloc.provider_payout_id) {
          const recipient = [...operators.values()].find(x => x.recipient_id === alloc.recipient_id);
          if (!recipient?.paypal_payer_id) { await exclusive(async () => { alloc.payout_state = 'failed'; op.state = 'failed'; op.last_error = 'Operator has no verified PayPal account.'; }); return; }
          const c = competitions.get(alloc.competition_id)!;
          const r = await o.provider.sendPayout({ batchId: op.request_id.replace(/-/g, '').slice(0, 30), payerId: recipient.paypal_payer_id, amountMinor: alloc.amount.amount_minor,
            subject: 'You won a brief on provable.bid', note: `Your agent's site was selected for "${c.title}". Competition ${c.id}.` });
          await exclusive(async () => { alloc.provider_payout_id = r.batchId; alloc.payout_state = 'pending'; op.state = 'waiting'; op.next_at = time() + 4000; });
        } else {
          const r = await o.provider.getPayout(alloc.provider_payout_id);
          const status = r.itemStatus ?? r.batchStatus;
          await exclusive(async () => {
            if (status === 'SUCCESS') { alloc.payout_state = 'paid'; op.state = 'succeeded'; }
            else if (['PENDING', 'PROCESSING', 'UNCLAIMED', 'ONHOLD'].includes(status)) { op.state = 'waiting'; op.next_at = time() + (status === 'UNCLAIMED' ? 60_000 : 5000); }
            else { alloc.payout_state = 'failed'; op.state = 'failed'; op.last_error = r.error ?? status; }
          });
        }
      }
    } catch (e) {
      await exclusive(async () => {
        const unknown = !(e instanceof ProviderError) || e.kind === 'unknown';
        op.last_error = (e as Error).message; op.updated_at = stamp();
        if (unknown && op.attempts < 12) { op.state = 'unknown'; op.next_at = backoff(op.attempts); if (pay) pay.operation_state = 'unknown'; }
        else {
          op.state = 'failed';
          if (pay && (op.kind === 'capture_authorization' || op.kind === 'capture_order')) failCapture(pay, e instanceof ProviderError ? e.issue ?? 'DECLINED' : 'INTERNAL');
          if (pay && op.kind === 'void') { pay.operation_state = 'failed'; pay.last_error_code = e instanceof ProviderError ? e.issue : 'INTERNAL'; }
          if (op.kind === 'payout') { const a = allocations.get(op.allocation_id!); if (a) a.payout_state = 'failed'; }
          if (op.kind === 'refund') { const r = refunds.get(op.refund_id!); if (r) r.state = 'failed'; if (pay) pay.refund_state = 'failed'; }
        }
        log(`operation ${op.kind} ${op.id} ${op.state}`, op.last_error);
      });
    }
  }

  /** Waiting captures: ask PayPal again (webhooks also trigger this). */
  async function pollWaitingCapture(op: Operation) {
    const pay = payments.get(op.payment_id!)!;
    if (op.kind !== 'capture_authorization' && op.kind !== 'capture_order') return runOperation(op);
    try {
      const cap = await o.provider.getCapture(pay.provider_capture_id!);
      await exclusive(async () => {
        if (cap.status === 'COMPLETED') { completeCapture(pay, cap); op.state = 'succeeded'; }
        else if (['DECLINED', 'FAILED'].includes(cap.status)) { failCapture(pay, `CAPTURE_${cap.status}`); op.state = 'failed'; }
        else op.next_at = time() + 10_000;
      });
    } catch (e) { await exclusive(async () => { op.next_at = backoff(op.attempts++); op.last_error = (e as Error).message; }); }
  }

  /** Verified webhook: re-read the canonical PayPal resource and apply it. Never trust the event payload for money state. */
  async function reconcileFromEvent(event: any) {
    const type = String(event.event_type); const resource = event.resource ?? {};
    if (type.startsWith('PAYMENT.CAPTURE.')) {
      const pay = [...payments.values()].find(x => x.provider_capture_id === resource.id) ?? [...payments.values()].find(x => x.provider_order_id === resource.supplementary_data?.related_ids?.order_id);
      if (!pay) return;
      const cap = await o.provider.getCapture(resource.id);
      await exclusive(async () => {
        if (cap.status === 'COMPLETED') completeCapture(pay, cap);
        else if (['DECLINED', 'FAILED'].includes(cap.status)) failCapture(pay, `CAPTURE_${cap.status}`);
        else if (['REFUNDED', 'PARTIALLY_REFUNDED'].includes(cap.status) && pay.refund_state !== 'refunded') applyRefunded(pay, cap.status === 'REFUNDED' ? pay.captured_minor : 0);
        else if (cap.status === 'REVERSED') { pay.reversal_state = 'reversed'; pay.reversed_minor = pay.captured_minor; holdAllocations(pay, true); }
      });
    } else if (type.startsWith('PAYMENT.AUTHORIZATION.')) {
      const pay = [...payments.values()].find(x => x.provider_authorization_id === resource.id);
      if (!pay) return;
      const a = await o.provider.getAuthorization(resource.id);
      await exclusive(async () => { if (a.status === 'VOIDED') pay.authorization_state = 'voided'; else if (a.status === 'EXPIRED') pay.authorization_state = 'expired'; tick(); });
    } else if (type.startsWith('CUSTOMER.DISPUTE.')) {
      // Disputes API needs an extra scope; the verified event is the source here.
      const captureId = resource.disputed_transactions?.[0]?.seller_transaction_id;
      const pay = [...payments.values()].find(x => x.provider_capture_id === captureId);
      if (!pay) return;
      const outcome = String(resource.dispute_outcome?.outcome_code ?? '');
      await exclusive(async () => applyDispute(pay, type.endsWith('RESOLVED') ? (outcome.includes('SELLER') ? 'won' : 'lost') : 'open'));
    } else if (type.startsWith('PAYMENT.PAYOUTS-ITEM.') || type.startsWith('PAYMENT.PAYOUTSBATCH.')) {
      const batch = resource.payout_batch_id ?? resource.batch_header?.payout_batch_id;
      const alloc = [...allocations.values()].find(x => x.provider_payout_id === batch);
      const op = alloc && [...ops.values()].find(x => x.kind === 'payout' && x.allocation_id === alloc.id && x.state === 'waiting');
      if (op) { op.next_at = 0; kick(); }
    }
  }

  let working = false;
  let rerun = false;
  async function work() {
    if (working) { rerun = true; return; }
    working = true;
    try {
      do {
        rerun = false;
        await exclusive(async () => { tick(); });
        void evaluatePending();
        const due = [...ops.values()].filter(x => ['queued', 'unknown', 'waiting'].includes(x.state) && x.next_at <= time() && x.kind !== 'create_order' && x.kind !== 'authorize')
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
        for (const op of due) await (op.state === 'waiting' ? pollWaitingCapture(op) : runOperation(op));
      } while (rerun);
    } finally { working = false; }
  }
  function kick() { track(work()); }

  // ---------------------------------------------------------------- HTTP
  app.setErrorHandler((error, req, reply) => {
    const e = error as Error & { statusCode?: number };
    const status = e instanceof Fault ? e.status : e.statusCode === 413 ? 413 : e.statusCode === 400 || e.statusCode === 415 ? 400 : 503;
    const code = e instanceof Fault ? e.code : status === 413 ? 'PAYLOAD_TOO_LARGE' : status === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR';
    if (status === 503 && !(e instanceof Fault)) log(`internal error ${req.method} ${req.url}`, e.stack);
    if (status === 429 || status === 503) reply.header('Retry-After', '1');
    reply.header('X-Request-Id', req.id).status(status).type('application/problem+json').send({
      type: `urn:provable:problem:${code.toLowerCase()}`, title: code.replaceAll('_', ' ').toLowerCase(), status, code,
      detail: status === 503 && !(e instanceof Fault) ? 'Internal error; the request can be retried with the same Idempotency-Key.' : e.message,
      request_id: req.id, retryable: e instanceof Fault ? e.retryable || status === 503 : status === 503 || status === 429,
    } satisfies S['Problem']);
  });

  for (const op of operations) app.route({
    method: op.method.toUpperCase(), url: op.path.replace(/\{([^}]+)\}/g, ':$1'),
    handler: async (req, reply) => {
      reply.header('X-Request-Id', req.id);
      const headers = req.headers;
      const publicRoute = op.security?.length === 0;
      const bearer = /^Bearer ([A-Za-z0-9_-]+)$/.exec(String(headers.authorization ?? ''));
      const principal = resolvePrincipal(bearer?.[1], credentials, o.adminToken ?? null);
      demand(publicRoute || principal, 'UNAUTHENTICATED', 'Valid bearer credential required.', 401);
      const query = { ...(req.query as any) };
      if (query.limit !== undefined && /^\d+$/.test(query.limit)) query.limit = Number(query.limit);
      for (const parameter of op.parameters) {
        const source = parameter.in === 'header' ? headers : parameter.in === 'path' ? req.params : query;
        const value = (source as any)[parameter.in === 'header' ? parameter.name.toLowerCase() : parameter.name];
        demand(!parameter.required || value !== undefined, 'VALIDATION_ERROR', `Missing ${parameter.name}.`, 400);
        if (value !== undefined) demand(validator(parameter.schema)(value), 'VALIDATION_ERROR', `Invalid ${parameter.name}.`, 400);
      }
      const requestBody = resolve(op.requestBody);
      if (requestBody) {
        demand(req.body !== undefined || !requestBody.required, 'VALIDATION_ERROR', 'JSON body required.', 400);
        const check = validator(requestBody.content['application/json'].schema);
        if (!check(req.body)) throw new Fault(400, 'VALIDATION_ERROR', `Request body does not match the contract: ${check.errors?.slice(0, 2).map(x => `${x.instancePath || 'body'} ${x.message}`).join('; ')}`);
      } else demand(req.body === undefined, 'VALIDATION_ERROR', 'This operation has no request body.', 400);

      let after: (() => void) | undefined;
      const result = await exclusive(async () => {
        const key = headers['idempotency-key'];
        const subject = principal ? (principal.role === 'agent' ? `agent:${principal.agent_id}` : `${principal.role}:${principal.id}`) : 'public';
        const scope = op.method === 'post' && key && op.operationId !== 'createBuyerSession' ? `${subject}|post|${req.url.split('?')[0]}|${key}` : null;
        const fingerprint = canonical(req.body);
        const cached = scope ? replays.get(scope) : undefined;
        if (cached) {
          demand(cached.fingerprint === fingerprint, 'IDEMPOTENCY_CONFLICT', 'Key was used with a different request body.');
          return { status: cached.status, body: structuredClone(cached.body), cache: cached.cache } as Result;
        }
        tick();
        const r = await execute(op.operationId, principal, req.params, req.body, query, headers);
        if (r.status !== 302) {
          try { validateResponse(op, r.status, r.type ?? 'application/json', r.body); }
          catch (e) { if (o.strictResponses !== false) throw e; log(`contract drift in ${op.operationId}`, (e as Error).message); }
        }
        if (scope && r.status < 300) replays.set(scope, { fingerprint, status: r.status, body: structuredClone(r.body), cache: r.cache });
        after = r.after;
        return r;
      });
      if (after) after();
      if (result.status === 302) return reply.redirect(result.location!, 302);
      if (result.cache) reply.header('Cache-Control', result.cache).header('X-Content-Type-Options', 'nosniff');
      if (result.type === 'text/html') reply.header('Content-Security-Policy', "sandbox allow-scripts; default-src 'none'; img-src data: https:; style-src 'unsafe-inline' https:; script-src 'unsafe-inline'; font-src data: https:");
      return reply.type(result.type ?? 'application/json').status(result.status).send(result.body);
    },
  });

  return {
    app,
    /** Advance deadlines, evaluate submissions and run due PayPal operations. Call on a timer. */
    work,
    tick: () => exclusive(async () => tick()),
    /** Resolves when background evaluations, notifications and house-agent runs started so far have finished. */
    async idle() { while (pending.size) await Promise.allSettled([...pending]); },
    houseTokens,
  };
}
