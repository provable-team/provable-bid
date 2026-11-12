import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { join } from 'node:path';
import type { AgentAdapter, EvaluatorAdapter } from '../packages/agent-interface/src/index.js';
import { createApi } from '../apps/api/src/app.js';
import { heuristicEvaluator, judgeText, streamingHouseAgent } from '../apps/api/src/claude.js';
import { colorTracker, parseStructure, progressTracker, structureTracker } from '../apps/api/src/progress.js';
import type { PageRenderer } from '../apps/api/src/browser.js';
import { previewHtml } from '../apps/api/src/html.js';
import { agentPayoutFor, paypalCheckoutFee, processingFeeFor } from '../apps/api/src/money.js';
import { fakeProvider } from '../apps/api/src/provider/fake.js';
import { ProviderError } from '../apps/api/src/provider/types.js';
import { Store } from '../apps/api/src/store.js';
import { contract, operations, resolve, validator, validateResponse } from '../scripts/contract.js';

const WEB = 'http://web.test';
const ADMIN = 'admin_token_for_tests_0001';
const T0 = Date.parse('2026-11-12T10:00:00.000Z');

const page = (extra = '', hours = true) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Crumb &amp; Co.</title>
<style>body{font-family:system-ui;margin:0}.cta{background:#b5522b;color:#fff;padding:12px 20px}</style></head><body>
<h1>Crumb &amp; Co. — a family bakery since 1987</h1><p>Fresh sourdough, cardamom buns and croissants baked every morning in our corner shop.</p>
${hours ? '<section><h2>Opening hours</h2><p>Tuesday to Sunday, 7am to 3pm. Closed Mondays.</p></section>' : '<section><h2>Our story</h2><p>Three generations of bakers.</p></section>'}
<a class="cta" href="#preorder">Pre-order now</a>${extra}</body></html>`;
const brief = {
  title: 'Landing page for a neighborhood bakery',
  brief: 'One page for Crumb & Co., a family bakery. Warm, handmade feel. Hero, story, opening hours, pre-order button. Mobile first.',
  bid: { currency: 'USD', amount_minor: 2000 }, submission_window_seconds: 300, decision_window_seconds: 3600,
  requirements: [
    { id: 'req_hours', description: 'Shows opening hours.' },
    { id: 'req_preorder', description: 'Has a clearly visible pre-order button.' },
    { id: 'req_mobile', description: 'Works on a 375px-wide phone screen.' },
  ],
  accepted_terms_version: 'race-v1',
};

async function fixture(t: any, opts: { dbPath?: string; evaluator?: EvaluatorAdapter; houseAgents?: Record<string, AgentAdapter>; simulatePayouts?: boolean; renderer?: PageRenderer; progressIntervalMs?: number; providerMode?: 'paypal_sandbox' } = {}) {
  let now = T0;
  const store = new Store(opts.dbPath ?? ':memory:');
  const fake = fakeProvider({ webOrigin: WEB, now: () => now });
  const notices: { url: string; body: string; sig: string }[] = [];
  const api = await createApi({
    store, provider: opts.providerMode ? { ...fake.provider, mode: opts.providerMode } : fake.provider, evaluator: opts.evaluator ?? heuristicEvaluator(), webOrigin: WEB, apiOrigin: 'http://api.test',
    adminToken: ADMIN, houseOperatorPayerId: 'HOUSEPAYER0001', houseAgents: opts.houseAgents ?? null, progressIntervalMs: opts.progressIntervalMs, now: () => now, renderer: opts.renderer ?? null,
    strictResponses: true, simulatePayouts: opts.simulatePayouts ?? false, log: () => {},
    notify: async (url, body, sig) => { notices.push({ url, body, sig }); },
  });
  t.after(async () => { await api.idle(); await api.app.close(); });
  let sequence = 0;
  async function request(method: 'GET' | 'POST', path: string, body?: any, token: string | null = null, key?: string | null, headers: Record<string, string> = {}) {
    const h: Record<string, string> = { ...headers };
    if (token) h.authorization = `Bearer ${token}`;
    if (method === 'POST' && key !== null) h['idempotency-key'] = key ?? `command_${++sequence}_key`;
    const r = await api.app.inject({ method, url: path, headers: h, ...(body !== undefined ? { payload: body } : {}) });
    const type = String(r.headers['content-type'] ?? '');
    const data = type.startsWith('text/html') ? r.body : type.startsWith('image/') ? r.rawPayload : r.statusCode === 302 ? null : r.json();
    const op = operations.find(o => o.method === method.toLowerCase() && new RegExp(`^${o.path.replace(/\{[^}]+\}/g, '[^/]+')}$`).test(path.split('?')[0]));
    assert.ok(op, `contract operation for ${method} ${path}`);
    if (r.statusCode !== 302) validateResponse(op, r.statusCode, type, data);
    assert.ok(r.headers['x-request-id']);
    return { status: r.statusCode, data, headers: r.headers };
  }
  const post = (path: string, body: any, token: string | null, key?: string) => request('POST', path, body, token, key);
  const get = (path: string, token: string | null) => request('GET', path, undefined, token);
  async function settle() { for (let i = 0; i < 4; i++) { await api.work(); await api.idle(); } }
  async function advance(seconds: number) { now += seconds * 1000; await settle(); }
  async function buyer() { return (await post('/v1/buyer-sessions', undefined, null)).data.token as string; }
  async function operator(payerId: string, name: string) {
    const start = await get('/v1/operators/connect', null);
    assert.equal(start.status, 302);
    const state = new URL(String(start.headers.location)).searchParams.get('state')!;
    const back = await get(`/v1/operators/connect/callback?code=${encodeURIComponent(`fake:${payerId}:${name}`)}&state=${state}`, null);
    const fragment = new URLSearchParams(String(back.headers.location).split('#')[1]);
    assert.ok(fragment.get('operator_token'), `operator login: ${back.headers.location}`);
    return fragment.get('operator_token')!;
  }
  async function agent(operatorToken: string, name: string, webhook_url: string | null = null) {
    const r = await post('/v1/operators/me/agents', { name, description: `${name} builds pages.`, style: 'Clean.', webhook_url }, operatorToken);
    assert.equal(r.status, 201, JSON.stringify(r.data));
    return r.data as { token: string; webhook_secret: string | null; agent: { id: string } };
  }
  async function open(buyerToken: string, body: any = brief) {
    const c = (await post('/v1/competitions', body, buyerToken)).data;
    const checkout = (await post(`/v1/competitions/${c.id}/checkout`, undefined, buyerToken)).data;
    fake.controls.approve(checkout.provider_order_id);
    const auth = await post(`/v1/competitions/${c.id}/authorize`, undefined, buyerToken);
    assert.equal(auth.status, 202, JSON.stringify(auth.data));
    return { c: (await get(`/v1/competitions/${c.id}`, buyerToken)).data, payment: auth.data, checkout };
  }
  async function enter(agentToken: string, competitionId: string, html = page(), title = 'Crumb & Co.') {
    const asset = await post('/v1/assets', { competition_id: competitionId, type: 'html', mime_type: 'text/html', content_base64: Buffer.from(html).toString('base64') }, agentToken);
    assert.equal(asset.status, 201, JSON.stringify(asset.data));
    const s = await post(`/v1/competitions/${competitionId}/submissions`, { title, artifacts: [{ asset_id: asset.data.id }] }, agentToken);
    assert.equal(s.status, 201, JSON.stringify(s.data));
    return s.data;
  }
  return { api, fake, store, notices, request, post, get, settle, advance, buyer, operator, agent, open, enter, now: () => now };
}

test('OpenAPI 3.1 structure, references, examples, operation IDs, and mutation keys are valid', () => {
  assert.equal(contract.openapi, '3.1.0');
  assert.equal(contract.info.version, '0.4.0');
  assert.equal(new Set(operations.map(o => o.operationId)).size, operations.length);
  const walk = (value: any) => { if (!value || typeof value !== 'object') return; if (value.$ref) assert.ok(resolve(value)); for (const child of Object.values(value)) walk(child); };
  walk(contract);
  for (const op of operations) {
    assert.ok(op.responses['400'] && op.responses['409'] && op.responses['503'], op.operationId);
    const rb = resolve(op.requestBody);
    if (rb) for (const media of Object.values(rb.content) as any[]) if (media.example) assert.ok(validator(media.schema)(media.example), `${op.operationId} example`);
    if (op.method === 'post' && op.operationId !== 'receivePayPalWebhook') assert.ok(op.parameters.some((p: any) => p.name === 'Idempotency-Key' && p.required), op.operationId);
  }
});

test('processing fee always leaves the full price after PayPal\'s fee; commission covers the payout fee from $10', () => {
  for (let price = 1000; price <= 500000; price += 997) {
    const fee = processingFeeFor(price);
    assert.ok(price + fee - paypalCheckoutFee(price + fee) >= price, `price ${price}`);
    assert.ok(price + fee - 1 - paypalCheckoutFee(price + fee - 1) < price, `minimal fee at ${price}`);
    assert.ok(price - agentPayoutFor(price) >= 25 + 25 || price < 1000, `commission covers payout fee at ${price}`);
  }
  assert.equal(processingFeeFor(2000), 123);
});

test('full race: authorize, outside agent enters, AI-checked gallery, select, capture, real payout, delivery with matching fingerprint', async t => {
  const f = await fixture(t);
  const buyerToken = await f.buyer();
  assert.equal((await f.get('/v1/config', null)).data.capabilities.payouts, 'paypal_sandbox');

  const opToken = await f.operator('PAYERANN0001', 'Ann Operator');
  const ann = await f.agent(opToken, 'Pixel Forge', 'https://agents.example/hook');
  const c0 = (await f.post('/v1/competitions', brief, buyerToken)).data;
  assert.equal(c0.processing_fee.amount_minor, 123); assert.equal(c0.total.amount_minor, 2123); assert.equal(c0.state, 'draft');
  assert.equal((await f.get(`/v1/competitions/${c0.id}`, ann.token)).status, 404, 'drafts are private');

  const checkout = (await f.post(`/v1/competitions/${c0.id}/checkout`, undefined, buyerToken)).data;
  assert.equal(checkout.intent, 'AUTHORIZE');
  const notApproved = await f.post(`/v1/competitions/${c0.id}/authorize`, undefined, buyerToken);
  assert.equal(notApproved.status, 409); assert.equal(notApproved.data.code, 'PAYMENT_NOT_READY');
  f.fake.controls.approve(checkout.provider_order_id);
  const auth = await f.post(`/v1/competitions/${c0.id}/authorize`, undefined, buyerToken);
  assert.equal(auth.data.authorization_state, 'authorized'); assert.equal(auth.data.amount.amount_minor, 2123);
  const c = (await f.get(`/v1/competitions/${c0.id}`, ann.token)).data;
  assert.equal(c.state, 'open'); assert.equal(Date.parse(c.submission_deadline) - Date.parse(c.opens_at), 300_000);

  // The outside agent was notified with a verifiable signature.
  await f.api.idle();
  assert.equal(f.notices.length, 1);
  assert.equal(createHmac('sha256', ann.webhook_secret!).update(f.notices[0].body).digest('hex'), f.notices[0].sig);
  assert.equal(JSON.parse(f.notices[0].body).competition.id, c.id);

  const html = page();
  const s = await f.enter(ann.token, c.id, html);
  assert.equal(s.qualification_status, 'pending');
  assert.equal((await f.get(`/v1/competitions/${c.id}/submissions`, buyerToken)).data.items.length, 0, 'buyer sees only qualified work');
  await f.settle();
  const gallery = (await f.get(`/v1/competitions/${c.id}/submissions`, buyerToken)).data.items;
  assert.equal(gallery.length, 1); assert.equal(gallery[0].qualification_status, 'qualified');
  assert.deepEqual(gallery[0].qualification.checks.map((x: any) => x.passed), [true, true, true]);
  assert.equal(gallery[0].artifacts[0].sha256, createHash('sha256').update(html).digest('hex'));

  const preview = await f.get(new URL(gallery[0].artifacts[0].preview.url).pathname, buyerToken);
  assert.equal(preview.status, 200); assert.match(String(preview.headers['content-security-policy']), /sandbox/);
  assert.ok(preview.data.startsWith('<!doctype html><meta http-equiv="Content-Security-Policy"'), 'CSP before anything the agent wrote');
  assert.match(preview.data, /PREVIEW · provable\.bid/);
  assert.equal((await f.get(new URL(gallery[0].artifacts[0].preview.url).pathname, null)).status, 401);

  f.fake.controls.captureStatus = 'PENDING'; // PayPal sometimes holds a capture for review
  const pick = await f.post(`/v1/competitions/${c.id}/selection`, { submission_id: s.id }, buyerToken);
  assert.equal(pick.status, 202); assert.equal(pick.data.delivery_unlocked, false);
  await f.settle();
  assert.equal((await f.get(`/v1/payments/${auth.data.id}`, buyerToken)).data.capture_state, 'pending');
  assert.equal((await f.post(`/v1/purchases/${pick.data.id}/delivery-access`, undefined, buyerToken)).data.code, 'DELIVERY_LOCKED');
  f.fake.controls.settleCapture([...f.fake.captures.keys()][0]);
  await f.advance(15);
  const pay = (await f.get(`/v1/payments/${auth.data.id}`, buyerToken)).data;
  assert.equal(pay.capture_state, 'completed'); assert.equal(pay.captured_minor, 2123); assert.equal(pay.provider_expense_minor, 123);

  const captures = f.fake.controls.calls.filter(x => x.op === 'captureAuthorization');
  assert.equal(captures.length, 1); assert.equal(captures[0].amountMinor, 2123);
  const sent = f.fake.controls.calls.filter(x => x.op === 'sendPayout');
  assert.deepEqual(sent.map(x => [x.target, x.amountMinor]), [['PAYERANN0001', 1900]], 'payout to the operator\'s verified PayPal account, price minus 5%');
  await f.advance(10);
  const settlement = (await f.get(`/v1/competitions/${c.id}/settlement`, buyerToken)).data;
  assert.equal(settlement.allocations[0].payout_state, 'paid'); assert.equal(settlement.allocations[0].amount.amount_minor, 1900);
  assert.equal(settlement.accounting[0].distributable_minor, 1900); assert.equal(settlement.accounting[0].platform_absorbed_expense_minor, 0);

  const access = await f.post(`/v1/purchases/${pick.data.id}/delivery-access`, undefined, buyerToken);
  assert.equal(access.status, 201);
  const original = await f.get(new URL(access.data.artifacts[0].url).pathname, buyerToken);
  assert.equal(original.data, html, 'buyer gets the exact submitted bytes');
  assert.equal(createHash('sha256').update(original.data).digest('hex'), gallery[0].artifacts[0].sha256);

  const ledger = (await f.get('/v1/operators/me/allocations?limit=10', opToken)).data;
  assert.equal(ledger.items.length, 1);
  assert.deepEqual([ledger.items[0].payout_state, ledger.items[0].amount.amount_minor, ledger.items[0].agent_shares[0].agent_id], ['paid', 1900, ann.agent.id]);
  assert.equal((await f.get('/v1/operators/me/allocations', buyerToken)).data.code, 'OPERATOR_REQUIRED', 'buyers cannot read operator ledgers');
  const otherOperator = await f.operator('PAYEROTHER01', 'Other');
  assert.equal((await f.get('/v1/operators/me/allocations', otherOperator)).data.items.length, 0, 'operators only see their own allocations');
  const op = (await f.get('/v1/operators/me', opToken)).data;
  assert.deepEqual([op.agents[0].submissions, op.agents[0].wins, op.agents[0].paid_minor], [1, 1, 1900]);
  const earnings = (await f.get('/v1/agents/me/earnings', ann.token)).data;
  assert.equal(earnings.items[0].payout_state, 'paid');
});

test('a retried checkout reuses the persisted PayPal-Request-Id: one order, never two', async t => {
  const f = await fixture(t);
  const b = await f.buyer();
  const c = (await f.post('/v1/competitions', brief, b)).data;
  f.fake.controls.failNext = { op: 'createOrder', error: new ProviderError('timeout', 'unknown') };
  const first = await f.post(`/v1/competitions/${c.id}/checkout`, undefined, b);
  assert.equal(first.status, 503); assert.equal(first.data.retryable, true);
  const second = await f.post(`/v1/competitions/${c.id}/checkout`, undefined, b);
  const third = await f.post(`/v1/competitions/${c.id}/checkout`, undefined, b);
  assert.equal(second.status, 201); assert.equal(third.data.provider_order_id, second.data.provider_order_id);
  assert.equal(f.fake.controls.calls.filter(x => x.op === 'createOrder').length, 1);
  assert.equal(f.fake.orders.size, 1);
});

test('an unknown capture outcome is retried with the same request ID and captures exactly once', async t => {
  const f = await fixture(t);
  const b = await f.buyer(); const ann = await f.agent(await f.operator('PAYERANN0001', 'Ann'), 'Alpha');
  const { c } = await f.open(b);
  const s = await f.enter(ann.token, c.id); await f.settle();
  f.fake.controls.failNext = { op: 'captureAuthorization', error: new ProviderError('socket hang up', 'unknown') };
  await f.post(`/v1/competitions/${c.id}/selection`, { submission_id: s.id }, b);
  await f.settle();
  const pay = (await f.get(`/v1/payments/${c.initial_payment_id}`, b)).data;
  assert.equal(pay.capture_state, 'pending'); assert.equal(pay.operation_state, 'unknown');
  await f.advance(5);
  assert.equal((await f.get(`/v1/payments/${c.initial_payment_id}`, b)).data.capture_state, 'completed');
  assert.equal(f.fake.controls.calls.filter(x => x.op === 'captureAuthorization').length, 1);
});

test('reject all, no qualifiers, and a missed decision deadline each void the hold: the buyer pays nothing', async t => {
  const f = await fixture(t);
  const b = await f.buyer(); const ann = await f.agent(await f.operator('PAYERANN0001', 'Ann'), 'Alpha');

  const one = await f.open(b);
  await f.enter(ann.token, one.c.id); await f.settle();
  const rejected = await f.post(`/v1/competitions/${one.c.id}/rejection`, undefined, b);
  assert.equal(rejected.status, 202); await f.settle();
  assert.equal((await f.get(`/v1/competitions/${one.c.id}`, b)).data.outcome, 'rejected');
  assert.equal((await f.get(`/v1/payments/${one.payment.id}`, b)).data.authorization_state, 'voided');

  const two = await f.open(b);
  const bad = await f.enter(ann.token, two.c.id, page('', false)); // no opening hours
  await f.settle();
  assert.equal((await f.get(`/v1/submissions/${bad.id}`, ann.token)).data.qualification.failure_code, 'requirements_not_met');
  await f.advance(300 + 120);
  assert.equal((await f.get(`/v1/competitions/${two.c.id}`, b)).data.outcome, 'no_qualifiers');
  assert.equal((await f.get(`/v1/payments/${two.payment.id}`, b)).data.authorization_state, 'voided');

  const three = await f.open(b);
  await f.enter(ann.token, three.c.id); await f.settle();
  await f.advance(300 + 120);
  assert.equal((await f.get(`/v1/competitions/${three.c.id}`, b)).data.state, 'deciding');
  await f.advance(3600);
  assert.equal((await f.get(`/v1/competitions/${three.c.id}`, b)).data.outcome, 'no_decision');
  assert.equal((await f.get(`/v1/payments/${three.payment.id}`, b)).data.authorization_state, 'voided');

  assert.equal(f.fake.controls.calls.filter(x => x.op.startsWith('capture')).length, 0, 'nothing was ever captured');
  assert.equal(f.fake.controls.calls.filter(x => x.op === 'voidAuthorization').length, 3);
});

test('extra entries: a separate full-price CAPTURE checkout and a second payout', async t => {
  const f = await fixture(t);
  const b = await f.buyer();
  const ann = await f.agent(await f.operator('PAYERANN0001', 'Ann'), 'Alpha');
  const ben = await f.agent(await f.operator('PAYERBEN0002', 'Ben'), 'Beta');
  const { c } = await f.open(b);
  const a = await f.enter(ann.token, c.id); const bb = await f.enter(ben.token, c.id); await f.settle();
  await f.post(`/v1/competitions/${c.id}/selection`, { submission_id: a.id }, b); await f.settle();
  const extra = await f.post(`/v1/competitions/${c.id}/additional-purchases`, { submission_id: bb.id }, b);
  assert.equal(extra.status, 201); assert.equal(extra.data.checkout.intent, 'CAPTURE');
  assert.equal((await f.post(`/v1/purchases/${extra.data.id}/capture`, undefined, b)).data.code, 'PAYMENT_NOT_READY', 'needs PayPal approval first');
  f.fake.controls.approve(extra.data.checkout.provider_order_id);
  assert.equal((await f.post(`/v1/purchases/${extra.data.id}/capture`, undefined, b)).status, 202);
  await f.settle(); await f.advance(10);
  assert.equal((await f.get(`/v1/purchases/${extra.data.id}`, b)).data.delivery_unlocked, true);
  assert.deepEqual(f.fake.controls.calls.filter(x => x.op === 'sendPayout').map(x => x.target).sort(), ['PAYERANN0001', 'PAYERBEN0002']);
});

test('PayPal webhooks: signature checked with PayPal, deduplicated, then canonical state applied (dispute holds the payout)', async t => {
  const f = await fixture(t);
  const b = await f.buyer(); const ann = await f.agent(await f.operator('PAYERANN0001', 'Ann'), 'Alpha');
  const { c } = await f.open(b);
  const s = await f.enter(ann.token, c.id); await f.settle();
  f.fake.controls.captureStatus = 'PENDING';
  await f.post(`/v1/competitions/${c.id}/selection`, { submission_id: s.id }, b);
  await f.settle(); // capture accepted but PENDING at PayPal
  const pay = (await f.get(`/v1/payments/${c.initial_payment_id}`, b)).data;
  assert.equal(pay.capture_state, 'pending');
  const headers = (sig: string) => ({ 'paypal-transmission-id': 'tx1', 'paypal-transmission-time': '2026-11-12T10:05:00Z', 'paypal-transmission-sig': sig, 'paypal-cert-url': 'https://api.paypal.com/cert', 'paypal-auth-algo': 'SHA256withRSA' });
  const event = { id: 'WH-1', event_type: 'CUSTOMER.DISPUTE.CREATED', resource: { disputed_transactions: [{ seller_transaction_id: pay.provider_capture_id }] } };
  assert.equal((await f.request('POST', '/v1/webhooks/paypal', event, null, null, headers('forged'))).data.code, 'INVALID_WEBHOOK');
  assert.equal((await f.request('POST', '/v1/webhooks/paypal', event, null, null, headers('FAKE_VERIFIED'))).status, 200);
  assert.equal((await f.request('POST', '/v1/webhooks/paypal', event, null, null, headers('FAKE_VERIFIED'))).status, 200, 'duplicate delivery is acknowledged');
  await f.api.idle(); await f.settle();
  f.fake.controls.settleCapture(pay.provider_capture_id); // the capture completes after the dispute opened
  await f.advance(15);
  const held = (await f.get(`/v1/payments/${c.initial_payment_id}`, b)).data;
  assert.equal(held.dispute_state, 'open');
  assert.equal((await f.get(`/v1/competitions/${c.id}/settlement`, b)).data.allocations[0].payout_state, 'blocked');
  assert.equal(f.fake.controls.calls.filter(x => x.op === 'sendPayout').length, 0, 'no payout while disputed');
  assert.equal((await f.post(`/v1/purchases/${c.first_purchase_id ?? (await f.get(`/v1/competitions/${c.id}`, b)).data.first_purchase_id}/delivery-access`, undefined, b)).data.code, 'DELIVERY_LOCKED');
});

test('PayPal-mode agent registration rejects internal callback URLs; fake mode alone permits explicit loopback', async t => {
  const deployed = await fixture(t, { providerMode: 'paypal_sandbox' });
  const operator = await deployed.operator('PAYERANN0001', 'Ann');
  const registration = (webhook_url: string) => ({ name: 'Outside', description: 'Outside agent', style: 'Clean', webhook_url });
  for (const url of ['http://localhost:4010/cb', 'https://127.0.0.1/cb', 'https://[::ffff:127.0.0.1]/cb', 'https://169.254.169.254/cb']) {
    const result = await deployed.post('/v1/operators/me/agents', registration(url), operator);
    assert.equal(result.status, 400, url);
    assert.equal(result.data.code, 'VALIDATION_ERROR');
  }
  assert.equal((await deployed.post('/v1/operators/me/agents', registration('https://hooks.example/cb'), operator)).status, 201);
  const local = await fixture(t);
  const developer = await local.operator('PAYERDEV0001', 'Developer');
  assert.equal((await local.post('/v1/operators/me/agents', registration('http://127.0.0.1:4010/cb'), developer)).status, 201);
});

test('permissions, gates and the attempts rule', async t => {
  const f = await fixture(t);
  const b = await f.buyer(); const other = await f.buyer();
  const opToken = await f.operator('PAYERANN0001', 'Ann');
  const ann = await f.agent(opToken, 'Alpha');
  const ben = await f.agent(await f.operator('PAYERBEN0002', 'Ben'), 'Beta');
  const { c } = await f.open(b);
  assert.equal((await f.post('/v1/competitions', brief, ann.token)).status, 403, 'agents cannot post briefs');
  assert.equal((await f.post('/v1/operators/me/agents', { name: 'XY', description: '', style: '' }, b)).data.code, 'OPERATOR_REQUIRED');
  assert.equal((await f.post('/v1/competitions', { ...brief, bid: { currency: 'USD', amount_minor: 500 } }, b)).status, 400, '$5 is below the minimum');

  const external = page('<script src="https://cdn.evil.example/x.js"></script>');
  const gated = await f.enter(ann.token, c.id, external); await f.settle();
  const seen = (await f.get(`/v1/submissions/${gated.id}`, ann.token)).data;
  assert.equal(seen.qualification.failure_code, 'invalid_output');
  // A failed attempt may be revised; while the new attempt is being checked, no further one is accepted.
  assert.equal((await f.post(`/v1/competitions/${c.id}/submissions`, { title: 'again', artifacts: [{ asset_id: gated.artifacts[0].asset_id }] }, ann.token)).status, 201);
  assert.equal((await f.post(`/v1/competitions/${c.id}/submissions`, { title: 'third', artifacts: [{ asset_id: gated.artifacts[0].asset_id }] }, ann.token)).data.code, 'DUPLICATE_SUBMISSION');
  assert.equal((await f.get(`/v1/submissions/${gated.id}`, ben.token)).status, 404, 'agents cannot read rivals');
  assert.equal((await f.get(`/v1/submissions/${gated.id}`, b)).status, 404, 'buyers never see unqualified work');
  assert.equal((await f.get(`/v1/competitions/${c.id}/purchases`, other)).status, 404, 'other buyers cannot read purchases');

  const rotated = await f.post(`/v1/operators/me/agents/${ann.agent.id}/credential`, undefined, opToken);
  assert.equal(rotated.status, 201);
  assert.equal((await f.get('/v1/agents/me', ann.token)).status, 401, 'old token stops working');
  assert.equal((await f.get('/v1/agents/me', rotated.data.token)).data.id, ann.agent.id);

  const expired = await f.get('/v1/operators/connect/callback?code=fake:PAYERX000001:X&state=nope', null);
  assert.match(String(expired.headers.location), /#error=/);
  f.fake.controls.payerCountry = 'GB';
  const c2 = (await f.post('/v1/competitions', brief, b)).data;
  const co = (await f.post(`/v1/competitions/${c2.id}/checkout`, undefined, b)).data; f.fake.controls.approve(co.provider_order_id);
  const nonUs = await f.post(`/v1/competitions/${c2.id}/authorize`, undefined, b);
  assert.equal(nonUs.status, 422); assert.match(nonUs.data.detail, /US PayPal accounts/);
  assert.equal(f.fake.auths.size, 1, 'no authorization was created for the non-US payer');
});

test('house agents enter every competition through the public API, labelled as house agents', async t => {
  const runs: string[] = [];
  const house: Record<string, AgentAdapter> = {
    agent_house_atelier: { id: 'agent_house_atelier', async run(ctx) {
      runs.push(ctx.competition.id);
      const asset = await ctx.uploadAsset({ competition_id: ctx.competition.id, type: 'html', mime_type: 'text/html', content_base64: Buffer.from(page()).toString('base64') }, 'atelier-upload-1');
      await ctx.submit({ title: 'Atelier take', artifacts: [{ asset_id: asset.id }] }, 'atelier-submit-1');
    } },
  };
  const f = await fixture(t, { houseAgents: house });
  const b = await f.buyer();
  const agents = (await f.get('/v1/agents', null)).data.items;
  assert.deepEqual(agents.filter((a: any) => a.internal).map((a: any) => [a.name, a.status, a.operator_name]),
    [['Atelier', 'available', 'provable.bid'], ['Meadow', 'unavailable', 'provable.bid'], ['Voltage', 'unavailable', 'provable.bid']]);
  const { c } = await f.open(b);
  await f.settle();
  assert.deepEqual(runs, [c.id]);
  const gallery = (await f.get(`/v1/competitions/${c.id}/submissions`, b)).data.items;
  assert.equal(gallery[0].agent_id, 'agent_house_atelier');
  await f.post(`/v1/competitions/${c.id}/selection`, { submission_id: gallery[0].id }, b); await f.settle();
  assert.deepEqual(f.fake.controls.calls.filter(x => x.op === 'sendPayout').map(x => x.target), ['HOUSEPAYER0001']);
});

// A house agent's streamed page: the build steps shown to the buyer come from its structure, never its content.
const streamedPage = `Here is the page.\n<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Crumb &amp; Co.</title><style>:root{--brand:#2F5D8A;--ink:#111}body{font-family:Georgia,serif;margin:0;color:#222;background:#fffdf8}
.cta{background:#b5522b;color:#fff;box-shadow:0 0 4px #ff00aa}.card{border:1px solid #3a7d44}.extra{color:#c0ffee}
@media (max-width:600px){.grid{display:block}}</style></head><body>
<header><nav><a href="#story">Our story</a></nav></header>
<div class="hero"><h1>Warm cardamom buns since 1987</h1><p>Sourdough proofed for two full days.</p></div>
<section id="story"><h2>Three generations of bakers</h2><p>Grandma Ilse opened the shop with one oven and a stubborn starter.</p>
${'<p>The rye loaves sell out by nine on Saturdays, so come early.</p>'.repeat(6)}</section>
<section id="when"><h2>Opening hours</h2><p>Tuesday to Sunday, 7am to 3pm. Closed Mondays.</p></section>
<a class="cta" href="#preorder">Pre-order now</a><footer><p>Corner of Elm and 4th.</p></footer></body></html>`;
const secrets = ['cardamom', 'Sourdough', 'Ilse', 'rye loaves', 'Georgia', 'font-family', '--brand', 'cta', 'max-width', 'Tuesday', 'Elm and 4th', '#ff00aa', '#c0ffee', '<', '>', ';', ':root'];
// The only design information that may leave the server: the first 3 usable hex colours in colour declarations.
const pageColors = ['#2f5d8a', '#b5522b', '#3a7d44'];

test('build progress: coarse steps from the stream structure; requirement words only when the stream has them', () => {
  const step = progressTracker(brief.requirements);
  const labels: string[] = [];
  for (let i = 0; i <= streamedPage.length + 7; i += 7) {
    const l = step(streamedPage.slice(0, i));
    if (labels.at(-1) !== l) labels.push(l);
  }
  assert.deepEqual(labels, ['planning the page', 'setting up the page', 'writing the styles', 'styling for phones', 'writing the header',
    'writing the hero', 'adding a section', 'adding opening hours', 'writing the footer', 'finishing up']);
  // A section that mentions no requirement stays generic; nothing from the page itself ever becomes a label.
  const other = progressTracker([{ description: 'Has a menu with prices.' }]);
  assert.equal(other(`<!doctype html><body><section>${'x'.repeat(500)}</section>`), 'adding a section');
  assert.equal(progressTracker([{ description: 'Has a menu with prices.' }])('<!doctype html><body><section class="menu"><h2>Cakes</h2>'), 'adding the menu');
});

test('build colours: the first 3 usable hex values in colour declarations, normalized, never half-streamed', () => {
  const colors = colorTracker();
  let last: string[] = [];
  for (let i = 0; i <= streamedPage.length + 5; i += 5) {
    last = colors(streamedPage.slice(0, i));
    assert.ok(last.every(c => /^#[0-9a-f]{6}$/.test(c) && pageColors.includes(c)), `only whole, usable colours: ${last}`);
  }
  assert.deepEqual(last, pageColors, 'near-black #111/#222, near-white #fff/#fffdf8 and non-colour properties are skipped');
  const split = colorTracker();
  assert.deepEqual(split('.a{color:#b55'), [], 'a hex value cut off by the stream is not read');
  assert.deepEqual(split('.a{color:#b5522b}'), ['#b5522b']);
  assert.deepEqual(colorTracker()('<p>#123456 in text</p><div class="#654321">'), [], 'hex in text or attributes is not a colour declaration');
});

test('page structure: ordered top-level blocks with kinds and counts, and the block being written', () => {
  const page = `<!doctype html><html><head><style>:root{--brand:#1F3A93}header{background:#f4efe6}.hero{background:var(--brand)}
footer{background:#111}.btn{background:#e4572e}.btn:hover{background:#000}</style></head><body>
<header><a class="logo" href="#">p</a><nav><a href="#how">How</a><a href="#faq">FAQ</a></nav></header>
<main><section class="hero"><h1>Proof first</h1><p>Copy</p><a class="btn" href="#">Start</a><svg><g><path d="M0 0"/></g></svg></section>
<section id="how"><h2>How</h2><ol><li class="step">1</li><li class="step">2</li><li class="step">3</li><li class="step">4</li></ol></section>
<section id="faq"><h2>FAQ</h2><details><summary>a</summary></details><details><summary>b</summary></details><details><summary>c</summary></details></section>
<form><input type="email"><input type="text"><textarea></textarea><input type="hidden"><button>Go</button></form>
<table><tr><td>1</td></tr><tr><td>2</td></tr></table></main><footer><p>Small print</p></footer></body></html>`;
  assert.deepEqual(structureTracker()(page, true), {
    blocks: [{ kind: 'nav', fill: '#f4efe6' }, { kind: 'hero', fill: '#1f3a93' }, { kind: 'section', columns: 4 }, { kind: 'faq', items: 3 },
      { kind: 'form', items: 3 }, { kind: 'table', items: 2 }, { kind: 'footer', fill: '#111111' }],
    current: 6, accent: '#e4572e',
  });
  // Mid-stream: the FAQ is open (its close tag has not arrived), so it is the block being written.
  const cut = page.slice(0, page.indexOf('<summary>c'));
  assert.deepEqual(parseStructure(cut).blocks.map(b => b.kind), ['nav', 'hero', 'section', 'faq']);
  assert.equal(parseStructure(cut).current, 3);
  // A hero that is just a div with an h1 still counts; text and class names never appear.
  const s = parseStructure('<body><div class="secret-hero-class"><h1>Secret words</h1></div><section><p>x</p></section>');
  assert.deepEqual(s.blocks, [{ kind: 'hero' }, { kind: 'section' }]);
});

test('house agents report live build steps to the buyer only, and the steps never contain the page', async t => {
  let release!: () => void;
  const ready = new Promise<void>(r => { release = r; });
  const seen: any[] = [];
  let look: () => Promise<void> = async () => {};
  const house = {
    agent_house_atelier: streamingHouseAgent({ id: 'agent_house_atelier', name: 'Atelier', style: 'Editorial.', description: 'Atelier.' }, async (_ctx, _p, onText) => {
      await ready;
      for (let i = 0; i < streamedPage.length; i += 40) { onText(streamedPage.slice(0, i + 40)); await look(); }
      return { text: streamedPage, stopReason: 'end_turn' };
    }),
  };
  const f = await fixture(t, { houseAgents: house, progressIntervalMs: 0 });
  const b = await f.buyer();
  const ann = await f.agent(await f.operator('PAYERANN0001', 'Ann'), 'Alpha');
  const { c } = await f.open(b);
  look = async () => { seen.push((await f.get(`/v1/competitions/${c.id}`, b)).data); };
  release();
  await f.settle();
  await look();
  const steps = seen.flatMap(x => x.build_progress ?? []);
  assert.ok(steps.length > 0 && steps.every((s: any) => s.agent_id === 'agent_house_atelier'));
  const labels = [...new Set(steps.map((s: any) => s.label))];
  for (const expected of ['writing the styles', 'styling for phones', 'writing the header', 'writing the hero', 'adding opening hours', 'finishing up', 'qualified'])
    assert.ok(labels.includes(expected), `saw "${expected}" in ${JSON.stringify(labels)}`);
  assert.equal(seen.at(-1).build_progress[0].state, 'qualified');
  const indexes = steps.map((s: any) => s.step);
  assert.deepEqual(indexes, [...indexes].sort((x, y) => x - y), 'step indexes only increase');
  assert.deepEqual(seen.at(-1).build_progress[0].colors, pageColors);
  // The final structure mirrors the page: header/nav, the hero div, two sections, the footer; the button colour.
  assert.deepEqual(seen.at(-1).build_progress[0].blocks.map((b: any) => b.kind), ['nav', 'hero', 'section', 'section', 'footer']);
  assert.equal(seen.at(-1).build_progress[0].accent, '#b5522b');
  assert.ok(steps.some((s: any) => s.blocks.length > 0 && s.blocks.length < 5), 'the structure grows while the page streams');
  for (const s of steps) {
    assert.deepEqual(Object.keys(s).sort(), ['accent', 'agent_id', 'attempt', 'blocks', 'colors', 'current_block', 'label', 'max_attempts', 'missed_requirement_ids', 'state', 'step', 'updated_at']);
    assert.ok(s.missed_requirement_ids.every((x: string) => brief.requirements.some(r => r.id === x)));
    assert.ok(s.colors.every((c: string) => pageColors.includes(c)), `only the page's own colours: ${s.colors}`);
    for (const b of s.blocks) {
      assert.ok(['nav', 'hero', 'section', 'form', 'faq', 'table', 'footer'].includes(b.kind));
      assert.ok(Object.keys(b).every(k => ['kind', 'columns', 'items', 'fill'].includes(k)), JSON.stringify(b));
      assert.ok([b.columns, b.items].every(n => n === undefined || (Number.isInteger(n) && n >= 1 && n <= 12)));
    }
    // Nothing else from the stream: drop the allowed colours, then no fragment of the page may remain.
    const rest = JSON.stringify(s).replace(/"#[0-9a-f]{6}"/g, '""');
    for (const secret of secrets) assert.ok(!rest.includes(secret), `${rest} leaks "${secret}"`);
  }
  // Only the buyer who owns the competition sees it; agents, other buyers and anonymous callers never do.
  assert.equal((await f.get(`/v1/competitions/${c.id}`, ann.token)).data.build_progress, undefined);
  assert.equal((await f.get(`/v1/competitions/${c.id}`, null)).data.build_progress, undefined);
  assert.equal((await f.get(`/v1/competitions/${c.id}`, await f.buyer())).data.build_progress, undefined);
});

test('a house agent that fails mid-build disappears quietly; a failed check says so', async t => {
  const failing = streamingHouseAgent({ id: 'agent_house_meadow', name: 'Meadow', style: '.', description: '.' }, async (_ctx, _p, onText) => {
    onText('<!doctype html><html><head><style>');
    throw new Error('model unavailable');
  });
  const noHours = streamingHouseAgent({ id: 'agent_house_voltage', name: 'Voltage', style: '.', description: '.' }, async (_ctx, _p, onText) => {
    const html = streamedPage.replace(/<section id="when">[\s\S]*?<\/section>/, '');
    onText(html);
    return { text: html, stopReason: 'end_turn' };
  });
  const f = await fixture(t, { houseAgents: { agent_house_meadow: failing, agent_house_voltage: noHours }, progressIntervalMs: 0 });
  const b = await f.buyer();
  const { c } = await f.open(b);
  await f.settle();
  const progress = (await f.get(`/v1/competitions/${c.id}`, b)).data.build_progress;
  assert.deepEqual(progress.map((p: any) => [p.agent_id, p.label, p.state]), [['agent_house_voltage', "didn't qualify", 'not_qualified']]);
});

test('feedback and revision: an outside agent reads its failed checks and resubmits; at most 3 attempts, none after a pass', async t => {
  const f = await fixture(t);
  const b = await f.buyer();
  const ann = await f.agent(await f.operator('PAYERANN0001', 'Ann'), 'Alpha');
  const ben = await f.agent(await f.operator('PAYERBEN0002', 'Ben'), 'Beta');
  const { c } = await f.open(b);
  // Attempt 1 has no opening hours: the agent reads which requirement it missed, and why.
  const first = await f.enter(ann.token, c.id, page('', false)); await f.settle();
  const mine = (await f.get(`/v1/submissions/${first.id}`, ann.token)).data;
  assert.equal(mine.qualification_status, 'failed');
  assert.deepEqual(mine.qualification.checks.filter((x: any) => !x.passed).map((x: any) => x.requirement_id), ['req_hours']);
  // Attempt 2 fixes it and qualifies; the failed attempt stays recorded; no attempt after a pass.
  const second = await f.enter(ann.token, c.id, page()); await f.settle();
  assert.equal((await f.get(`/v1/submissions/${second.id}`, ann.token)).data.qualification_status, 'qualified');
  assert.equal((await f.get(`/v1/submissions/${first.id}`, ann.token)).data.qualification_status, 'failed', 'earlier attempts stay recorded');
  const asset = (await f.post('/v1/assets', { competition_id: c.id, type: 'html', mime_type: 'text/html', content_base64: Buffer.from(page()).toString('base64') }, ann.token)).data;
  const again = await f.post(`/v1/competitions/${c.id}/submissions`, { title: 'One more try', artifacts: [{ asset_id: asset.id }] }, ann.token);
  assert.equal(again.data.code, 'DUPLICATE_SUBMISSION', JSON.stringify([asset, again.data]));
  // Three failed attempts are the limit.
  for (let i = 0; i < 3; i++) { await f.enter(ben.token, c.id, page('', false)); await f.settle(); }
  const fourth = (await f.post('/v1/assets', { competition_id: c.id, type: 'html', mime_type: 'text/html', content_base64: Buffer.from(page()).toString('base64') }, ben.token)).data;
  const refused = await f.post(`/v1/competitions/${c.id}/submissions`, { title: 'Fourth attempt', artifacts: [{ asset_id: fourth.id }] }, ben.token);
  assert.equal(refused.data.code, 'DUPLICATE_SUBMISSION', JSON.stringify([fourth, refused.data]).slice(0, 600));
  assert.match(refused.data.detail, /At most 3 attempts/);
  // The buyer sees one qualified entry from Ann, nothing from Ben.
  assert.deepEqual((await f.get(`/v1/competitions/${c.id}/submissions`, b)).data.items.map((x: any) => x.id), [second.id]);
});

test('house agents revise a failed attempt from its checks: attempt 2 passes, then they stop', async t => {
  const calls: { revision?: any }[] = [];
  const atelier = streamingHouseAgent({ id: 'agent_house_atelier', name: 'Atelier', style: '.', description: '.' }, async (_ctx, _p, onText, revision) => {
    calls.push({ revision });
    const html = revision ? page() : page('', false); // the first page has no opening hours
    onText(html);
    return { text: html, stopReason: 'end_turn' };
  });
  const f = await fixture(t, { houseAgents: { agent_house_atelier: atelier }, progressIntervalMs: 0 });
  const b = await f.buyer();
  const { c } = await f.open(b);
  await f.settle();
  assert.equal(calls.length, 2, 'one revision, and nothing after the pass');
  assert.equal(calls[0].revision, undefined);
  assert.deepEqual(calls[1].revision.failed.map((x: any) => x.requirement), ['Shows opening hours.'], 'the revision gets the failed requirement');
  assert.match(calls[1].revision.html, /^<!doctype html>/, 'and its own previous page');
  const [p] = (await f.get(`/v1/competitions/${c.id}`, b)).data.build_progress;
  assert.deepEqual([p.state, p.attempt, p.max_attempts], ['qualified', 2, 3]);
  assert.deepEqual(p.missed_requirement_ids, ['req_hours'], 'the buyer can see which requirement attempt 1 missed (by ID)');
  assert.equal((await f.get(`/v1/competitions/${c.id}/submissions`, b)).data.items.length, 1);
});

test('state survives a restart; an operation interrupted mid-call resumes with the same request ID', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'provable-api-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const dbPath = join(dir, 'api.db');
  const f1 = await fixture(t, { dbPath });
  const b = await f1.buyer();
  const ann = await f1.agent(await f1.operator('PAYERANN0001', 'Ann'), 'Alpha');
  const { c } = await f1.open(b);
  const s = await f1.enter(ann.token, c.id); await f1.settle();
  assert.equal((await f1.get(`/v1/submissions/${s.id}`, ann.token)).data.qualification_status, 'qualified');
  // The capture call dies with an unknown outcome, then the process stops before any retry.
  f1.fake.controls.failNext = { op: 'captureAuthorization', error: new ProviderError('connection reset', 'unknown') };
  await f1.post(`/v1/competitions/${c.id}/selection`, { submission_id: s.id }, b);
  await f1.api.idle(); await f1.api.work(); await f1.api.idle();
  const journaled = new Database(dbPath, { readonly: true }).prepare("SELECT json FROM docs WHERE kind = 'operation'").all()
    .map((r: any) => JSON.parse(r.json)).find((o: any) => o.kind === 'capture_authorization');
  assert.equal(journaled.state, 'unknown');
  await f1.api.app.close(); f1.store.close();

  const f2 = await fixture(t, { dbPath });
  assert.equal((await f2.get(`/v1/competitions/${c.id}`, b)).data.outcome, 'winner_selected', 'buyer token, competition and decision survive');
  assert.equal((await f2.get('/v1/agents/me', ann.token)).data.name, 'Alpha');
  await f2.advance(120);
  const retried = f2.fake.controls.calls.filter(x => x.op === 'captureAuthorization');
  assert.ok(retried.length >= 1);
  assert.ok(retried.every(x => x.requestId === journaled.request_id), 'every retry after the restart reuses the journaled PayPal-Request-Id');
});

