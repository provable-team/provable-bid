import Fastify from 'fastify';
import cors from '@fastify/cors';
import { randomUUID } from 'node:crypto';
import { prepareAsset, type PrivateAsset } from './media.js';
import { creativeAgents, creativeFixture } from './fixtures.js';
import { operations, resolve, validator, validateResponse } from '../../../scripts/contract.js';
import type { components } from '../../../packages/api-client/src/schema.js';

import { principals, internalPrincipal, type Principal } from './identity.js';

type S = components['schemas'];
class Fault extends Error {
  constructor(public status: number, public code: S['Problem']['code'], message: string) { super(message); }
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
const artifactDigests = (s: S['Submission']): S['ArtifactDigest'][] => s.artifacts.map(a => ({ asset_id: a.asset_id, sha256: a.sha256 }));

/** In-memory executable contract fixture. No PayPal/AI/storage/payout integration. */
export async function createMock(options: { now?: () => number; authorizationAgeSeconds?: number } = {}) {
  const app = Fastify({ logger: false, bodyLimit: 3_000_000, requestIdHeader: false });
  await app.register(cors, { origin: ['http://localhost:3000', 'http://127.0.0.1:3000'], exposedHeaders: ['X-Request-Id'] });
  let offset = 0;
  const time = () => (options.now?.() ?? Date.now()) + offset;
  const stamp = () => new Date(time()).toISOString();
  const at = (ms: number) => new Date(ms).toISOString();
  const urlFor = (path: string) => {
    const address = app.server.address();
    const port = address && typeof address === 'object' ? address.port : 4010;
    return `http://127.0.0.1:${port}${path}`;
  };
  const health = (): S['Health'] => ({ status: 'ok', mode: 'mock', server_time: stamp() });
  const policy: S['Policy'] = { terms_version: 'sandbox-v2', participation_allocation_basis: 'qualified_agent', participation_fee_bps: 1000, commission_bps: 1000, expense_cap_minor: 0, qualification_grace_seconds: 120 };
  const competitions = new Map<string, S['Competition']>();
  const buyerOperators = new Map<string, string | null>();
  const submissions = new Map<string, S['Submission']>();
  const assets = new Map<string, PrivateAsset>();
  const submissionAccounting = new Map<string, { operator_id: string; recipient_id: string }>();
  const runs = new Map<string, S['AgentRun']>();
  const payments = new Map<string, S['Payment']>();
  const purchases = new Map<string, S['Purchase']>();
  const refunds = new Map<string, S['Refund']>();
  const allocations = new Map<string, S['Allocation']>();
  const checkouts = new Map<string, S['Checkout']>();
  const supersededCheckouts = new Map<string, S['Checkout']>();
  const deliveries = new Map<string, { purchase: string; asset: string; buyer: string; expires: number }>();
  const replays = new Map<string, { fingerprint: string; status: number; body: unknown; cache?: string }>();
  const webhookEvents = new Set<string>();
  // Serialize local fixture commands, including asynchronous image decoding. The real
  // backend uses DB uniqueness/row locks; this queue supplies no durable guarantee.
  let tail = Promise.resolve();
  async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try { return await fn(); } finally { release(); }
  }
  const fetchOne = <T>(map: Map<string, T>, key: string): T => {
    const value = map.get(key);
    demand(value, 'NOT_FOUND', 'Resource not found.', 404);
    return value;
  };
  const view = <T extends object>(value: T): T => structuredClone({ ...value, server_time: stamp() });
  const owner = (c: S['Competition'], p: Principal) => demand(p.role === 'buyer' && c.buyer_id === p.id, 'NOT_FOUND', 'Resource not found.', 404);
  const admin = (p: Principal) => demand(p.role === 'admin', 'FORBIDDEN', 'Admin credential required.', 403);
  const readCompetition = (c: S['Competition'], p: Principal) => demand(c.opens_at || p.id === c.buyer_id || p.role === 'admin', 'NOT_FOUND', 'Resource not found.', 404);
  const readPayment = (p: S['Payment'], who: Principal) => demand(p.buyer_id === who.id || who.role === 'admin', 'NOT_FOUND', 'Resource not found.', 404);
  const compSubmissions = (c: S['Competition']) => [...submissions.values()].filter(s => s.competition_id === c.id);
  function canReadSubmission(s: S['Submission'], p: Principal) {
    const c = fetchOne(competitions, s.competition_id);
    return p.role === 'admin' || (p.role === 'agent' && s.agent_id === p.agent_id) || (p.role === 'buyer' && c.buyer_id === p.id && s.qualification_status === 'qualified');
  }
  function submissionView(s: S['Submission'], p: Principal): S['Submission'] {
    const result = view(s);
    if (p.role === 'buyer' && result.qualification) {
      // Evaluator text has access to private originals. Never use it as a second
      // preview channel: all buyer-visible explanation strings are platform-owned.
      const qualification = result.qualification;
      result.qualification = {
        ...qualification,
        reason: qualification.status === 'qualified' ? 'All objective requirements satisfied.' : 'Qualification did not pass.',
        evaluator_version: 'public-summary-v1',
        checks: qualification.checks.map(check => ({ ...check, reason: check.passed ? 'Requirement satisfied.' : 'Requirement not satisfied.' })),
      };
    }
    return result;
  }
  function requireOpen(c: S['Competition']) {
    demand(c.state === 'open' && time() < Date.parse(c.submission_deadline!), 'DEADLINE_PASSED', 'Submission window is not open.');
  }
  async function ingest(input: S['UploadAsset'], who: Principal): Promise<S['Asset']> {
    demand(who.role === 'agent', 'FORBIDDEN', 'Agent credential required.', 403);
    const c = fetchOne(competitions, input.competition_id); readCompetition(c, who); requireOpen(c);
    demand(buyerOperators.get(c.id) !== who.operator_id, 'FORBIDDEN', 'Buyer operator cannot compete in its own competition.', 403);
    demand([...assets.values()].filter(a => a.metadata.competition_id === c.id && a.metadata.owner_agent_id === who.agent_id).length < 3, 'INVALID_STATE', 'At most three staged assets per agent/competition.');
    let prepared: Awaited<ReturnType<typeof prepareAsset>>;
    try { prepared = await prepareAsset(input); } catch {
      throw new Fault(400, 'VALIDATION_ERROR', 'Asset bytes, media type, or dimensions do not meet the contract.');
    }
    // Decoding is asynchronous; acceptance still requires server time before cutoff.
    requireOpen(c);
    const assetId = id('asset');
    const metadata: S['Asset'] = {
      id: assetId, competition_id: c.id, owner_agent_id: who.agent_id, type: input.type, mime_type: input.mime_type,
      size_bytes: prepared.original.length, sha256: prepared.sha256, width: prepared.width, height: prepared.height,
      preview: { url: urlFor(`/v1/assets/${assetId}/preview`), mime_type: input.type === 'text' ? 'text/plain' : 'image/png',
        width: prepared.previewWidth, height: prepared.previewHeight, text_excerpt: prepared.excerpt },
      created_at: stamp(), server_time: stamp(),
    };
    assets.set(assetId, { metadata, original: prepared.original, preview: prepared.preview });
    return metadata;
  }
  function submit(c: S['Competition'], who: Principal, title: string, refs: { asset_id: string }[]): S['Submission'] {
    demand(who.role === 'agent', 'FORBIDDEN', 'Agent credential required.', 403);
    requireOpen(c);
    demand(buyerOperators.get(c.id) !== who.operator_id, 'FORBIDDEN', 'Buyer operator cannot compete in its own competition.', 403);
    demand(!compSubmissions(c).some(s => s.agent_id === who.agent_id), 'DUPLICATE_SUBMISSION', 'One immutable submission per registered agent identity.');
    demand(new Set(refs.map(x => x.asset_id)).size === refs.length, 'VALIDATION_ERROR', 'Artifact asset IDs must be distinct.', 400);
    const originals = refs.map(r => fetchOne(assets, r.asset_id));
    demand(originals.every(a => a.metadata.owner_agent_id === who.agent_id && a.metadata.competition_id === c.id), 'NOT_FOUND', 'Resource not found.', 404);
    demand(originals.reduce((sum, a) => sum + a.original.length, 0) <= 3_145_728, 'VALIDATION_ERROR', 'Submission originals exceed 3 MiB.', 400);
    const artifacts: S['Artifact'][] = originals.map(({ metadata: a }) => ({
      asset_id: a.id, type: a.type, mime_type: a.mime_type, size_bytes: a.size_bytes, sha256: a.sha256,
      width: a.width, height: a.height, preview: a.preview,
    }));
    const s: S['Submission'] = { id: id('sub'), competition_id: c.id, agent_id: who.agent_id, operator_id: who.operator_id,
      title, artifacts, qualification_status: 'pending', qualification: null, created_at: stamp(), server_time: stamp() };
    submissions.set(s.id, s);
    submissionAccounting.set(s.id, { operator_id: who.operator_id, recipient_id: who.recipient_id });
    return s;
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
    return view({ ...p, status, delivery_unlocked: entitled(pay) });
  }
  function update(c: S['Competition']) { c.version++; }
  function makePayment(c: S['Competition'], purpose: S['Payment']['purpose']): S['Payment'] {
    const p: S['Payment'] = {
      id: id('pay'), competition_id: c.id, buyer_id: c.buyer_id, purpose, amount: { ...c.bid },
      authorization_state: purpose === 'additional_purchase' ? 'not_applicable' : 'none',
      capture_state: 'none', operation_state: 'idle', operation_id: null,
      provider_order_id: id('MOCK_ORDER'), provider_authorization_id: null, provider_capture_id: null,
      authorized_at: null, authorization_expires_at: null, captured_minor: 0, refunded_minor: 0,
      refund_state: 'none', dispute_state: 'none', reversal_state: 'none', reversed_minor: 0, provider_expense_minor: null, last_error_code: null,
      created_at: stamp(), updated_at: stamp(), server_time: stamp(),
    };
    payments.set(p.id, p);
    const checkout: S['Checkout'] = {
      payment_id: p.id, provider_order_id: p.provider_order_id!, intent: purpose === 'initial' ? 'AUTHORIZE' : 'CAPTURE',
      approval_url: urlFor(`/mock-approval?payment_id=${p.id}&order_id=${p.provider_order_id}`),
      expires_at: purpose === 'initial' ? at(time() + 600_000) : c.decision_deadline!, server_time: stamp(),
    };
    checkouts.set(p.id, checkout);
    return p;
  }
  function queueCapture(p: S['Payment'], purpose: S['Payment']['purpose']) {
    demand(p.capture_state === 'none');
    demand(p.authorization_state === 'authorized' || p.authorization_state === 'not_applicable', 'PAYMENT_NOT_READY', 'Authorization is not available.');
    p.purpose = purpose;
    p.capture_state = 'pending'; p.operation_state = 'queued'; p.operation_id = id('op'); p.updated_at = stamp();
  }
  function voidAuthorization(p: S['Payment']) {
    if (p.capture_state !== 'none' || p.authorization_state !== 'authorized') return;
    // Local fixture confirms the void immediately; real adapter persists void_pending first.
    p.authorization_state = 'voided'; p.operation_state = 'succeeded'; p.operation_id = id('op'); p.updated_at = stamp();
  }
  function allocate(p: S['Payment']) {
    const c = fetchOne(competitions, p.competition_id);
    const existing = [...allocations.values()].filter(a => a.payment_id === p.id);
    if (existing.length) return;
    const net = captureAccounting(p).distributable_minor;
    const purchase = [...purchases.values()].find(x => x.payment_id === p.id);
    const eligible = (purchase ? [fetchOne(submissions, purchase.submission_id)]
      : compSubmissions(c).filter(s => s.qualification_status === 'qualified')).sort((a,b) => a.agent_id === b.agent_id ? 0 : a.agent_id < b.agent_id ? -1 : 1);
    demand(eligible.length > 0);
    const groups = new Map<string, { operator_id: string; recipient_id: string; shares: S['AgentShare'][] }>();
    eligible.forEach((submission, index) => {
      const recipient = fetchOne(submissionAccounting, submission.id);
      const key = `${recipient.operator_id}|${recipient.recipient_id}`;
      const group = groups.get(key) ?? { ...recipient, shares: [] };
      group.shares.push({ agent_id: submission.agent_id, amount_minor: Math.floor(net / eligible.length) + (index < net % eligible.length ? 1 : 0) });
      groups.set(key, group);
    });
    for (const recipient of [...groups.values()].sort((a,b) => a.operator_id.localeCompare(b.operator_id) || a.recipient_id.localeCompare(b.recipient_id))) {
      const a: S['Allocation'] = {
        id: id('alloc'), competition_id: c.id, payment_id: p.id, operator_id: recipient.operator_id, recipient_id: recipient.recipient_id,
        kind: purchase ? 'winner' : 'participation',
        amount: money(recipient.shares.reduce((sum, share) => sum + share.amount_minor, 0)), agent_shares: recipient.shares,
        ledger_state: 'allocated', payout_state: 'simulated', provider_payout_id: null, created_at: stamp(),
      };
      allocations.set(a.id, a);
    }
  }
  function holdAllocations(p: S['Payment'], reversed: boolean) {
    for (const a of allocations.values()) if (a.payment_id === p.id) {
      if (a.ledger_state !== 'reversed') a.ledger_state = reversed ? 'reversed' : 'held';
      a.payout_state = 'blocked';
    }
  }
  function captureAccounting(p: S['Payment']): S['CaptureAccounting'] {
    const c = fetchOne(competitions, p.competition_id);
    const commission = Math.floor(p.captured_minor * c.policy.commission_bps / 10000);
    const deducted = Math.min(p.provider_expense_minor ?? 0, c.policy.expense_cap_minor, p.captured_minor - commission);
    return { payment_id: p.id, currency: 'USD', gross_minor: p.captured_minor, commission_minor: commission,
      provider_expense_minor: p.provider_expense_minor, deducted_expense_minor: deducted,
      platform_absorbed_expense_minor: p.provider_expense_minor === null ? null : p.provider_expense_minor - deducted,
      distributable_minor: p.captured_minor - commission - deducted, expense_state: p.provider_expense_minor === null ? 'unknown' : 'confirmed' };
  }
  function tick() {
    for (const c of competitions.values()) {
      if (!c.opens_at || ['closed', 'cancelled'].includes(c.state)) continue;
      const p = fetchOne(payments, c.initial_payment_id!);
      if (p.authorization_expires_at && time() >= Date.parse(p.authorization_expires_at) && p.authorization_state === 'authorized') {
        p.authorization_state = 'expired';
      }
      if (['expired', 'voided', 'failed'].includes(p.authorization_state) && !c.first_purchase_id) {
        c.state = 'cancelled'; c.outcome = 'cancelled'; update(c); continue;
      }
      if (time() >= Date.parse(c.submission_deadline!) && c.state === 'open') { c.state = 'qualifying'; update(c); }
      if (time() >= Date.parse(c.qualification_deadline!) && c.state === 'qualifying') {
        const all = compSubmissions(c);
        for (const s of all) if (s.qualification_status === 'pending') {
          s.qualification_status = 'error';
          s.qualification = { status: 'error', checks: [], reason: 'Qualification deadline exceeded.', evaluator_version: 'mock-timeout-v1', failure_code: null, artifact_hashes: artifactDigests(s) };
        }
        if (c.first_purchase_id) { c.state = 'closed'; c.outcome = 'winner_selected'; }
        else if (all.some(s => s.qualification_status === 'error')) { c.state = 'cancelled'; c.outcome = 'infrastructure_failure'; voidAuthorization(p); }
        else if (!all.some(s => s.qualification_status === 'qualified')) { c.state = 'closed'; c.outcome = 'no_qualifiers'; voidAuthorization(p); }
        else c.state = 'deciding';
        update(c);
      }
      if (c.state === 'deciding' && time() >= Date.parse(c.decision_deadline!)) {
        c.state = 'closed'; c.outcome = 'participation_fee'; queueCapture(p, 'participation_fee'); update(c);
      }
    }
    const submitted = new Set([...submissions.values()].flatMap(s => s.artifacts.map(a => a.asset_id)));
    for (const [assetId, asset] of assets) {
      const c = competitions.get(asset.metadata.competition_id);
      if (!submitted.has(assetId) && c?.submission_deadline && time() >= Date.parse(c.submission_deadline) + 3600_000) assets.delete(assetId);
    }
  }
  function page(items: any[], query: any, decorate = true) {
    items.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id));
    const limit = query.limit ?? 20;
    const start = query.cursor ? items.findIndex(i => Buffer.from(i.id).toString('base64url') === query.cursor) + 1 : 0;
    demand(!query.cursor || start > 0, 'VALIDATION_ERROR', 'Invalid cursor.', 400);
    const slice = items.slice(start, start + limit).map(item => decorate ? view(item) : structuredClone(item));
    return { items: slice, next_cursor: start + limit < items.length ? Buffer.from(slice.at(-1).id).toString('base64url') : null, server_time: stamp() };
  }
  async function execute(op: string, p: Principal, params: any, body: any, query: any, headers: any): Promise<{ status: number; body: any; cache?: string; type?: string }> {
    const ok = (body: any, status = 200) => ({ status, body });
    switch (op) {
      case 'getHealth': return ok(health());
      case 'getConfig': return ok({ mode: 'mock', currency: 'USD', terms_version: policy.terms_version, policy,
        capabilities: { authorization: true, final_partial_capture: true, additional_checkout: true, external_agents: true, payouts: 'simulated', blockchain: false }, server_time: stamp() });
      case 'listAgents': return ok(page(creativeAgents, query, false));
      case 'getAgent': {
        const agent = creativeAgents.find(a => a.id === params.agent_id);
        demand(agent, 'NOT_FOUND', 'Agent not found.', 404); return ok(agent);
      }
      case 'uploadAsset': return ok(view(await ingest(body, p)), 201);
      case 'getAsset': {
        const asset = fetchOne(assets, params.asset_id);
        demand((p.role === 'agent' && asset.metadata.owner_agent_id === p.agent_id) || p.role === 'admin', 'NOT_FOUND', 'Resource not found.', 404);
        return ok(view(asset.metadata));
      }
      case 'getAssetPreview': {
        const asset = fetchOne(assets, params.asset_id);
        const bound = [...submissions.values()].find(s => s.artifacts.some(a => a.asset_id === asset.metadata.id));
        demand(p.role === 'admin' || (p.role === 'agent' && asset.metadata.owner_agent_id === p.agent_id) || (bound && canReadSubmission(bound, p)), 'NOT_FOUND', 'Resource not found.', 404);
        return { status: 200, body: asset.metadata.type === 'text' ? asset.preview.toString('utf8') : asset.preview,
          type: asset.metadata.preview.mime_type, cache: 'no-store' };
      }
      case 'startAgentRuns': {
        const c = fetchOne(competitions, params.competition_id);
        if (p.role !== 'admin') owner(c, p); requireOpen(c);
        const agents = (body.agent_ids as string[]).map(agentId => creativeAgents.find(a => a.id === agentId));
        demand(agents.every(a => a?.status === 'available'), 'VALIDATION_ERROR', 'Every agent must be available in the internal registry.', 400);
        demand(agents.every(a => a!.operator_id !== buyerOperators.get(c.id)), 'FORBIDDEN', 'Buyer operator cannot trigger its own competing agents.', 403);
        const result: S['AgentRun'][] = [];
        for (const agent of agents) {
          const existing = [...runs.values()].find(r => r.competition_id === c.id && r.agent_id === agent!.id);
          if (existing) { result.push(existing); continue; }
          const alreadySubmitted = compSubmissions(c).find(s => s.agent_id === agent!.id);
          const run: S['AgentRun'] = { id: id('run'), competition_id: c.id, agent_id: agent!.id, status: 'running',
            submission_id: alreadySubmitted?.id ?? null, failure_code: null, created_at: stamp(), updated_at: stamp(), server_time: stamp() };
          runs.set(run.id, run);
          try {
            if (!alreadySubmitted) {
              const fixture = await creativeFixture(agent!);
              const who = internalPrincipal(agent!.id);
              const image = await ingest({ competition_id: c.id, type: 'image', mime_type: 'image/png', content_base64: fixture.image.toString('base64') }, who);
              const text = await ingest({ competition_id: c.id, type: 'text', mime_type: 'text/plain', content_base64: Buffer.from(fixture.text).toString('base64') }, who);
              run.submission_id = submit(c, who, `Five Minute Scenes — ${agent!.name}`, [{ asset_id: image.id }, { asset_id: text.id }]).id;
            }
            run.status = 'submitted';
          } catch (error) {
            run.status = error instanceof Fault && error.code === 'DEADLINE_PASSED' ? 'expired' : 'failed';
            run.failure_code = run.status === 'expired' ? 'deadline_passed' : 'generation_failed';
          }
          run.updated_at = stamp(); result.push(run);
        }
        return ok(page(result, { limit: 100 }), 202);
      }
      case 'listAgentRuns': {
        const c = fetchOne(competitions, params.competition_id); if (p.role !== 'admin') owner(c, p);
        return ok(page([...runs.values()].filter(r => r.competition_id === c.id), query));
      }
      case 'createCompetition': {
        demand(p.role === 'buyer', 'FORBIDDEN', 'Buyer credential required.', 403);
        demand(body.accepted_terms_version === policy.terms_version, 'TERMS_MISMATCH', 'Read and accept the current policy.', 422);
        demand(new Set(body.requirements.map((r: any) => r.id)).size === body.requirements.length, 'VALIDATION_ERROR', 'Requirement IDs must be unique.', 400);
        const c: S['Competition'] = {
          id: id('cmp'), buyer_id: p.id, title: body.title, brief: body.brief, bid: body.bid, requirements: body.requirements,
          submission_window_seconds: body.submission_window_seconds, decision_window_seconds: body.decision_window_seconds,
          policy: { ...policy }, state: 'draft', outcome: 'undecided', initial_payment_id: null, first_purchase_id: null,
          created_at: stamp(), opens_at: null, submission_deadline: null, qualification_deadline: null, decision_deadline: null,
          version: 1, server_time: stamp(),
        };
        competitions.set(c.id, c); buyerOperators.set(c.id, p.operator_id ?? null); return ok(view(c), 201);
      }
      case 'listCompetitions': return ok(page([...competitions.values()].filter(c => c.opens_at || c.buyer_id === p.id || p.role === 'admin'), query));
      case 'getCompetition': { const c = fetchOne(competitions, params.competition_id); readCompetition(c, p); return ok(view(c)); }
      case 'createInitialCheckout': {
        const c = fetchOne(competitions, params.competition_id); owner(c, p);
        demand(['draft', 'awaiting_authorization'].includes(c.state));
        if (!c.initial_payment_id) { c.initial_payment_id = makePayment(c, 'initial').id; c.state = 'awaiting_authorization'; update(c); }
        const previous = fetchOne(checkouts, c.initial_payment_id);
        if (time() >= Date.parse(previous.expires_at)) {
          const payment = fetchOne(payments, c.initial_payment_id);
          // A real adapter must canonical-GET the old order and reconcile its journal
          // before reaching this branch. Never replace unknown financial outcomes.
          demand(payment.authorization_state === 'none' && payment.capture_state === 'none' && payment.provider_authorization_id === null && !['queued', 'running', 'unknown'].includes(payment.operation_state), 'PAYMENT_NOT_READY', 'Reconcile the existing order before renewing checkout.');
          supersededCheckouts.set(previous.provider_order_id, structuredClone(previous));
          payment.provider_order_id = id('MOCK_ORDER'); payment.operation_id = id('op'); payment.operation_state = 'succeeded'; payment.updated_at = stamp();
          checkouts.set(payment.id, { ...previous, provider_order_id: payment.provider_order_id,
            approval_url: urlFor(`/mock-approval?payment_id=${payment.id}&order_id=${payment.provider_order_id}`),
            expires_at: at(time() + 600_000), server_time: stamp() });
          update(c);
        }
        return ok(view(fetchOne(checkouts, c.initial_payment_id)), 201);
      }
      case 'authorizeCompetition': {
        const c = fetchOne(competitions, params.competition_id); owner(c, p);
        const pay = fetchOne(payments, c.initial_payment_id ?? 'missing');
        if (c.opens_at) return ok(view(pay), 202);
        demand(c.state === 'awaiting_authorization');
        demand(time() < Date.parse(fetchOne(checkouts, pay.id).expires_at), 'DEADLINE_PASSED', 'Checkout expired.');
        const providerCreated = time() - (options.authorizationAgeSeconds ?? 0) * 1000;
        const schedule = (c.submission_window_seconds + c.policy.qualification_grace_seconds + c.decision_window_seconds) * 1000;
        demand(time() + schedule + 900_000 < providerCreated + 3 * 86400_000, 'PAYMENT_NOT_READY', 'Provider authorization is too old for the capture safety horizon.');
        pay.authorization_state = 'authorized'; pay.authorized_at = at(providerCreated); pay.authorization_expires_at = at(providerCreated + 29 * 86400_000);
        pay.provider_authorization_id = id('MOCK_AUTH'); pay.operation_id = id('op'); pay.operation_state = 'succeeded'; pay.updated_at = stamp();
        c.opens_at = stamp(); c.submission_deadline = at(time() + c.submission_window_seconds * 1000);
        c.qualification_deadline = at(Date.parse(c.submission_deadline) + policy.qualification_grace_seconds * 1000);
        c.decision_deadline = at(Date.parse(c.qualification_deadline) + c.decision_window_seconds * 1000);
        c.state = 'open'; update(c); return ok(view(pay), 202);
      }
      case 'submitWork': {
        demand(p.role === 'agent', 'FORBIDDEN', 'Agent credential required.', 403);
        const c = fetchOne(competitions, params.competition_id); readCompetition(c, p);
        return ok(view(submit(c, p, body.title, body.artifacts)), 201);
      }
      case 'listSubmissions': {
        const c = fetchOne(competitions, params.competition_id);
        demand(p.id === c.buyer_id || p.role === 'agent' || p.role === 'admin', 'NOT_FOUND', 'Resource not found.', 404);
        return ok(page(compSubmissions(c).filter(s => canReadSubmission(s, p)).map(s => submissionView(s, p)), query));
      }
      case 'getSubmission': {
        const s = fetchOne(submissions, params.submission_id);
        demand(canReadSubmission(s, p), 'NOT_FOUND', 'Resource not found.', 404); return ok(submissionView(s, p));
      }
      case 'qualifyMockSubmission': {
        admin(p); const s = fetchOne(submissions, params.submission_id); const c = fetchOne(competitions, s.competition_id);
        demand(time() < Date.parse(c.qualification_deadline!), 'DEADLINE_PASSED', 'Qualification is frozen.');
        demand(s.qualification_status === 'pending');
        if (body.status === 'error') {
          demand(body.failure_code === null && body.checks.length === 0, 'VALIDATION_ERROR', 'Infrastructure errors have no failure code or requirement checks.', 400);
        } else if (body.status === 'failed' && ['spam', 'invalid_output'].includes(body.failure_code)) {
          demand(body.checks.length === 0, 'VALIDATION_ERROR', 'Failed prechecks precede requirement evaluation.', 400);
        } else {
          const checks = body.checks as S['QualificationCheck'][];
          demand(checks.length === c.requirements.length && new Set(checks.map(x => x.requirement_id)).size === checks.length && checks.every(x => c.requirements.some(r => r.id === x.requirement_id)), 'VALIDATION_ERROR', 'Exactly one check per requirement is required.', 400);
          demand(body.status === 'qualified' ? body.failure_code === null && checks.every(x => x.passed) : body.failure_code === 'requirements_not_met' && checks.some(x => !x.passed), 'VALIDATION_ERROR', 'Qualification status contradicts checks.', 400);
        }
        demand(body.artifact_hashes.length === s.artifacts.length && new Set(body.artifact_hashes.map((a: any) => a.asset_id)).size === s.artifacts.length && body.artifact_hashes.every((a: any) => s.artifacts.some(x => x.asset_id === a.asset_id && x.sha256 === a.sha256)), 'VALIDATION_ERROR', 'Qualification must match every frozen artifact digest.', 400);
        s.qualification_status = body.status; s.qualification = body; return ok(view(s));
      }
      case 'selectFirstWinner': {
        const c = fetchOne(competitions, params.competition_id); owner(c, p);
        if (c.first_purchase_id) {
          const existing = fetchOne(purchases, c.first_purchase_id);
          demand(existing.submission_id === body.submission_id, 'DECISION_LOCKED', 'First winner already committed.');
          return ok(purchaseView(existing), 202);
        }
        demand(['open', 'qualifying', 'deciding'].includes(c.state) && time() < Date.parse(c.decision_deadline!), 'DEADLINE_PASSED', 'Decision window is closed.');
        const s = fetchOne(submissions, body.submission_id); demand(s.competition_id === c.id && s.qualification_status === 'qualified');
        const pay = fetchOne(payments, c.initial_payment_id!); queueCapture(pay, 'first_purchase');
        const purchase: S['Purchase'] = { id: id('pur'), competition_id: c.id, submission_id: s.id, kind: 'first', price: { ...c.bid }, payment_id: pay.id,
          status: 'payment_pending', delivery_unlocked: false, checkout: null, created_at: stamp(), server_time: stamp() };
        purchases.set(purchase.id, purchase); c.first_purchase_id = purchase.id; c.outcome = 'winner_selected';
        if (c.state === 'deciding') c.state = 'closed'; update(c); return ok(purchaseView(purchase), 202);
      }
      case 'rejectAll': {
        const c = fetchOne(competitions, params.competition_id); owner(c, p);
        demand(!c.first_purchase_id, 'DECISION_LOCKED', 'First winner already committed.');
        const pay = fetchOne(payments, c.initial_payment_id!);
        if (c.outcome === 'participation_fee') return ok(view(pay), 202);
        demand(c.state === 'deciding' && time() < Date.parse(c.decision_deadline!), 'INVALID_STATE', 'Reject only after qualification finalizes.');
        queueCapture(pay, 'participation_fee'); c.state = 'closed'; c.outcome = 'participation_fee'; update(c); return ok(view(pay), 202);
      }
      case 'createAdditionalPurchase': {
        const c = fetchOne(competitions, params.competition_id); owner(c, p);
        demand(c.first_purchase_id, 'PAYMENT_NOT_READY', 'Select and pay for the first winner.');
        const first = fetchOne(purchases, c.first_purchase_id);
        demand(entitled(fetchOne(payments, first.payment_id)), 'PAYMENT_NOT_READY', 'First payment must complete without a hold.');
        demand(time() < Date.parse(c.decision_deadline!), 'DEADLINE_PASSED', 'Purchase window is closed.');
        const s = fetchOne(submissions, body.submission_id); demand(s.competition_id === c.id && s.qualification_status === 'qualified');
        demand(s.id !== first.submission_id, 'INVALID_STATE', 'First winner is already purchased.');
        const existing = [...purchases.values()].find(x => x.competition_id === c.id && x.submission_id === s.id);
        if (existing) return ok(purchaseView(existing), 201);
        const pay = makePayment(c, 'additional_purchase');
        const purchase: S['Purchase'] = { id: id('pur'), competition_id: c.id, submission_id: s.id, kind: 'additional', price: { ...c.bid }, payment_id: pay.id,
          status: 'awaiting_approval', delivery_unlocked: false, checkout: fetchOne(checkouts, pay.id), created_at: stamp(), server_time: stamp() };
        purchases.set(purchase.id, purchase); return ok(purchaseView(purchase), 201);
      }
      case 'listPurchases': {
        const c = fetchOne(competitions, params.competition_id); owner(c, p);
        return ok(page([...purchases.values()].filter(x => x.competition_id === c.id).map(purchaseView), query));
      }
      case 'getPurchase': { const purchase = fetchOne(purchases, params.purchase_id); readPayment(fetchOne(payments, purchase.payment_id), p); return ok(purchaseView(purchase)); }
      case 'captureAdditionalPurchase': {
        const purchase = fetchOne(purchases, params.purchase_id); const c = fetchOne(competitions, purchase.competition_id); owner(c, p);
        demand(purchase.kind === 'additional'); const pay = fetchOne(payments, purchase.payment_id);
        if (pay.capture_state !== 'none') return ok(purchaseView(purchase), 202);
        demand(time() < Date.parse(c.decision_deadline!), 'DEADLINE_PASSED', 'Purchase window is closed.');
        queueCapture(pay, 'additional_purchase'); return ok(purchaseView(purchase), 202);
      }
      case 'getPayment': { const pay = fetchOne(payments, params.payment_id); readPayment(pay, p); return ok(view(pay)); }
      case 'reconcilePayment': { admin(p); return ok(view(fetchOne(payments, params.payment_id)), 202); }
      case 'createDeliveryAccess': {
        const purchase = fetchOne(purchases, params.purchase_id); const pay = fetchOne(payments, purchase.payment_id);
        owner(fetchOne(competitions, purchase.competition_id), p); demand(entitled(pay), 'DELIVERY_LOCKED', 'Payment not complete or funds are held/reversed.');
        const originalArtifacts = fetchOne(submissions, purchase.submission_id).artifacts.map(a => {
          const token = id('dl'); deliveries.set(token, { purchase: purchase.id, asset: a.asset_id, buyer: p.id, expires: time() + 60_000 });
          return { asset_id: a.asset_id, url: urlFor(`/__mock/deliveries/${token}`), mime_type: a.mime_type, size_bytes: a.size_bytes };
        });
        return { status: 201, body: { artifacts: originalArtifacts, expires_at: at(time() + 60_000), server_time: stamp() }, cache: 'no-store' };
      }
      case 'downloadMockDelivery': {
        const d = fetchOne(deliveries, params.token); demand(d.buyer === p.id, 'NOT_FOUND', 'Resource not found.', 404);
        const purchase = fetchOne(purchases, d.purchase);
        demand(time() < d.expires && entitled(fetchOne(payments, purchase.payment_id)), 'DELIVERY_LOCKED', 'Delivery access is expired or revoked.');
        const asset = fetchOne(assets, d.asset);
        return { status: 200, body: asset.metadata.type === 'text' ? asset.original.toString('utf8') : asset.original, type: asset.metadata.mime_type, cache: 'no-store' };
      }
      case 'createRefund': {
        admin(p); const pay = fetchOne(payments, params.payment_id);
        demand(pay.capture_state === 'completed' && pay.captured_minor > pay.refunded_minor && pay.reversal_state === 'none' && pay.refund_state !== 'pending');
        const r: S['Refund'] = { id: id('ref'), payment_id: pay.id, amount: money(pay.captured_minor - pay.refunded_minor), reason: body.reason,
          state: 'queued', provider_refund_id: null, created_at: stamp(), server_time: stamp() };
        refunds.set(r.id, r); pay.refund_state = 'pending'; pay.updated_at = stamp(); holdAllocations(pay, false); return ok(view(r), 202);
      }
      case 'getRefund': { const r = fetchOne(refunds, params.refund_id); readPayment(fetchOne(payments, r.payment_id), p); return ok(view(r)); }
      case 'getSettlement': {
        const c = fetchOne(competitions, params.competition_id);
        demand(c.buyer_id === p.id || p.role === 'admin', 'NOT_FOUND', 'Resource not found.', 404);
        return ok({ competition_id: c.id, payout_mode: 'simulated', allocations: [...allocations.values()].filter(a => a.competition_id === c.id), accounting: [...payments.values()].filter(pay => pay.competition_id === c.id && pay.capture_state === 'completed').map(captureAccounting), server_time: stamp() });
      }
      case 'getAgentEarnings': {
        demand(p.role === 'agent', 'FORBIDDEN', 'Agent credential required.', 403);
        // Allocation has no server_time field; page helper must preserve its exact schema.
        const result = page([...allocations.values()].filter(a => {
          if (a.operator_id !== p.operator_id) return false;
          const purchase = [...purchases.values()].find(x => x.payment_id === a.payment_id);
          if (purchase) return fetchOne(submissions, purchase.submission_id).agent_id === p.agent_id;
          return [...submissions.values()].some(s => s.competition_id === a.competition_id && s.agent_id === p.agent_id && s.qualification_status === 'qualified');
        }), query);
        result.items = result.items.map(({ server_time: _time, ...a }: any) => a); return ok(result);
      }
      case 'advanceMockClock': admin(p); offset += body.seconds * 1000; tick(); return ok(health());
      case 'observeMockPayment': {
        admin(p); const pay = fetchOne(payments, params.payment_id); const observation = body.observation;
        demand(body.provider_expense_minor === undefined || observation === 'completed', 'VALIDATION_ERROR', 'Capture expenses may be recorded only with a completed observation.', 400);
        if (['expired', 'voided'].includes(observation)) {
          demand(pay.capture_state === 'none' && pay.authorization_state === 'authorized'); pay.authorization_state = observation;
        } else if (['disputed', 'dispute_won', 'dispute_lost', 'refunded', 'reversal_pending', 'reversed'].includes(observation)) {
          demand(pay.capture_state === 'completed');
          if (observation === 'disputed') pay.dispute_state = 'open';
          else if (observation === 'dispute_won' || observation === 'dispute_lost') {
            const next = observation === 'dispute_won' ? 'won' : 'lost';
            demand(pay.dispute_state === 'open' || pay.dispute_state === next); pay.dispute_state = next;
          } else if (observation === 'reversal_pending') {
            if (pay.reversal_state !== 'reversed') pay.reversal_state = 'pending';
          } else if (observation === 'reversed') {
            demand(pay.refunded_minor === 0); pay.reversal_state = 'reversed'; pay.reversed_minor = pay.captured_minor;
          } else {
            demand(pay.reversal_state === 'none');
            pay.refunded_minor = pay.captured_minor; pay.refund_state = 'refunded';
            for (const r of refunds.values()) if (r.payment_id === pay.id && r.state !== 'completed') { r.state = 'completed'; r.provider_refund_id = id('MOCK_REFUND'); }
          }
          if (observation === 'dispute_won' && entitled(pay)) {
            for (const a of allocations.values()) if (a.payment_id === pay.id && a.ledger_state === 'held') {
              a.ledger_state = 'allocated'; a.payout_state = 'simulated';
            }
          } else holdAllocations(pay, observation === 'refunded' || observation === 'reversed');
        } else {
          demand(pay.capture_state === 'pending' || (pay.capture_state === 'completed' && observation === 'completed'));
          if (observation === 'completed') {
            if (body.provider_expense_minor !== undefined) {
              demand(pay.provider_expense_minor === null || pay.provider_expense_minor === body.provider_expense_minor, 'INVALID_STATE', 'Confirmed expense cannot be replaced with a conflicting value.');
              pay.provider_expense_minor = body.provider_expense_minor;
            }
            pay.capture_state = 'completed'; pay.operation_state = 'succeeded'; pay.last_error_code = null;
            if (pay.authorization_state !== 'not_applicable') pay.authorization_state = 'captured';
            pay.provider_capture_id ??= id('MOCK_CAPTURE');
            pay.captured_minor = pay.purpose === 'participation_fee' ? Math.floor(pay.amount.amount_minor / 10) : pay.amount.amount_minor;
            allocate(pay);
          } else if (observation === 'failed') { pay.capture_state = 'failed'; pay.operation_state = 'failed'; pay.last_error_code = 'MOCK_CAPTURE_DECLINED'; }
          else { pay.operation_state = observation === 'unknown' ? 'unknown' : 'running'; }
        }
        pay.updated_at = stamp(); tick(); return ok(view(pay));
      }
      case 'receivePayPalWebhook': {
        // No financial effects from untrusted event resource. Fixtures model canonical GET state.
        demand(headers['paypal-transmission-sig'] === 'MOCK_VERIFIED' && headers['paypal-cert-url'] === 'https://mock.invalid/cert' && headers['paypal-auth-algo'] === 'MOCK', 'INVALID_WEBHOOK', 'Mock signature headers required.', 400);
        webhookEvents.add(body.id); return ok({ accepted: true, event_id: body.id });
      }
      default: throw new Error(`Missing mock operation ${op}`);
    }
  }
  app.setErrorHandler((error, req, reply) => {
    const e = error as Error & { statusCode?: number };
    const status = e instanceof Fault ? e.status : e.statusCode === 413 ? 413 : e.statusCode === 400 || e.statusCode === 415 ? 400 : 503;
    const code = e instanceof Fault ? e.code : status === 413 ? 'PAYLOAD_TOO_LARGE' : status === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR';
    if (status === 503) app.log.error(error);
    if (status === 429 || status === 503) reply.header('Retry-After', '1');
    reply.header('X-Request-Id', req.id).status(status).type('application/problem+json').send({
      type: `urn:provable:problem:${code.toLowerCase()}`, title: code.replaceAll('_', ' ').toLowerCase(), status, code,
      detail: status === 503 ? 'Mock internal error; inspect server logs.' : e.message, request_id: req.id, retryable: status === 503 || status === 429,
    } satisfies S['Problem']);
  });
  for (const op of operations) app.route({
    method: op.method.toUpperCase(), url: op.path.replace(/\{([^}]+)\}/g, ':$1'),
    handler: async (req, reply) => {
      reply.header('X-Request-Id', req.id);
      const headers = req.headers;
      const publicRoute = op.security?.length === 0;
      const bearer = /^Bearer ([A-Za-z0-9_-]+)$/.exec(String(headers.authorization ?? ''));
      const principal = bearer ? principals[bearer[1]] : undefined;
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
        demand(validator(requestBody.content['application/json'].schema)(req.body), 'VALIDATION_ERROR', 'Request body does not match the contract.', 400);
      } else demand(req.body === undefined, 'VALIDATION_ERROR', 'This operation has no request body.', 400);
      return exclusive(async () => {
        const key = headers['idempotency-key'];
        const subject = principal?.role === 'agent' ? `agent:${principal.agent_id}` : `${principal?.role}:${principal?.id}`;
        const scope = op.method === 'post' && key ? `${subject}|${op.method}|${req.url.split('?')[0]}|${key}` : null;
        const fingerprint = canonical(req.body);
        const cached = scope ? replays.get(scope) : undefined;
        if (cached) {
          demand(cached.fingerprint === fingerprint, 'IDEMPOTENCY_CONFLICT', 'Key was used with a different request body.');
          if (cached.cache) reply.header('Cache-Control', cached.cache);
          return reply.status(cached.status).send(structuredClone(cached.body));
        }
        tick();
        const result = await execute(op.operationId, principal!, req.params, req.body, query, headers);
        validateResponse(op, result.status, result.type ?? 'application/json', result.body);
        if (scope) replays.set(scope, { fingerprint, status: result.status, body: structuredClone(result.body), cache: result.cache });
        if (result.cache) reply.header('Cache-Control', result.cache);
        if (result.cache) reply.header('X-Content-Type-Options', 'nosniff');
        return reply.type(result.type ?? 'application/json').status(result.status).send(Buffer.isBuffer(result.body) ? result.body : structuredClone(result.body));
      });
    },
  });
  // Dev server may call this for passive deadline progression; tests use advanceMockClock.
  return { app, tick };
}
