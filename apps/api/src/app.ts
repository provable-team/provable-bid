import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { AgentAdapter, EvaluatorAdapter } from '../../../packages/agent-interface/src/index.js';
import type { components } from '../../../packages/api-client/src/schema.js';
import { operations, resolve, validator, validateResponse } from '../../../scripts/contract.js';
import type { LedgerEntry, OperatorAssistant, OperatorLedger } from './assistant.js';
import type { PageRenderer, RenderResult } from './browser.js';
import { prepareHtml } from './html.js';
import { safeColors, safeLabel, safeStructure, STEP } from './progress.js';
import {
  HOUSE_AGENTS, HOUSE_OPERATOR_ID, hashToken, newSecret, newToken, resolvePrincipal,
  type AgentPrincipal, type AgentRecord, type Credential, type Operator, type Principal,
} from './identity.js';
import { agentPayoutFor, commissionFor, POLICY, processingFeeFor } from './money.js';
import { ProviderError, type AuthorizationView, type PaymentProvider, type PayoutView } from './provider/types.js';
import { sendWebhook, webhookUrl } from './outbound-webhook.js';
import { errorVerdict, evaluatorToken, houseToken, inProcessEvaluation, inProcessHouseRunner, RunnerUnavailable, type EvaluationJob, type EvaluationRunner, type HouseRunner, type RenderedPage } from './runners.js';
import type { DocStore } from './store.js';
import { StudioAiFailure, type StudioAiRelay } from './studio-ai.js';
import { registerAgentDocs } from './agent-docs.js';

type S = components['schemas'];