test('PayPal returns the buyer to the allowed site they started on, never to an arbitrary origin', async t => {
  const f = await fixture(t);
  const b = await f.buyer();
  const returnOf = (checkout: any) => new URL(checkout.approval_url).searchParams.get('return_url')!;
  const mine = (await f.post('/v1/competitions', brief, b)).data;
  const fromCanonical = await f.request('POST', `/v1/competitions/${mine.id}/checkout`, undefined, b, undefined, { origin: WEB });
  assert.ok(returnOf(fromCanonical.data).startsWith(`${WEB}/competitions/${mine.id}?paypal=return`));
  const other = (await f.post('/v1/competitions', brief, b)).data;
  const fromLocal = await f.request('POST', `/v1/competitions/${other.id}/checkout`, undefined, b, undefined, { origin: 'http://127.0.0.1:3000' });
  assert.ok(returnOf(fromLocal.data).startsWith('http://127.0.0.1:3000/competitions/'));
  const third = (await f.post('/v1/competitions', brief, b)).data;
  const fromEvil = await f.request('POST', `/v1/competitions/${third.id}/checkout`, undefined, b, undefined, { origin: 'https://evil.example' });
  assert.ok(returnOf(fromEvil.data).startsWith(`${WEB}/competitions/`), 'unknown origins fall back to the canonical site');
});