export class Fault extends Error {
  constructor(public status: number, public code: S['Problem']['code'], message: string, public retryable = false, public retryAfterSeconds = 1) { super(message); }
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
/** Attempts per agent per competition: a new one only after every earlier attempt failed qualification. */
export const MAX_ATTEMPTS = 3;
/** A house agent revises a failed attempt only with at least this much of the submission window left. */
const REVISION_MIN_MS = 60_000;
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
/**
 * The parts of a verified PayPal event that say which resource to re-read. Kept instead of the event body, so no payer
 * data is stored, and never used for amounts or states: those always come from a fresh GET.
 */
export type EventRef = {
  type: string; resource_id: string | null;
  order_id: string | null; authorization_id: string | null;
  /** Refund and reversal resources (PAYMENT.CAPTURE.REFUNDED/REVERSED) carry their capture only in links[rel=up]. */
  up_capture_id: string | null;
  dispute_id: string | null; disputed_capture_ids: string[];
  payout_batch_id: string | null;
};
export type WebhookEventRecord = {
  event_type: string; received_at: string;
  state?: 'queued' | 'handled' | 'failed'; ref?: EventRef; attempts?: number; next_at?: number; last_error?: string | null; handled_at?: string | null;
};
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
export function eventRef(event: any): EventRef {
  const r = event?.resource ?? {};
  const related = r.supplementary_data?.related_ids ?? {};
  const up = (r.links ?? []).find((l: any) => l?.rel === 'up' && /\/v2\/payments\/captures\/[^/?#]+/.test(String(l.href ?? '')));
  return {
    type: String(event?.event_type ?? ''), resource_id: str(r.id),
    order_id: str(related.order_id), authorization_id: str(related.authorization_id),
    up_capture_id: up ? decodeURIComponent(/\/v2\/payments\/captures\/([^/?#]+)/.exec(String(up.href))![1]) : null,
    dispute_id: str(r.dispute_id),
    disputed_capture_ids: (Array.isArray(r.disputed_transactions) ? r.disputed_transactions : []).map((t: any) => str(t?.seller_transaction_id)).filter((x: string | null): x is string => !!x),
    payout_batch_id: str(r.payout_batch_id) ?? str(r.batch_header?.payout_batch_id),
  };
}

/**
 * A resolved dispute's outcome for the merchant. RESOLVED_SELLER_FAVOUR, CANCELED_BY_BUYER and DENIED (PayPal denied the
 * buyer's claim) leave the money with us. RESOLVED_BUYER_FAVOUR and ACCEPTED take it back. RESOLVED_WITH_PAYOUT means
 * PayPal paid one side under its protection programmes, so it depends on whether the capture still holds the money;
 * NONE (closed without a decision because a newer dispute replaced it) is decided by that newer dispute.
 */
export function disputeOutcome(outcome: string | null, captureStatus: string | null): 'won' | 'lost' | 'none' {
  switch (outcome) {
    case 'RESOLVED_SELLER_FAVOUR': case 'CANCELED_BY_BUYER': case 'DENIED': return 'won';
    case 'RESOLVED_BUYER_FAVOUR': case 'ACCEPTED': return 'lost';
    case 'RESOLVED_WITH_PAYOUT': return captureStatus === 'COMPLETED' ? 'won' : 'lost';
    case 'NONE': return 'none';
    default: return 'lost'; // an outcome we don't know: keep the payout held and let a person look
  }
}
/** Every dispute on one capture, combined: any unresolved one holds; otherwise any lost one loses. */
export function disputeVerdict(disputes: { status: string; outcome: string | null }[], captureStatus: string | null): S['Payment']['dispute_state'] {
  if (!disputes.length) return 'none';
  if (disputes.some(d => d.status !== 'RESOLVED')) return 'open';
  const outcomes = disputes.map(d => disputeOutcome(d.outcome, captureStatus));
  return outcomes.includes('lost') ? 'lost' : outcomes.includes('won') ? 'won' : 'none';
}

/** A PayPal payout item (or batch) status as the allocation's payout_state. */
export function payoutOutcome(status: string): { state: S['Allocation']['payout_state']; done: boolean } {
  switch (status) {
    case 'SUCCESS': return { state: 'paid', done: true };
    case 'PENDING': case 'PROCESSING': case 'UNCLAIMED': case 'ONHOLD': case 'NEW': return { state: 'pending', done: false };
    case 'RETURNED': return { state: 'returned', done: true };
    case 'REFUNDED': return { state: 'refunded', done: true };
    case 'REVERSED': return { state: 'reversed', done: true };
    default: return { state: 'failed', done: true }; // FAILED, BLOCKED, DENIED, CANCELED and anything new
  }
}

/** Largest saved dashboard state, as JSON bytes. */
export const STUDIO_DASHBOARD_MAX_BYTES = 200_000;
/** One operator's saved AG Studio dashboard, with the key and body hash of its latest save (for a retried save). */
type StudioDashboardRecord = { operator_id: string; state: S['StudioDashboardSave']['state']; version: number; updated_at: string; last_key: string; last_fingerprint: string };
type StoredAsset = {
  metadata: S['Asset']; original_base64: string; preview: string;
  /** Real-browser render (KERNEL): JPEG screenshots (base64) and measurements. Once present, buyers only ever get images. */
  shots?: { desktop: string; phone: string; desktopHeight: number; phoneHeight: number };
  browser?: {
    renderer: string; phoneOverflowPx: number; consoleErrors: string[]; blockedRequests: string[]; focus?: RenderResult['focus'];
    phoneLayout?: RenderResult['phoneLayout']; loadMs?: number; renderMs?: number;
    /** KERNEL replay of the check (server-side; offered to readers of the submission only until expires_at). */
    replay?: { id: string; url: string; expires_at: string };
  };
};

export interface ApiOptions {
  store: DocStore;
  provider: PaymentProvider;
  evaluator: EvaluatorAdapter;
  /** The web app (buyer frontend); PayPal returns buyers here, operators land here after login. */
  webOrigin: string;
  /** This API's public origin, used in preview/delivery URLs and the Log in with PayPal callback. */
  apiOrigin: string;
  corsOrigins?: string[];
  adminToken?: string | null;
  houseOperatorPayerId?: string | null;
  /** Real-browser renderer for screenshot previews and measured checks (KERNEL). Null: HTML previews, no measurements. */
  renderer?: PageRenderer | null;
  /** House agents (null when no model key is configured). They use the public API with their own credentials. */
  houseAgents?: Record<string, AgentAdapter> | null;
  /** Where house-agent builds run. Default: in this process, from `houseAgents`. See runners.ts. */
  houseRunner?: HouseRunner;
  /** Where submission evaluations run. Default: in this process, with `renderer` and `evaluator`. */
  evaluationRunner?: EvaluationRunner;
  /**
   * WORKFLOWS_SECRET: derive house-agent tokens from it instead of minting fresh ones each boot, and accept the
   * evaluator credential derived from it on the internal job route (both needed by remote runners).
   */
  workflowsSecret?: string | null;
  /** Minimum time between two build-progress updates from one house agent (default 1000 ms). */
  progressIntervalMs?: number;
  /** Base backoff when a remote runner (Render Workflows) is unreachable (default 2000 ms, doubling, capped at 60 s). */
  runnerRetryMs?: number;
  now?: () => number;
  strictResponses?: boolean;
  /** Record payouts as simulated instead of calling the provider. Defaults to true with the fake provider. */
  simulatePayouts?: boolean;
  log?: (msg: string, extra?: unknown) => void;
  notify?: (url: string, body: string, signature: string) => Promise<void>;
  /** "Ask about my earnings" for operators (Claude + PayPal Agent Toolkit). Null: the endpoint is disabled. */
  operatorAssistant?: OperatorAssistant | null;
  /** Questions per operator per minute (default 10). */
  assistantRateLimit?: number;
  /** The operator dashboard's AI assistant (AG Studio Agent Framework turns relayed to Claude). Null: unavailable. */
  studioAi?: StudioAiRelay | null;
  /** Per-operator assistant limits: turns per rolling window, and per day. */
  studioAiLimits?: { windowMs: number; perWindow: number; perDay: number };
}

/** Operations that only read and may take seconds (a model and PayPal round trips): they run outside the command queue. */
const OUTSIDE_QUEUE = new Set(['askOperatorAssistant']);

export async function createApi(o: ApiOptions) {
  const log = o.log ?? ((m: string, x?: unknown) => console.log(`[api] ${m}`, x ?? ''));
  const app: FastifyInstance = Fastify({ logger: false, bodyLimit: 1_000_000, requestIdHeader: false, genReqId: () => id('req') });
  const origins = [o.webOrigin, ...(o.corsOrigins ?? []), 'http://localhost:3000', 'http://127.0.0.1:3000'];
  await app.register(cors, { origin: origins, methods: ['GET', 'HEAD', 'POST', 'PUT'], exposedHeaders: ['X-Request-Id'], allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'] });
  registerAgentDocs(app, { apiOrigin: o.apiOrigin, webOrigin: o.webOrigin });

  const houseRunner = o.houseRunner ?? inProcessHouseRunner(o.houseAgents);
  const evaluationRunner = o.evaluationRunner ?? inProcessEvaluation({ renderer: o.renderer ?? null, evaluator: o.evaluator, log });
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
  /** Verified PayPal events: queued until reconciliation succeeds, then handled. Records without `state` predate the queue (handled). */
  const webhookEvents = st.collection<WebhookEventRecord>('webhook_event');
  /** PayPal refund IDs already counted in a payment's refunded_minor (our own refunds and ones made outside the app). */
  const providerRefunds = st.collection<{ payment_id: string; amount_minor: number }>('provider_refund');
  const ops = st.collection<Operation>('operation');
  const credentials = st.collection<Credential>('credential');
  const operators = st.collection<Operator>('operator');
  const agents = st.collection<AgentRecord>('agent');
  const oauthStates = st.collection<{ expires: number }>('oauth_state');
  /** Remote house-agent runs (Render Workflows), keyed `${competition}:${agent}`, so a restarted API can re-attach or cancel them. */
  const houseRuns = st.collection<{ competition_id: string; agent_id: string; task_run_id: string; state: 'running' | 'finished' | 'canceled'; started_at: string }>('house_run');
  /** Each operator's saved AG Studio dashboard (layout, widgets, format; never data rows), keyed by operator ID. */
  const studioDashboards = st.collection<StudioDashboardRecord>('studio_dashboard');

  // House operator + house agents (labelled; payouts go to the house operator's verified PayPal account).
  const houseOperator: Operator = operators.get(HOUSE_OPERATOR_ID) ?? { id: HOUSE_OPERATOR_ID, name: 'provable.bid', email: null, paypal_payer_id: null, recipient_id: 'recipient_provable', house: true, created_at: stamp() };
  houseOperator.paypal_payer_id = o.houseOperatorPayerId ?? houseOperator.paypal_payer_id;
  operators.set(HOUSE_OPERATOR_ID, houseOperator);
  const houseTokens = new Map<string, string>();
  for (const h of HOUSE_AGENTS) {
    const existing = agents.get(h.id);
    for (const hash of existing?.credential_hashes ?? []) credentials.delete(hash); // fresh credentials each boot
    const token = o.workflowsSecret ? houseToken(o.workflowsSecret, h.id) : newToken('pba');
    const principal: AgentPrincipal = { id: `cred_${h.id}`, role: 'agent', agent_id: h.id, operator_id: HOUSE_OPERATOR_ID, recipient_id: houseOperator.recipient_id };
    credentials.set(hashToken(token), { principal, created_at: stamp(), revoked: false });
    houseTokens.set(h.id, token);
    agents.set(h.id, {
      profile: { id: h.id, name: h.name, description: h.description, style: h.style, capabilities: ['html'], internal: true,
        status: houseRunner.has(h.id) ? 'available' : 'unavailable', avatar_color: h.avatar_color, operator_id: HOUSE_OPERATOR_ID, operator_name: 'provable.bid' },
      operator_id: HOUSE_OPERATOR_ID, webhook_url: null, webhook_secret: null, credential_hashes: [hashToken(token)], created_at: existing?.created_at ?? stamp(),
    });
  }
  // Anything left "running" when the process stopped has an unknown provider outcome: retry it with the same request ID.
  for (const op of ops.values()) if (op.state === 'running') { op.state = 'unknown'; op.next_at = 0; }
  await st.flush();

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
  /**
   * Content-free summary of the real-browser check (counts and pixel widths only, never messages or URLs from the
   * page), for anyone who may read the submission. The replay link is offered only while KERNEL still keeps it.
   */
  function browserCheck(s: S['Submission']): S['BrowserCheck'] | undefined {
    const b = assets.get(s.artifacts[0]?.asset_id)?.browser;
    if (!b) return undefined;
    const replay = b.replay && time() < Date.parse(b.replay.expires_at) ? b.replay : null;
    const layout = b.phoneLayout?.layoutWidth ?? null;
    return {
      phone_fits: b.phoneOverflowPx <= 1, phone_overflow_px: b.phoneOverflowPx, phone_layout_width: layout,
      console_errors: b.consoleErrors.length, blocked_requests: b.blockedRequests.length,
      focus_stops: b.focus?.tabStops ?? null, focus_visible: b.focus?.visibleIndicators ?? null, focus_complete: b.focus?.complete ?? null,
      load_ms: b.loadMs ?? null, render_ms: b.renderMs ?? null,
      replay_url: replay?.url ?? null, replay_expires_at: replay?.expires_at ?? null,
    };
  }
  /**
   * A submission as `p` may see it. The judge's advisory narrative is for the competition's buyer (and admins), and
   * only on qualified entries; agents, including the entry's own author, never get it.
   */
  function submissionView(s: S['Submission'], p: Principal): S['Submission'] {
    const check = browserCheck(s);
    const v = view(check ? { ...s, browser_check: check } : s);
    const forBuyer = p.role === 'admin' || (p.role === 'buyer' && fetchOne(competitions, s.competition_id).buyer_id === p.id);
    if (v.qualification?.narrative && !(forBuyer && v.qualification_status === 'qualified' && v.qualification.status === 'qualified')) delete v.qualification.narrative;
    return v;
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
  /** PayPal sends the buyer back to the site they started on (if it is one of ours), so their stored session is there. */
  const webOriginFor = (headers: Record<string, unknown>) => {
    const origin = typeof headers.origin === 'string' ? headers.origin : '';
    return origins.includes(origin) ? origin : o.webOrigin;
  };
  async function ensureOrder(c: S['Competition'], pay: S['Payment'], intent: 'AUTHORIZE' | 'CAPTURE', webOrigin = o.webOrigin): Promise<S['Checkout']> {
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
    await st.flush(); // persist the PayPal-Request-Id before PayPal sees it
    const returnTo = `${webOrigin}/competitions/${c.id}`;
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
  /** Record a usable PayPal authorization and open the competition (from the buyer's authorize call or the AUTHORIZATION.CREATED webhook). */
  function openWithAuthorization(c: S['Competition'], pay: S['Payment'], authorization: AuthorizationView | null | undefined): S['Competition'] {
    demand(authorization && ['CREATED', 'PENDING'].includes(authorization.status), 'PAYMENT_NOT_READY', `PayPal authorization is ${authorization?.status ?? 'missing'}.`);
    const created = Date.parse(authorization.createTime);
    const schedule = (c.submission_window_seconds + policy.qualification_grace_seconds + c.decision_window_seconds) * 1000;
    demand(time() + schedule + 900_000 < created + 3 * 86_400_000, 'PAYMENT_NOT_READY', 'The PayPal authorization is too old to cover the decision window.');
    pay.authorization_state = 'authorized'; pay.provider_authorization_id = authorization.id; pay.authorized_at = at(created);
    pay.authorization_expires_at = authorization.expirationTime ?? at(created + 29 * 86_400_000); pay.operation_state = 'succeeded'; pay.last_error_code = null; pay.updated_at = stamp();
    for (const x of ops.values()) if (x.kind === 'authorize' && x.payment_id === pay.id && x.state !== 'succeeded') { x.state = 'succeeded'; x.last_error = null; x.updated_at = stamp(); }
    c.opens_at = stamp(); c.submission_deadline = at(time() + c.submission_window_seconds * 1000);
    c.qualification_deadline = at(Date.parse(c.submission_deadline) + policy.qualification_grace_seconds * 1000);
    c.decision_deadline = at(Date.parse(c.qualification_deadline) + c.decision_window_seconds * 1000);
    c.state = 'open'; update(c);
    return structuredClone(c);
  }
  /**
   * The authorization's state as PayPal reports it, after a void (accepted or refused) or an AUTHORIZATION webhook.
   * A refused void leaves the hold in place only if PayPal still says CREATED/PENDING; otherwise it is VOIDED, EXPIRED or CAPTURED.
   */
  function applyAuthorizationStatus(pay: S['Payment'], status: string, refusal: string | null = null) {
    const before = pay.authorization_state;
    if (status === 'VOIDED') pay.authorization_state = 'voided';
    else if (status === 'EXPIRED') pay.authorization_state = 'expired';
    else if (status === 'CAPTURED' || status === 'PARTIALLY_CAPTURED') pay.authorization_state = 'captured';
    else if (before === 'void_pending' && refusal) pay.authorization_state = 'authorized'; // the hold is still there
    if (pay.authorization_state !== before) pay.updated_at = stamp();
    // Touch the operation fields only for our own void's outcome (or a webhook that settles it), not for unrelated events.
    if (refusal || (before === 'void_pending' && pay.authorization_state !== before)) {
      const settled = ['voided', 'expired'].includes(pay.authorization_state);
      pay.operation_state = settled ? 'succeeded' : 'failed';
      // CAPTURED here means money was taken that the app did not ask for: flag it for a person (the capture webhook records it).
      pay.last_error_code = settled ? null : pay.authorization_state === 'captured' ? 'VOID_REFUSED_AUTHORIZATION_CAPTURED' : refusal ?? `AUTHORIZATION_${status}`;
    }
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
      // Already-sent payouts can't be recalled, and a final PayPal outcome (returned, refunded, reversed) stays as reported.
      if (['queued', 'simulated', 'not_scheduled', 'failed'].includes(a.payout_state)) a.payout_state = 'blocked';
    }
  }
  function completeCapture(p: S['Payment'], cap: { id: string; amountMinor: number; feeMinor: number | null }) {
    // A canonical webhook may settle a capture whose responses were all lost, including after retries stopped.
    for (const op of ops.values()) if (op.payment_id === p.id && ['capture_authorization', 'capture_order'].includes(op.kind)) {
      op.state = 'succeeded'; op.last_error = null; op.updated_at = stamp();
    }
    if (p.capture_state === 'completed') return;
    p.capture_state = 'completed'; p.operation_state = 'succeeded'; p.last_error_code = null;
    if (p.authorization_state !== 'not_applicable') p.authorization_state = 'captured';
    p.provider_capture_id = cap.id; p.captured_minor = cap.amountMinor; p.provider_expense_minor = cap.feeMinor ?? p.provider_expense_minor; p.updated_at = stamp();
    allocate(p);
  }
  function failCapture(p: S['Payment'], code: string) {
    p.capture_state = 'failed'; p.operation_state = 'failed'; p.last_error_code = code; p.updated_at = stamp();
    // The winner is locked once picked, so a failed capture would otherwise leave the buyer's hold in place until
    // PayPal's 29-day expiry. Release it.
    if (p.authorization_state === 'authorized') { p.authorization_state = 'void_pending'; queueOp(p, 'void'); }
  }
  function applyDispute(p: S['Payment'], state: S['Payment']['dispute_state']) {
    if (p.dispute_state === state) return;
    p.dispute_state = state; p.updated_at = stamp();
    // won, or 'none' (the only dispute closed without a decision): release a hold that only the dispute caused.
    if ((state === 'won' || state === 'none') && entitled(p)) {
      for (const a of allocations.values()) if (a.payment_id === p.id && a.ledger_state === 'held') { a.ledger_state = 'allocated'; if (a.payout_state === 'blocked') { a.payout_state = simulatePayouts ? 'simulated' : 'queued'; if (!simulatePayouts) newOp('payout', { allocation_id: a.id, payment_id: p.id }); } }
    } else if (state === 'open' || state === 'lost') holdAllocations(p, false);
  }
  /**
   * Count a completed PayPal refund once. totalMinor (PayPal's seller_payable_breakdown.total_refunded_amount, re-read
   * from the refund) wins when known; otherwise the refund's own amount is added unless its ID was already counted.
   */
  function applyRefunded(p: S['Payment'], amountMinor: number, providerRefundId: string | null = null, totalMinor: number | null = null) {
    const seen = providerRefundId ? providerRefunds.has(providerRefundId) : false;
    const next = totalMinor !== null ? Math.max(p.refunded_minor, totalMinor) : seen ? p.refunded_minor : p.refunded_minor + amountMinor;
    if (providerRefundId && !seen) providerRefunds.set(providerRefundId, { payment_id: p.id, amount_minor: amountMinor });
    p.refunded_minor = Math.min(p.captured_minor, next); p.refund_state = p.refunded_minor >= p.captured_minor ? 'refunded' : 'partially_refunded'; p.updated_at = stamp();
    for (const r of refunds.values()) if (r.payment_id === p.id && r.state !== 'completed' && (!providerRefundId || !r.provider_refund_id || r.provider_refund_id === providerRefundId)) r.state = 'completed';
    holdAllocations(p, true);
  }
  function applyReversed(p: S['Payment'], amountMinor: number) {
    p.reversal_state = 'reversed'; p.reversed_minor = Math.min(p.captured_minor, Math.max(p.reversed_minor, amountMinor)); p.updated_at = stamp();
    holdAllocations(p, true);
  }
  /** PayPal's payout status, from a poll or a re-read after a PAYMENT.PAYOUTS* webhook (also after the op finished: REFUNDED/REVERSED come later). */
  function applyPayout(alloc: S['Allocation'], op: Operation | undefined, r: PayoutView) {
    const status = r.itemStatus ?? r.batchStatus;
    const { state, done } = payoutOutcome(status);
    const detail = state === 'paid' ? null
      : status === 'UNCLAIMED' ? 'UNCLAIMED: the recipient has 30 days to claim it'
      : status === 'ONHOLD' ? 'ONHOLD: PayPal is reviewing this payout'
      : state === 'pending' ? null : (r.error ? `${status}: ${r.error}` : status).slice(0, 300);
    if (alloc.payout_state !== state || (alloc.payout_detail ?? null) !== detail) { alloc.payout_state = state; alloc.payout_detail = detail; }
    if (!op) return;
    op.updated_at = stamp();
    if (!done) { op.state = 'waiting'; op.next_at = time() + (status === 'UNCLAIMED' ? 60_000 : 5000); }
    else { op.state = state === 'paid' ? 'succeeded' : 'failed'; op.last_error = state === 'paid' ? null : detail; }
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
    // Staged = uploaded but not yet used in a submission (each attempt uses one).
    const used = new Set(compSubmissions(c).flatMap(s => s.artifacts.map(x => x.asset_id)));
    demand([...assets.values()].filter(a => a.metadata.competition_id === c.id && a.metadata.owner_agent_id === who.agent_id && !used.has(a.metadata.id)).length < 3, 'INVALID_STATE', 'At most three staged assets per agent and competition.');
    let prepared: ReturnType<typeof prepareHtml>;
    try { prepared = prepareHtml(input.content_base64); } catch (e) { throw new Fault(400, 'VALIDATION_ERROR', (e as Error).message); }
    const assetId = id('asset');
    const metadata: S['Asset'] = {
      id: assetId, competition_id: c.id, owner_agent_id: who.agent_id, type: 'html', mime_type: 'text/html',
      size_bytes: prepared.original.length, sha256: prepared.sha256, width: null, height: null,
      preview: { url: `${o.apiOrigin}/v1/assets/${assetId}/preview`, phone_url: null, mime_type: 'text/html', width: null, height: null, text_excerpt: prepared.title },
      created_at: stamp(), server_time: stamp(),
    };
    assets.set(assetId, { metadata, original_base64: input.content_base64, preview: prepared.preview.toString('utf8') });
    return metadata;
  }
  function submit(c: S['Competition'], who: AgentPrincipal, title: string, refs: { asset_id: string }[]): S['Submission'] {
    requireOpen(c);
    // Up to MAX_ATTEMPTS per agent, and a new attempt only when every earlier one failed qualification.
    const mine = compSubmissions(c).filter(s => s.agent_id === who.agent_id);
    demand(mine.every(s => s.qualification_status === 'failed'), 'DUPLICATE_SUBMISSION',
      mine.some(s => s.qualification_status === 'pending') ? 'Your previous attempt is still being checked.' : 'You already have an entry in this competition.');
    demand(mine.length < MAX_ATTEMPTS, 'DUPLICATE_SUBMISSION', `At most ${MAX_ATTEMPTS} attempts per agent; all of yours failed qualification.`);
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
    try { return await fn(); } finally { try { await st.flush(); } finally { release(); } }
  }

  function page(items: any[], query: any, decorate = true) {
    items.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id));
    const limit = query.limit ?? 20;
    const start = query.cursor ? items.findIndex(i => Buffer.from(i.id).toString('base64url') === query.cursor) + 1 : 0;
    demand(!query.cursor || start > 0, 'VALIDATION_ERROR', 'Invalid cursor.', 400);
    const slice = items.slice(start, start + limit).map(item => decorate ? view(item) : structuredClone(item));
    return { items: slice, next_cursor: start + limit < items.length ? Buffer.from(slice.at(-1).id).toString('base64url') : null, server_time: stamp() };
  }

  // ---------------------------------------------------------------- operator assistant
  /** Everything one operator owns, read synchronously (so consistent) when a question arrives. */
  function operatorLedger(operatorId: string): OperatorLedger {
    const op = fetchOne(operators, operatorId);
    const mine = [...allocations.values()].filter(a => a.operator_id === operatorId).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    return { operator_name: op.name, now: stamp(), allocations: mine.map((a): LedgerEntry => {
      const p = payments.get(a.payment_id);
      return {
        allocation_id: a.id, brief_title: competitions.get(a.competition_id)?.title ?? a.competition_id,
        agents: a.agent_shares.map(s => agents.get(s.agent_id)?.profile.name ?? s.agent_id),
        amount_minor: a.amount.amount_minor, created_at: a.created_at, ledger_state: a.ledger_state, payout_state: a.payout_state,
        payment: p ? { purpose: p.purpose, capture_state: p.capture_state, authorization_state: p.authorization_state, refund_state: p.refund_state, dispute_state: p.dispute_state, captured_minor: p.captured_minor } : null,
        paypal: {
          order_id: p?.provider_order_id ?? null, authorization_id: p?.provider_authorization_id ?? null, capture_id: p?.provider_capture_id ?? null,
          payout_batch_id: a.provider_payout_id,
          refund_ids: [...refunds.values()].filter(r => r.payment_id === a.payment_id && r.provider_refund_id).map(r => r.provider_refund_id!),
        },
      };
    }) };
  }
  const assistantCalls = new Map<string, number[]>();
  /** Sliding one-minute window per operator; the question counts before the model is called. */
  function assistantRateLimit(operatorId: string) {
    const limit = o.assistantRateLimit ?? 10;
    const recent = (assistantCalls.get(operatorId) ?? []).filter(t => t > time() - 60_000);
    if (recent.length >= limit) throw new Fault(429, 'RATE_LIMITED', `At most ${limit} questions a minute. Try again shortly.`, true, Math.max(1, Math.ceil((recent[0] + 60_000 - time()) / 1000)));
    recent.push(time()); assistantCalls.set(operatorId, recent);
  }

  // `outside` runs after the state lock is released (slow, stateless work such as a model call) and supplies the response.
  type Result = { status: number; body?: any; cache?: string; type?: string; location?: string; after?: () => void; outside?: () => Promise<Result> };
  // A retry can arrive before slow work has produced its durable replay. Share that work within the same scoped key.
  const outsideReplies = new Map<string, { fingerprint: string; finish: () => Promise<Result> }>();
  // Studio assistant turns per operator: timestamps of recent turns, and how many are in flight.
  const studioAiLimits = o.studioAiLimits ?? { windowMs: 10 * 60_000, perWindow: 60, perDay: 400 };
  const studioAiTurns = new Map<string, { at: number[]; inFlight: number }>();
  async function execute(op: string, p: Principal | undefined, params: any, body: any, query: any, headers: any): Promise<Result> {
    const ok = (body: any, status = 200): Result => ({ status, body });
    const who = () => { demand(p, 'UNAUTHENTICATED', 'Valid bearer credential required.', 401); return p; };
    switch (op) {
      case 'getHealth': return ok({ status: 'ok', mode: o.provider.mode, server_time: stamp() });
      case 'getConfig': return ok({
        mode: o.provider.mode, currency: 'USD', terms_version: policy.terms_version, policy,
        capabilities: { authorization: true, additional_checkout: true, external_agents: true, payouts: simulatePayouts ? 'simulated' : 'paypal_sandbox',
          ai_evaluation: !o.evaluator.version.startsWith('heuristic'), house_agents: HOUSE_AGENTS.some(h => houseRunner.has(h.id)), operator_onboarding: 'paypal_login',
          browser_previews: !!o.renderer, operator_assistant: !!o.operatorAssistant, studio_ai: !!o.studioAi },
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
        if (body.webhook_url) {
          try { webhookUrl(body.webhook_url, mockMode); }
          catch (e) { throw new Fault(400, 'VALIDATION_ERROR', (e as Error).message); }
        }
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
        // Rendered in a real browser: images only, so the markup never leaves the server before purchase.
        if (asset.shots) return { status: 200, body: Buffer.from(query.view === 'phone' ? asset.shots.phone : asset.shots.desktop, 'base64'), type: 'image/jpeg', cache: 'no-store' };
        // Fail closed: with a browser renderer configured, buyers never receive markup. If the render failed, they get no preview.
        demand(!o.renderer || me.role !== 'buyer', 'INVALID_STATE', 'This preview is not available yet.', 409);
        return { status: 200, body: asset.preview, type: 'text/html', cache: 'no-store' };
      }
      case 'submitWork': {
        const me = who(); demand(me.role === 'agent', 'FORBIDDEN', 'Agent credential required.', 403);
        const c = fetchOne(competitions, params.competition_id); readCompetition(c, me);
        const s = submit(c, me, body.title, body.artifacts);
        // A house agent building on another instance submits over HTTP: its live progress moves to "submitted" here.
        const remoteHouse = houseRunner.remote && agents.get(me.agent_id)?.profile.internal;
        return { status: 201, body: submissionView(s, me), ...(remoteHouse ? { after: () => houseSubmitted(c, me.agent_id, s.id) } : {}) };
      }
      case 'listSubmissions': {
        const me = who(); const c = fetchOne(competitions, params.competition_id);
        demand(me.id === c.buyer_id || me.role === 'agent' || me.role === 'admin', 'NOT_FOUND', 'Resource not found.', 404);
        return ok(page(compSubmissions(c).filter(s => canReadSubmission(s, me)).map(s => submissionView(s, me)), query, false));
      }
      case 'getSubmission': {
        const me = who(); const s = fetchOne(submissions, params.submission_id);
        demand(canReadSubmission(s, me), 'NOT_FOUND', 'Resource not found.', 404); return ok(submissionView(s, me));
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
      case 'getCompetition': {
        const me = who(); const c = fetchOne(competitions, params.competition_id); readCompetition(c, me);
        const body = view(c);
        if (me.role === 'buyer' && me.id === c.buyer_id) body.build_progress = buildProgressFor(c.id); // the buyer only
        return ok(body);
      }
      case 'createInitialCheckout': {
        const c = fetchOne(competitions, params.competition_id); owner(c, who());
        demand(['draft', 'awaiting_authorization'].includes(c.state));
        if (!c.initial_payment_id) { c.initial_payment_id = makePayment(c, 'initial').id; c.state = 'awaiting_authorization'; update(c); }
        const checkout = await ensureOrder(c, fetchOne(payments, c.initial_payment_id), 'AUTHORIZE', webOriginFor(headers));
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
          await st.flush();
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
        const opened = openWithAuthorization(c, pay, authorization);
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
        if (pay.capture_state === 'none') purchase.checkout = await ensureOrder(c, pay, 'CAPTURE', webOriginFor(headers));
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
      case 'listOperatorAllocations': {
        const me = who(); demand(me.role === 'operator', 'OPERATOR_REQUIRED', 'Connect PayPal as an agent operator first.', 403);
        const result = page([...allocations.values()].filter(a => a.operator_id === me.operator_id), query);
        result.items = result.items.map(({ server_time: _t, ...a }: any) => a); return ok(result); // Allocation has no server_time
      }
      case 'askOperatorAssistant': {
        const me = who(); demand(me.role === 'operator', 'OPERATOR_REQUIRED', 'Connect PayPal as an agent operator first.', 403);
        demand(o.operatorAssistant, 'NOT_FOUND', 'The operator assistant is not enabled on this server.', 404);
        const question = String(body.question).trim();
        demand(question.length > 0, 'VALIDATION_ERROR', 'Ask a question.', 400);
        assistantRateLimit(me.operator_id);
        const ledger = operatorLedger(me.operator_id);
        let answer;
        try { answer = await o.operatorAssistant.ask({ question, ledger, signal: AbortSignal.timeout(90_000) }); }
        catch (e) {
          log('assistant failed', (e as Error).message);
          throw new Fault(503, 'PROVIDER_UNAVAILABLE', 'The assistant could not answer right now. Try again in a moment.', true);
        }
        log('assistant answered', { operator: me.operator_id, requests: answer.usage.requests, input_tokens: answer.usage.input_tokens, output_tokens: answer.usage.output_tokens,
          lookups: answer.lookups.map(l => `${l.tool}:${l.status}`).join(' ') });
        return { status: 200, body: { answer: answer.answer, lookups: answer.lookups, server_time: stamp() }, cache: 'no-store' };
      }
      case 'runStudioAiTurn': {
        const me = who(); demand(me.role === 'operator', 'OPERATOR_REQUIRED', 'Connect PayPal as an agent operator first.', 403);
        const relay = o.studioAi;
        if (!relay) throw new Fault(503, 'PROVIDER_UNAVAILABLE', 'The dashboard assistant is not configured on this server.');
        const now = Date.now();
        const usage = studioAiTurns.get(me.operator_id) ?? { at: [], inFlight: 0 };
        usage.at = usage.at.filter(t => now - t < 86_400_000);
        const recent = usage.at.filter(t => now - t < studioAiLimits.windowMs).length;
        if (recent >= studioAiLimits.perWindow || usage.at.length >= studioAiLimits.perDay || usage.inFlight >= 3) {
          throw new Fault(429, 'RATE_LIMITED', usage.at.length >= studioAiLimits.perDay ? 'Daily limit for the dashboard assistant reached. Try again tomorrow.' : 'The dashboard assistant is busy for this account. Try again in a few minutes.', true);
        }
        usage.at.push(now); usage.inFlight++; studioAiTurns.set(me.operator_id, usage);
        const request = structuredClone(body);
        return { status: 200, outside: async () => {
          try { return { status: 200, body: { ...(await relay(request)), server_time: stamp() }, cache: 'no-store' }; }
          catch (e) {
            if (e instanceof StudioAiFailure && e.kind === 'rate_limited') throw new Fault(429, 'RATE_LIMITED', 'The model is rate-limited. Try again shortly.', true);
            if (e instanceof StudioAiFailure && e.kind === 'rejected') { log('studio ai turn rejected', e.message); throw new Fault(400, 'VALIDATION_ERROR', 'The model rejected this turn.'); }
            log('studio ai turn failed', (e as Error).message);
            throw new Fault(503, 'PROVIDER_UNAVAILABLE', 'The model is unavailable. Try again.', true);
          } finally { usage.inFlight--; }
        } };
      }
      case 'getStudioDashboard': {
        const me = who(); demand(me.role === 'operator', 'OPERATOR_REQUIRED', 'Connect PayPal as an agent operator first.', 403);
        const saved = studioDashboards.get(me.operator_id);
        return { status: 200, body: { state: saved ? structuredClone(saved.state) : null, version: saved?.version ?? 0, updated_at: saved?.updated_at ?? null, server_time: stamp() }, cache: 'no-store' };
      }
      case 'saveStudioDashboard': {
        const me = who(); demand(me.role === 'operator', 'OPERATOR_REQUIRED', 'Connect PayPal as an agent operator first.', 403);
        const json = JSON.stringify(body.state);
        if (Buffer.byteLength(json) > STUDIO_DASHBOARD_MAX_BYTES) throw new Fault(413, 'PAYLOAD_TOO_LARGE', `The dashboard is larger than ${STUDIO_DASHBOARD_MAX_BYTES} bytes. Remove some widgets and try again.`);
        const saved = studioDashboards.get(me.operator_id);
        const key = String(headers['idempotency-key']);
        // Only the latest save can be retried (its record holds the key): a replay returns the same result again.
        const fingerprint = createHash('sha256').update(canonical(body)).digest('hex');
        if (saved?.last_key === key) {
          demand(saved.last_fingerprint === fingerprint, 'IDEMPOTENCY_CONFLICT', 'Key was used with a different request body.');
          return { status: 200, body: { version: saved.version, updated_at: saved.updated_at, server_time: stamp() }, cache: 'no-store' };
        }
        demand(body.version === (saved?.version ?? 0), 'INVALID_STATE', 'The dashboard was saved from another window or device. Reload it to continue.');
        const record: StudioDashboardRecord = { operator_id: me.operator_id, state: JSON.parse(json), version: (saved?.version ?? 0) + 1, updated_at: stamp(), last_key: key, last_fingerprint: fingerprint };
        studioDashboards.set(me.operator_id, record);
        return { status: 200, body: { version: record.version, updated_at: record.updated_at, server_time: stamp() }, cache: 'no-store' };
      }
      case 'getAgentEarnings': {
        const me = who(); demand(me.role === 'agent', 'FORBIDDEN', 'Agent credential required.', 403);
        const result = page([...allocations.values()].filter(a => a.agent_shares.some(s => s.agent_id === me.agent_id)), query);
        result.items = result.items.map(({ server_time: _t, ...a }: any) => a); return ok(result);
      }
      case 'receivePayPalWebhook': {
        const genuine = await o.provider.verifyWebhook(headers, body).catch(() => false);
        if (!genuine) log('webhook rejected: signature not verified', `${body?.event_type ?? '?'} ${body?.id ?? '?'}`);
        demand(genuine, 'INVALID_WEBHOOK', 'Webhook signature could not be verified with PayPal.', 400);
        // Durably queue the verified event, then acknowledge. It is marked handled only after reconciliation succeeds;
        // a failed PayPal re-read keeps it queued and the worker retries it (a redelivery of a queued event just nudges it).
        const known = webhookEvents.get(body.id);
        if (!known) {
          // Event type, PayPal event ID and resource ID only: no payer data in logs.
          log('webhook verified', `${body.event_type} ${body.id} resource=${body.resource?.id ?? '?'}`);
          webhookEvents.set(body.id, { event_type: body.event_type, received_at: stamp(), state: 'queued', ref: eventRef(body), attempts: 0, next_at: 0, last_error: null, handled_at: null });
        } else if (known.state === 'queued' || known.state === 'failed') {
          if (known.state === 'failed') known.attempts = 0; // PayPal redelivered one we gave up on: try again
          known.state = 'queued'; known.next_at = 0;
        }
        return { status: 200, body: { accepted: true, event_id: body.id }, after: !known || known.state === 'queued' ? kick : undefined };
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
      const send = o.notify ?? ((url: string, b: string, sig: string) => sendWebhook(url, b, sig, { allowLoopback: mockMode }));
      track((async () => {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try { await send(a.webhook_url!, raw, signature); return; } catch (e) { if (attempt === 3) log(`notify ${a.profile.id} failed`, (e as Error).message); else await new Promise(r => setTimeout(r, 1000 * attempt)); }
        }
      })());
    }
    for (const h of HOUSE_AGENTS) if (houseRunner.has(h.id)) track(runHouseAgent(h.id, c));
  }

  // ---------------------------------------------------------------- house-agent build progress (in memory, for the run)
  // Coarse step labels only (see progress.ts): never generated text, markup or CSS. Shown to the competition's buyer.
  type Progress = S['BuildProgress'] & { at: number; shapedAt: number; submission_id: string | null };
  const buildProgress = new Map<string, Map<string, Progress>>(); // competition ID → agent ID → latest step
  const progressInterval = o.progressIntervalMs ?? 1000;
  const buildProgressFor = (competitionId: string): S['BuildProgress'][] =>
    [...(buildProgress.get(competitionId)?.values() ?? [])].map(({ agent_id, step, label, state, colors, blocks, current_block, accent, attempt, max_attempts, missed_requirement_ids, updated_at }) =>
      ({ agent_id, step, label, state, colors: [...colors], blocks: structuredClone(blocks), current_block, accent, attempt, max_attempts, missed_requirement_ids: [...missed_requirement_ids], updated_at }));
  function setProgress(competitionId: string, agentId: string, label: string, state: S['BuildProgress']['state'], submissionId: string | null = null, colors?: string[]) {
    let byAgent = buildProgress.get(competitionId);
    if (!byAgent) buildProgress.set(competitionId, byAgent = new Map());
    const cur = byAgent.get(agentId);
    byAgent.set(agentId, {
      agent_id: agentId, step: (cur?.step ?? -1) + 1, label, state, colors: colors ?? cur?.colors ?? [],
      blocks: cur?.blocks ?? [], current_block: cur?.current_block ?? null, accent: cur?.accent ?? null,
      attempt: cur?.attempt ?? 1, max_attempts: MAX_ATTEMPTS, missed_requirement_ids: cur?.missed_requirement_ids ?? [],
      updated_at: stamp(), at: time(), shapedAt: cur?.shapedAt ?? 0, submission_id: submissionId ?? cur?.submission_id ?? null,
    });
  }
  function reportProgress(competitionId: string, agentId: string, raw: string, immediate = false, rawColors?: unknown, rawStructure?: unknown) {
    const label = safeLabel(raw);
    const colors = safeColors(rawColors); // only exact #rrggbb strings ever leave the server
    const shape = safeStructure(rawStructure); // only known block kinds, small integers and #rrggbb
    let cur = buildProgress.get(competitionId)?.get(agentId);
    if (cur && cur.state !== 'building' && cur.state !== 'revising') return;
    if (!cur && label) { setProgress(competitionId, agentId, label, 'building', null, colors); cur = buildProgress.get(competitionId)!.get(agentId)!; }
    // The page's shape moves the cursor: up to ~2 updates a second, never a new step on its own.
    if (cur && shape && (immediate || time() - cur.shapedAt >= progressInterval / 2)) {
      const changed = JSON.stringify([shape.blocks, shape.current, shape.accent]) !== JSON.stringify([cur.blocks, cur.current_block, cur.accent]);
      if (changed) { cur.blocks = shape.blocks; cur.current_block = shape.current; cur.accent = shape.accent; cur.shapedAt = time(); cur.updated_at = stamp(); }
    }
    // New colours are kept straight away (at most 3 changes per run); they never move the step on their own.
    if (cur && colors.length > cur.colors.length) { cur.colors = colors; cur.updated_at = stamp(); }
    if (!label || cur?.label === label) return;
    if (cur && !immediate && time() - cur.at < progressInterval) return; // at most one step per interval per agent
    setProgress(competitionId, agentId, label, cur?.state === 'revising' ? 'revising' : 'building', null, colors.length > (cur?.colors.length ?? 0) ? colors : undefined);
  }
  const activeRuns = new Set<string>(); // `${competition}:${agent}` while a house agent's run is going
  /** After evaluation: an honest end state for a house agent's placeholder, or none if the check could not finish. */
  function settleProgress(s: S['Submission']) {
    const byAgent = buildProgress.get(s.competition_id);
    const cur = byAgent?.get(s.agent_id);
    if (!cur || cur.submission_id !== s.id) return;
    if (s.qualification_status === 'qualified') setProgress(s.competition_id, s.agent_id, 'qualified', 'qualified');
    else if (s.qualification_status === 'failed') {
      // Which of the buyer's requirements were missed (IDs only; never the judge's reasons or anything from the page).
      cur.missed_requirement_ids = (s.qualification?.checks ?? []).filter(x => !x.passed).map(x => x.requirement_id).slice(0, 20);
      const c = competitions.get(s.competition_id)!;
      const canRevise = activeRuns.has(`${s.competition_id}:${s.agent_id}`) && cur.attempt < MAX_ATTEMPTS
        && Date.parse(c.submission_deadline!) - time() >= REVISION_MIN_MS;
      if (canRevise) { setProgress(s.competition_id, s.agent_id, 'revising', 'revising'); const n = byAgent!.get(s.agent_id)!; n.attempt = cur.attempt + 1; n.blocks = []; n.current_block = null; }
      else setProgress(s.competition_id, s.agent_id, "didn't qualify", 'not_qualified');
    }
    else if (s.qualification_status !== 'pending') byAgent!.delete(s.agent_id);
  }

  /** A house agent's entry was accepted: its placeholder says "submitted" (and settles at once if already checked). */
  function houseSubmitted(c: S['Competition'], agentId: string, submissionId: string) {
    const state = buildProgress.get(c.id)?.get(agentId)?.state;
    if (state !== 'building' && state !== 'revising') return;
    setProgress(c.id, agentId, STEP.submitted, 'submitted', submissionId);
    buildProgress.get(c.id)!.get(agentId)!.attempt = compSubmissions(c).filter(x => x.agent_id === agentId).length;
    const stored = submissions.get(submissionId);
    if (stored) settleProgress(stored); // in case it was already checked
  }

  /** House agents act through the public API with their own credentials, exactly like an outside agent. */
  async function runHouseAgent(agentId: string, c: S['Competition']) {
    const token = houseTokens.get(agentId)!;
    const call = async (method: 'POST' | 'GET', url: string, payload: unknown, key: string) => {
      const r = await app.inject(method === 'GET'
        ? { method, url, headers: { authorization: `Bearer ${token}` } }
        : { method, url, payload: payload as any, headers: { authorization: `Bearer ${token}`, 'idempotency-key': key } });
      if (r.statusCode >= 300) throw new Error(`${url} → ${r.statusCode} ${r.body.slice(0, 200)}`);
      return r.json();
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, Date.parse(c.submission_deadline!) - time() - 5000));
    timer.unref(); // never the only thing keeping a process alive (a run abandoned by a stopping process)
    const run = `${c.id}:${agentId}`;
    activeRuns.add(run);
    try {
      await houseRunner.run(agentId, {
        competition: c, signal: controller.signal,
        uploadAsset: (asset, key) => call('POST', '/v1/assets', asset, key),
        submit: async (work, key) => {
          const s: S['Submission'] = await call('POST', `/v1/competitions/${c.id}/submissions`, work, key);
          houseSubmitted(c, agentId, s.id);
          return s;
        },
        progress: (label, opts) => reportProgress(c.id, agentId, label, opts?.immediate, opts?.colors, opts?.structure),
        timeLeftMs: () => Date.parse(c.submission_deadline!) - time(),
        // Waits for this agent's own check, then reads the result through the public API like an outside agent would.
        waitForResult: async (submissionId) => {
          for (;;) {
            if (controller.signal.aborted) throw new Error('submission deadline');
            const s = submissions.get(submissionId);
            if (!s) throw new Error('submission not found');
            if (s.qualification_status !== 'pending') return call('GET', `/v1/submissions/${submissionId}`, undefined, '');
            await evaluatePending();
            const evaluation = evalRuns.get(submissionId);
            await (evaluation ?? new Promise(r => setTimeout(r, 500)));
          }
        },
      }, {
        // Remote: persist the run ID before waiting, so a restarted API can re-attach to it (resumeHouseRuns).
        started: runId => exclusive(async () => { houseRuns.set(run, { competition_id: c.id, agent_id: agentId, task_run_id: runId, state: 'running', started_at: stamp() }); }),
      });
    } catch (e) { log(`house agent ${agentId} on ${c.id} failed`, (e as Error).message); }
    finally { clearTimeout(timer); await finishHouseRun(c, agentId); }
  }

  /** A house agent's run is over: settle its placeholder honestly and mark a remote run finished. */
  async function finishHouseRun(c: S['Competition'], agentId: string) {
    const run = `${c.id}:${agentId}`;
    activeRuns.delete(run);
    const cur = buildProgress.get(c.id)?.get(agentId);
    // Never submitted (or declined): the placeholder goes away. Stopped after a failed attempt: it says so.
    if (cur?.state === 'building' && !cur.submission_id) buildProgress.get(c.id)!.delete(agentId);
    else if (cur?.state === 'building' || cur?.state === 'revising') setProgress(c.id, agentId, "didn't qualify", 'not_qualified');
    const r = houseRuns.get(run);
    if (r?.state === 'running') await exclusive(async () => { r.state = 'finished'; });
  }

  /**
   * After a restart: a remote build may still be running on Render. Re-attach by its persisted run ID, show the buyer
   * an honest placeholder (building, or where its latest entry stands), and wait for the run to end. Runs whose
   * submission window has closed are canceled instead.
   */
  async function resumeHouseRuns() {
    for (const r of houseRuns.values()) {
      if (r.state !== 'running') continue;
      const c = competitions.get(r.competition_id);
      if (!c || c.state !== 'open' || time() >= Date.parse(c.submission_deadline!)) { await cancelHouseRun(r); continue; }
      const key = `${c.id}:${r.agent_id}`;
      activeRuns.add(key);
      const mine = compSubmissions(c).filter(x => x.agent_id === r.agent_id).sort((a, b) => a.created_at.localeCompare(b.created_at));
      const latest = mine.at(-1);
      if (!latest) setProgress(c.id, r.agent_id, STEP.planning, 'building');
      else {
        setProgress(c.id, r.agent_id, STEP.submitted, 'submitted', latest.id);
        buildProgress.get(c.id)!.get(r.agent_id)!.attempt = mine.length;
        settleProgress(latest); // failed with time left: "revising" (the run is active); qualified: "qualified"
      }
      log(`house agent ${r.agent_id} on ${c.id}: re-attached to run ${r.task_run_id}`);
      track((async () => {
        try { await houseRunner.wait!(r.task_run_id); }
        catch (e) { log(`house run ${r.task_run_id} wait failed`, (e as Error).message); }
        finally { await finishHouseRun(c, r.agent_id); }
      })());
    }
  }
  /** Stop a remote build (its submission window closed). The waiter sees it canceled and settles the placeholder. */
  async function cancelHouseRun(r: { task_run_id: string; state: string }) {
    if (r.state !== 'running') return;
    await exclusive(async () => { r.state = 'canceled'; });
    try { await houseRunner.cancel!(r.task_run_id); } catch (e) { log(`cancel house run ${r.task_run_id} failed`, (e as Error).message); }
  }

  // ---------------------------------------------------------------- worker: evaluation + provider operations
  const evaluating = new Set<string>();
  const evalRuns = new Map<string, Promise<unknown>>();
  /** A real-browser render: buyers only ever get these screenshots from now on, and the judge gets measured facts. */
  function applyShots(assetId: string, submissionId: string, r: RenderedPage) {
    const asset = assets.get(assetId)!;
    asset.shots = { desktop: r.desktop_base64, phone: r.phone_base64, desktopHeight: r.desktopHeight, phoneHeight: r.phoneHeight };
    asset.browser = { renderer: r.renderer, phoneOverflowPx: r.phoneOverflowPx, consoleErrors: r.consoleErrors, blockedRequests: r.blockedRequests, focus: r.focus,
      phoneLayout: r.phoneLayout, loadMs: r.loadMs, renderMs: r.renderMs,
      replay: r.replay ? { id: r.replay.id, url: r.replay.url, expires_at: at(time() + r.replay.retentionMs) } : undefined };
    const preview: S['Preview'] = { ...asset.metadata.preview, mime_type: 'image/jpeg', phone_url: `${asset.metadata.preview.url}?view=phone`, width: 1280, height: r.desktopHeight };
    asset.metadata.preview = preview;
    const current = submissions.get(submissionId);
    if (current) current.artifacts = current.artifacts.map(a => a.asset_id === assetId ? { ...a, preview } : a);
  }
  const evalRetries = new Map<string, { n: number; at: number }>(); // Render unreachable: when to ask again (wall clock)
  async function evaluatePending() {
    const due = [...submissions.values()].filter(s => s.qualification_status === 'pending' && !evaluating.has(s.id) && (evalRetries.get(s.id)?.at ?? 0) <= Date.now());
    for (const s of due) {
      evaluating.add(s.id);
      const evaluation = (async () => {
        const c = competitions.get(s.competition_id)!;
        const asset = assets.get(s.artifacts[0].asset_id)!;
        const job: EvaluationJob = { submission_id: s.id, competition_id: c.id, title: c.title, brief: c.brief, requirements: c.requirements, artifact: s.artifacts[0],
          original_base64: asset.original_base64, preview_html: asset.preview };
        let shotsStored = false;
        const storeShots = (r: RenderedPage) => exclusive(async () => { applyShots(asset.metadata.id, s.id, r); shotsStored = true; });
        let outcome;
        try { outcome = await evaluationRunner.evaluate(job, { onRendered: storeShots }); evalRetries.delete(s.id); }
        catch (e) {
          if (e instanceof RunnerUnavailable) { // nothing known yet: stay pending, retry with backoff (the idempotency key re-attaches)
            const n = (evalRetries.get(s.id)?.n ?? 0) + 1;
            evalRetries.set(s.id, { n, at: Date.now() + Math.min(60_000, (o.runnerRetryMs ?? 2000) * 2 ** n) });
            log(`evaluation of ${s.id} deferred (attempt ${n})`, e.message);
            return;
          }
          log(`${evaluationRunner.name} evaluation failed on ${s.id}`, (e as Error).message);
          outcome = { rendered: null, result: errorVerdict(evaluationRunner.version) };
        }
        if (outcome.rendered && !shotsStored) await storeShots(outcome.rendered);
        const result: S['QualificationResult'] = { ...outcome.result, artifact_hashes: digests(s) }; // bind to the server-computed digests, never evaluator claims
        if (result.status !== 'qualified') delete result.narrative; // buyers never see failed entries, so neither is a narrative kept
        await exclusive(async () => {
          const current = submissions.get(s.id);
          if (current?.qualification_status === 'pending' && time() < Date.parse(c.qualification_deadline!)) { current.qualification_status = result.status; current.qualification = result; }
          if (current) settleProgress(current);
        });
      })().finally(() => { evaluating.delete(s.id); evalRuns.delete(s.id); });
      evalRuns.set(s.id, evaluation);
      track(evaluation);
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
        let a: AuthorizationView; let refusal: string | null = null;
        try { a = await o.provider.voidAuthorization(pay!.provider_authorization_id!, op.request_id); }
        catch (e) {
          if (!(e instanceof ProviderError) || e.kind !== 'definitive') throw e;
          // PayPal refused the void: ask what the authorization is now (VOIDED, EXPIRED or CAPTURED) instead of waiting forever.
          refusal = e.issue ?? 'VOID_REFUSED';
          a = await o.provider.getAuthorization(pay!.provider_authorization_id!);
          op.last_error = e.message;
        }
        await exclusive(async () => {
          applyAuthorizationStatus(pay!, a.status, refusal);
          op.state = refusal && !['voided', 'expired'].includes(pay!.authorization_state) ? 'failed' : 'succeeded'; op.updated_at = stamp();
          if (op.state === 'failed') log(`void refused for ${pay!.id}`, `${refusal}; PayPal says the authorization is ${a.status}`);
          tick();
        });
      } else if (op.kind === 'refund') {
        const r = await o.provider.refundCapture(pay!.provider_capture_id!, refunds.get(op.refund_id!)!.amount.amount_minor, op.request_id);
        await exclusive(async () => {
          const refund = refunds.get(op.refund_id!)!; refund.provider_refund_id = r.id;
          if (r.status === 'COMPLETED') { applyRefunded(pay!, refund.amount.amount_minor, r.id); refund.state = 'completed'; op.state = 'succeeded'; }
          else { refund.state = 'pending'; op.state = 'waiting'; op.next_at = time() + 10_000; }
        });
      } else if (op.kind === 'payout') {
        const alloc = allocations.get(op.allocation_id!)!;
        if (alloc.payout_state === 'blocked') { await exclusive(async () => { op.state = 'failed'; op.last_error = 'Payout blocked by a refund/dispute hold.'; }); return; }
        if (!alloc.provider_payout_id) {
          const recipient = [...operators.values()].find(x => x.recipient_id === alloc.recipient_id);
          if (!recipient?.paypal_payer_id) { await exclusive(async () => { alloc.payout_state = 'failed'; alloc.payout_detail = op.last_error = 'Operator has no verified PayPal account.'; op.state = 'failed'; }); return; }
          const c = competitions.get(alloc.competition_id)!;
          const r = await o.provider.sendPayout({ batchId: op.request_id.replace(/-/g, '').slice(0, 30), payerId: recipient.paypal_payer_id, amountMinor: alloc.amount.amount_minor,
            subject: 'You won a brief on provable.bid', note: `Your agent's site was selected for "${c.title}". Competition ${c.id}.` });
          await exclusive(async () => {
            alloc.provider_payout_id = r.batchId; alloc.payout_state = 'pending'; op.state = 'waiting'; op.next_at = time() + 4000;
            // A retry after a lost response: PayPal already had this sender_batch_id, so we track that batch instead of failing.
            if (r.existing) log(`payout ${op.id}: PayPal already had batch ${r.batchId} for this sender_batch_id; tracking it`);
          });
        } else {
          const r = await o.provider.getPayout(alloc.provider_payout_id);
          await exclusive(async () => applyPayout(alloc, op, r));
        }
      }
    } catch (e) {
      await exclusive(async () => {
        const capture = op.kind === 'capture_authorization' || op.kind === 'capture_order';
        // Do not let a late timeout overwrite a capture the webhook already confirmed while this call was in flight.
        if (capture && pay?.capture_state === 'completed') { op.state = 'succeeded'; op.last_error = null; op.updated_at = stamp(); return; }
        const unknown = !(e instanceof ProviderError) || e.kind === 'unknown';
        op.last_error = (e as Error).message; op.updated_at = stamp();
        if (unknown && (op.attempts < 12 || capture)) {
          op.state = 'unknown';
          // Exhausting retries proves only that we could not read the answer. Stop automatic mutation retries, keep
          // delivery locked and await canonical webhook/manual reconciliation; never void a possibly captured payment.
          const manual = capture && op.attempts >= 12;
          op.next_at = manual ? Number.MAX_SAFE_INTEGER : backoff(op.attempts);
          if (pay) { pay.operation_state = 'unknown'; pay.updated_at = stamp(); if (manual) pay.last_error_code = 'CAPTURE_OUTCOME_REQUIRES_RECONCILIATION'; }
        }
        else {
          op.state = 'failed';
          if (pay && (op.kind === 'capture_authorization' || op.kind === 'capture_order')) failCapture(pay, e instanceof ProviderError ? e.issue ?? 'DECLINED' : 'INTERNAL');
          if (pay && op.kind === 'void') { pay.operation_state = 'failed'; pay.last_error_code = e instanceof ProviderError ? e.issue : 'INTERNAL'; }
          if (op.kind === 'payout') {
            const a = allocations.get(op.allocation_id!);
            // PayPal has a batch with our sender_batch_id but didn't say which: money may have moved, so don't call it failed.
            if (a && e instanceof ProviderError && e.issue === 'DUPLICATE_SENDER_BATCH_ID') { a.payout_state = 'pending'; a.payout_detail = `Needs a manual check in PayPal: ${e.message}`.slice(0, 300); }
            else if (a) { a.payout_state = 'failed'; a.payout_detail = (e as Error).message.slice(0, 300); }
          }
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

  /**
   * Verified webhook: re-read the canonical PayPal resource and apply it. Never trust the event payload for money state:
   * the event only says which resource to read. Throws if PayPal can't be read, so the event stays queued and is retried.
   * Returns work to run after the state change is flushed (agent notifications).
   */
  async function reconcileFromEvent(ref: EventRef): Promise<(() => void) | void> {
    const { type } = ref;
    const paymentByCapture = (captureId: string | null) => captureId ? [...payments.values()].find(x => x.provider_capture_id === captureId) : undefined;
    const paymentByOrder = (orderId: string | null) => orderId ? [...payments.values()].find(x => x.provider_order_id === orderId) : undefined;
    const notFound = (e: unknown) => { if (e instanceof ProviderError && e.status === 404) return null; throw e; };

    if (type === 'PAYMENT.CAPTURE.REFUNDED' || type === 'PAYMENT.CAPTURE.REVERSED') {
      // The resource is a refund: no supplementary_data, and its capture only in links[rel=up]. Re-read both.
      const refund = ref.resource_id ? await o.provider.getRefund(ref.resource_id).catch(notFound) : null;
      const captureId = ref.up_capture_id ?? refund?.captureId ?? null;
      const pay = paymentByCapture(captureId);
      if (!pay || !captureId) return;
      const cap = await o.provider.getCapture(captureId);
      await exclusive(async () => {
        const settled = refund?.status === 'COMPLETED';
        if (type === 'PAYMENT.CAPTURE.REVERSED' || cap.status === 'REVERSED') {
          if (cap.status === 'REVERSED' || settled) applyReversed(pay, settled ? refund!.amountMinor : pay.captured_minor);
          else if (pay.reversal_state === 'none') { pay.reversal_state = 'pending'; pay.updated_at = stamp(); holdAllocations(pay, false); }
        } else if (settled) applyRefunded(pay, refund!.amountMinor, refund!.id, refund!.totalRefundedMinor);
        else if (cap.status === 'REFUNDED') applyRefunded(pay, 0, null, pay.captured_minor);
        else if (cap.status === 'PARTIALLY_REFUNDED' && pay.refund_state === 'none') applyRefunded(pay, 0);
      });
    } else if (type.startsWith('PAYMENT.CAPTURE.')) {
      const pay = paymentByCapture(ref.resource_id) ?? paymentByOrder(ref.order_id);
      if (!pay || !ref.resource_id) return;
      const cap = await o.provider.getCapture(ref.resource_id);
      await exclusive(async () => {
        if (cap.status === 'COMPLETED') completeCapture(pay, cap);
        else if (['DECLINED', 'FAILED'].includes(cap.status)) { if (pay.capture_state !== 'failed') failCapture(pay, `CAPTURE_${cap.status}`); }
        else if (cap.status === 'PENDING' && !pay.provider_capture_id) pay.provider_capture_id = cap.id;
        else if (cap.status === 'REFUNDED') applyRefunded(pay, 0, null, pay.captured_minor);
        else if (cap.status === 'PARTIALLY_REFUNDED' && pay.refund_state === 'none') applyRefunded(pay, 0);
        else if (cap.status === 'REVERSED') applyReversed(pay, pay.captured_minor);
      });
    } else if (type.startsWith('PAYMENT.AUTHORIZATION.')) {
      if (!ref.resource_id) return;
      // CREATED can arrive while our own authorize call timed out: find the payment by order ID and finish opening it.
      const pay = [...payments.values()].find(x => x.provider_authorization_id === ref.resource_id) ?? paymentByOrder(ref.order_id);
      if (!pay || (pay.provider_authorization_id && pay.provider_authorization_id !== ref.resource_id)) return;
      const a = await o.provider.getAuthorization(ref.resource_id);
      return exclusive(async () => {
        const c = competitions.get(pay.competition_id);
        if (c && !c.opens_at && c.state === 'awaiting_authorization' && pay.purpose === 'initial' && ['none', 'pending', 'failed'].includes(pay.authorization_state)) {
          try {
            const opened = openWithAuthorization(c, pay, a);
            log(`competition ${c.id} opened from PAYMENT.AUTHORIZATION webhook`, a.id);
            return () => announce(opened);
          } catch (e) {
            if (!(e instanceof Fault)) throw e;
            log(`authorization ${a.id} from webhook not usable`, e.message); // the buyer's own authorize call reports why
            return;
          }
        }
        applyAuthorizationStatus(pay, a.status); tick();
      });
    } else if (type.startsWith('CUSTOMER.DISPUTE.')) {
      // Re-read from the Disputes API (the app's own token can; no extra scope). Every dispute on the capture counts.
      const definitive = (e: unknown) => e instanceof ProviderError && e.kind === 'definitive';
      let dispute: Awaited<ReturnType<PaymentProvider['getDispute']>> | null = null;
      try { dispute = ref.dispute_id ? await o.provider.getDispute(ref.dispute_id) : null; }
      catch (e) {
        if (!definitive(e)) throw e;
        // PayPal won't show us this dispute: the signed event still proves one exists, so hold (never release on the body alone).
        const held = ref.disputed_capture_ids.map(paymentByCapture).find(Boolean);
        if (held && (held.dispute_state === 'none' || held.dispute_state === 'won')) await exclusive(async () => applyDispute(held, 'open'));
        log(`dispute ${ref.dispute_id} not readable; ${held ? 'payment held' : 'no matching payment'}`, (e as Error).message);
        return;
      }
      const captureIds = dispute?.captureIds.length ? dispute.captureIds : ref.disputed_capture_ids;
      const pay = captureIds.map(paymentByCapture).find(Boolean);
      if (!pay) return;
      // The list adds the other disputes on the capture; if PayPal refuses the filter, decide from this dispute alone.
      const listed = await o.provider.listDisputes(pay.provider_capture_id!).catch(e => { if (definitive(e) && dispute) return []; throw e; });
      const all = new Map(listed.map(d => [d.id, d]));
      if (dispute) all.set(dispute.id, dispute);
      if (!all.size) return;
      const cap = [...all.values()].some(d => d.outcome === 'RESOLVED_WITH_PAYOUT') ? await o.provider.getCapture(pay.provider_capture_id!) : null;
      const verdict = disputeVerdict([...all.values()], cap?.status ?? null);
      await exclusive(async () => applyDispute(pay, verdict));
    } else if (type.startsWith('PAYMENT.PAYOUTS-ITEM.') || type.startsWith('PAYMENT.PAYOUTSBATCH.')) {
      const alloc = ref.payout_batch_id ? [...allocations.values()].find(x => x.provider_payout_id === ref.payout_batch_id) : undefined;
      if (!alloc) return;
      // Re-read even after the op finished: RETURNED, REFUNDED and REVERSED arrive after SUCCESS/UNCLAIMED.
      const r = await o.provider.getPayout(alloc.provider_payout_id!);
      await exclusive(async () => applyPayout(alloc, [...ops.values()].filter(x => x.kind === 'payout' && x.allocation_id === alloc.id).at(-1), r));
    }
  }

  /** Queued webhook events, oldest first. Marked handled only once reconcile succeeded; failures back off and retry. */
  async function processWebhookEvents() {
    const due = [...webhookEvents.entries()].filter(([, e]) => e.state === 'queued' && e.ref && (e.next_at ?? 0) <= time())
      .sort((a, b) => a[1].received_at.localeCompare(b[1].received_at));
    for (const [eventId, e] of due) {
      try {
        const after = await reconcileFromEvent(e.ref!);
        await exclusive(async () => { e.state = 'handled'; e.handled_at = stamp(); e.last_error = null; });
        if (after) after();
      } catch (err) {
        await exclusive(async () => {
          e.attempts = (e.attempts ?? 0) + 1; e.last_error = (err as Error).message;
          // After ~20 minutes of failures stop; PayPal's own redelivery (up to 3 days) re-queues it.
          if (e.attempts >= 25) { e.state = 'failed'; log(`webhook ${eventId} gave up`, e.last_error); }
          else { e.next_at = backoff(e.attempts); log(`webhook ${eventId} reconcile failed, will retry`, e.last_error); }
        });
      }
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
        await processWebhookEvents();
        // Remote house builds stop at the submission deadline (the task also stops itself just before it).
        for (const r of houseRuns.values()) {
          const c = r.state === 'running' ? competitions.get(r.competition_id) : undefined;
          if (r.state === 'running' && (!c || time() >= Date.parse(c.submission_deadline!))) await cancelHouseRun(r);
        }
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
    if (status === 429 || status === 503) reply.header('Retry-After', String(e instanceof Fault ? e.retryAfterSeconds : 1));
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
      const respond = (r: Result) => {
        if (r.status !== 302) {
          try { validateResponse(op, r.status, r.type ?? 'application/json', r.body); }
          catch (e) { if (o.strictResponses !== false) throw e; log(`contract drift in ${op.operationId}`, (e as Error).message); }
        }
        return r;
      };
      const result = OUTSIDE_QUEUE.has(op.operationId)
        ? respond(await execute(op.operationId, principal, req.params, req.body, query, headers)) // read-only, no idempotency replay
        : await exclusive(async () => {
        const key = headers['idempotency-key'];
        const subject = principal ? (principal.role === 'agent' ? `agent:${principal.agent_id}` : `${principal.role}:${principal.id}`) : 'public';
        const scope = op.method === 'post' && key && op.operationId !== 'createBuyerSession' ? `${subject}|post|${req.url.split('?')[0]}|${key}` : null;
        const fingerprint = canonical(req.body);
        const cached = scope ? replays.get(scope) : undefined;
        if (cached) {
          demand(cached.fingerprint === fingerprint, 'IDEMPOTENCY_CONFLICT', 'Key was used with a different request body.');
          return { status: cached.status, body: structuredClone(cached.body), cache: cached.cache } as Result;
        }
        const pending = scope ? outsideReplies.get(scope) : undefined;
        if (pending) {
          demand(pending.fingerprint === fingerprint, 'IDEMPOTENCY_CONFLICT', 'Key was used with a different request body.');
          return { status: 200, outside: pending.finish } as Result;
        }
        tick();
        const r = await execute(op.operationId, principal, req.params, req.body, query, headers);
        if (r.outside) {
          // The slow part runs after this lock is released; an answered turn is kept for replay under its key.
          const perform = r.outside;
          let answer: Promise<Result> | undefined;
          const finish = () => answer ??= (async () => {
            try {
              const done = await perform();
              if (scope && done.status < 300) await exclusive(async () => { replays.set(scope, { fingerprint, status: done.status, body: structuredClone(done.body), cache: done.cache }); });
              return done;
            } finally { if (scope) outsideReplies.delete(scope); }
          })();
          if (scope) outsideReplies.set(scope, { fingerprint, finish });
          return { ...r, outside: finish };
        }
        respond(r);
        if (scope && r.status < 300) replays.set(scope, { fingerprint, status: r.status, body: structuredClone(r.body), cache: r.cache });
        after = r.after;
        return r;
      });
      if (after) after();
      if (result.outside) {
        const r = respond(await result.outside());
        Object.assign(result, r, { outside: undefined });
      }
      if (result.status === 302) return reply.redirect(result.location!, 302);
      if (result.cache) reply.header('Cache-Control', result.cache).header('X-Content-Type-Options', 'nosniff');
      if (result.type === 'text/html') reply.header('Content-Security-Policy', "sandbox allow-scripts; default-src 'none'; img-src data: https:; style-src 'unsafe-inline' https:; script-src 'unsafe-inline'; font-src data: https:");
      return reply.type(result.type ?? 'application/json').status(result.status).send(result.body);
    },
  });

  // A house agent building on another instance (Render Workflows) reports its coarse build steps here. Not part of the
  // public contract: house-agent credentials only, and reportProgress sanitizes every field as it does in-process.
  if (houseRunner.remote) app.post('/internal/house-progress', async (req, reply) => {
    const bearer = /^Bearer ([A-Za-z0-9_-]+)$/.exec(String(req.headers.authorization ?? ''));
    const p = resolvePrincipal(bearer?.[1], credentials, null);
    const body = (req.body ?? {}) as { competition_id?: unknown; label?: unknown; immediate?: unknown; colors?: unknown; structure?: unknown };
    const c = typeof body.competition_id === 'string' ? competitions.get(body.competition_id) : undefined;
    if (p?.role !== 'agent' || !agents.get(p.agent_id)?.profile.internal || !c || c.state !== 'open') return reply.status(404).send({ accepted: false });
    reportProgress(c.id, p.agent_id, typeof body.label === 'string' ? body.label : '', body.immediate === true, body.colors, body.structure);
    return reply.status(202).send({ accepted: true });
  });

  // Evaluation runs on Render Workflows fetch their job here (by submission ID), so the private original never sits in
  // Render's retained run arguments. Evaluator credential derived from WORKFLOWS_SECRET; pending submissions only.
  const evalToken = o.workflowsSecret ? evaluatorToken(o.workflowsSecret) : null;
  if (evalToken && evaluationRunner.remote) app.get('/internal/evaluation-jobs/:submission_id', async (req, reply) => {
    const given = Buffer.from(String(req.headers.authorization ?? '').replace(/^Bearer /, ''));
    const want = Buffer.from(evalToken);
    const s = submissions.get((req.params as { submission_id: string }).submission_id);
    if (given.length !== want.length || !timingSafeEqual(given, want) || !s || s.qualification_status !== 'pending') return reply.status(404).send({ found: false });
    const c = competitions.get(s.competition_id)!;
    const asset = assets.get(s.artifacts[0].asset_id)!;
    const job: EvaluationJob = { submission_id: s.id, competition_id: c.id, title: c.title, brief: c.brief, requirements: c.requirements, artifact: s.artifacts[0], original_base64: asset.original_base64, preview_html: asset.preview };
    return reply.header('Cache-Control', 'no-store').send(job);
  });

  if (houseRunner.remote) await resumeHouseRuns();

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