test('KERNEL-rendered entries: screenshot-only previews, and phone requirements judged by the measured overflow', async t => {
  const overflowFor = new Map<string, number>();
  let failNext = false;
  const renderer: PageRenderer = { name: 'fake-kernel', async render(html) {
    if (failNext) { failNext = false; throw new Error('browser unavailable'); }
    return { desktop: Buffer.from(`DESKTOP-JPEG:${html.length}`), phone: Buffer.from('PHONE-JPEG'), desktopHeight: 1900, phoneHeight: 2400,
      phoneOverflowPx: [...overflowFor].find(([needle]) => html.includes(needle))?.[1] ?? 0, consoleErrors: [], blockedRequests: [] };
  } };
  const f = await fixture(t, { renderer });
  assert.equal((await f.get('/v1/config', null)).data.capabilities.browser_previews, true);
  const b = await f.buyer();
  const ann = await f.agent(await f.operator('PAYERANN0001', 'Ann'), 'Alpha');
  const ben = await f.agent(await f.operator('PAYERBEN0002', 'Ben'), 'Beta');
  const { c } = await f.open(b);
  const good = await f.enter(ann.token, c.id, page());
  overflowFor.set('too-wide-marker', 350);
  const wide = await f.enter(ben.token, c.id, page('<div class="too-wide-marker" style="width:740px">wide</div>'));
  await f.settle();

  const gallery = (await f.get(`/v1/competitions/${c.id}/submissions`, b)).data.items;
  assert.deepEqual(gallery.map((s: any) => s.id), [good.id], 'the page that scrolls sideways on a phone does not qualify');
  const art = gallery[0].artifacts[0];
  assert.equal(art.preview.mime_type, 'image/jpeg'); assert.equal(art.preview.width, 1280); assert.equal(art.preview.height, 1900);
  const desktop = await f.get(new URL(art.preview.url).pathname, b);
  assert.equal(desktop.headers['content-type'], 'image/jpeg'); assert.match(desktop.data.toString(), /^DESKTOP-JPEG:/);
  const phoneUrl = new URL(art.preview.phone_url);
  const phone = await f.get(`${phoneUrl.pathname}${phoneUrl.search}`, b);
  assert.equal(phone.data.toString(), 'PHONE-JPEG');
  assert.ok(!desktop.data.toString().includes('<html'), 'buyers never receive the markup once screenshots exist');
  const failed = (await f.get(`/v1/submissions/${wide.id}`, ben.token)).data.qualification;
  assert.equal(failed.failure_code, 'requirements_not_met');
  assert.match(failed.checks.find((x: any) => x.requirement_id === 'req_mobile').reason, /scrolls sideways by 350px/);

  // Renderer outage: the entry is still judged, but the buyer gets no preview rather than the markup.
  const c2 = (await f.open(b)).c;
  failNext = true;
  await f.enter(ann.token, c2.id, page()); await f.settle();
  const unrendered = (await f.get(`/v1/competitions/${c2.id}/submissions`, b)).data.items[0].artifacts[0];
  assert.equal(unrendered.preview.mime_type, 'text/html'); assert.equal(unrendered.preview.phone_url, null);
  const closed = await f.get(new URL(unrendered.preview.url).pathname, b);
  assert.equal(closed.status, 409, 'fail closed: with a renderer configured, a buyer never gets markup, even if the render failed');
  assert.equal((await f.get(new URL(unrendered.preview.url).pathname, ann.token)).headers['content-type'], 'text/html', 'the agent can still see its own page');
});

test('keyboard focus measured in the browser is ground truth for focus requirements (judge text and keyword judge)', async () => {
  const requirements = [{ id: 'req_keys', description: 'Navigation and FAQ controls are keyboard accessible with visible focus styles.' }];
  const base = { phoneOverflowPx: 0, consoleErrors: [], blockedRequests: [] };
  const focus = (visible: boolean[]) => ({ tabStops: visible.length, visibleIndicators: visible.filter(Boolean).length, complete: true,
    samples: visible.map((v, i) => ({ tag: i ? 'summary' : 'a', visible: v, nav: i === 0, faq: i > 0 })) });
  const text = judgeText({ title: 't', brief: 'b', requirements, browser: { ...base, focus: focus([true, false]) } }, '<p>x</p>');
  assert.match(text, /went through every focusable element on the page: 2 in total; 1 of 2 showed a visible focus indicator/);
  assert.match(text, /Navigation controls reached: 1 \(1 visible\)\. FAQ\/disclosure controls reached: 1 \(0 visible\)/);
  assert.match(text, /a \(nav\) visible, summary \(faq\) NOT visible/);
  assert.match(judgeText({ title: 't', brief: 'b', requirements, browser: { ...base, focus: focus([]) } }, ''), /reached no focusable element/);
  const judge = heuristicEvaluator();
  const run = (f: ReturnType<typeof focus>) => judge.qualify({ title: 't', brief: 'b', requirements, signal: AbortSignal.timeout(1000),
    artifacts: [{ metadata: {} as any, bytes: new TextEncoder().encode(page()) }], browser: { ...base, focus: f } });
  assert.equal((await run(focus([true, true]))).status, 'qualified');
  assert.equal((await run(focus([true, false]))).status, 'failed');
  assert.equal((await run(focus([]))).status, 'failed', 'nothing focusable is not keyboard accessible');
});

test('preview CSP precedes agent markup even when a script sits before <head>', () => {
  const out = previewHtml('<!DOCTYPE html><script>steal()</script><html><head></head><body>x</body></html>');
  assert.ok(out.indexOf('Content-Security-Policy') < out.indexOf('<script>steal()'));
});
