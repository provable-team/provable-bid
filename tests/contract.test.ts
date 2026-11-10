import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createMock } from '../apps/mock-api/src/app.js';
import { contract, operations, resolve, validator, validateResponse } from '../scripts/contract.js';
import { createApiClient, type components } from '../packages/api-client/src/index.js';

const covered = new Set<string>();
const brief: components['schemas']['CreateCompetition'] = { title: 'Five Minute Scenes', brief: 'Write a scene with a garden on Mars.', bid: { currency: 'USD', amount_minor: 500 },
  submission_window_seconds: 300, decision_window_seconds: 300, requirements: [{ id: 'req_mars', description: 'A garden on Mars.' }], accepted_terms_version: 'sandbox-v1' };
const grade = { status: 'qualified', failure_code: null, checks: [{ requirement_id: 'req_mars', passed: true, reason: 'Garden on Mars is explicit.' }], reason: 'Requirements satisfied.', evaluator_version: 'fixture-v1' };
const content = 'ASTRONAUT A: A garden on Mars! ASTRONAUT B: It is beautiful. '.repeat(10);
async function fixture(t: any) {
  const { app } = await createMock({ now: () => Date.parse('2026-11-10T18:00:00.000Z') });
  t.after(() => app.close());
  let sequence = 0;
  async function request(method: 'GET' | 'POST', path: string, body?: any, token: string | null = 'buyer-demo', key?: string | null, extraHeaders: Record<string, string> = {}) {
    const headers: Record<string, string> = { ...extraHeaders };
    if (token) headers.authorization = `Bearer ${token}`;
    if (method === 'POST' && key !== null) headers['idempotency-key'] = key ?? `command_${++sequence}`;
    const response = await app.inject({ method, url: path, headers, ...(body !== undefined ? { payload: body } : {}) });
    const isText = response.headers['content-type']?.startsWith('text/plain');
    const isImage = String(response.headers['content-type']).startsWith('image/');
    const data = isImage ? response.rawPayload : isText ? response.body : response.json();
    const op = operations.find(o => o.method === method.toLowerCase() && new RegExp(`^${o.path.replace(/\{[^}]+\}/g, '[^/]+')}$`).test(path.split('?')[0]));
    assert.ok(op, `Contract operation for ${method} ${path}`);
    validateResponse(op, response.statusCode, String(response.headers['content-type']), data);
    assert.ok(response.headers['x-request-id']);
    if (response.statusCode < 400) covered.add(op.operationId);
    return { status: response.statusCode, data, headers: response.headers };
  }
  const post = (path: string, body?: any, token?: string, key?: string) => request('POST', path, body, token, key);
  async function open() {
    const created = await post('/v1/competitions', brief); assert.equal(created.status, 201);
    const c = created.data;
    const checkout = await post(`/v1/competitions/${c.id}/checkout`); assert.equal(checkout.status, 201);
    const auth = await post(`/v1/competitions/${c.id}/authorize`); assert.equal(auth.status, 202);
    assert.equal(auth.data.authorization_state, 'authorized');
    return { c: (await request('GET', `/v1/competitions/${c.id}`)).data, payment: auth.data, checkout: checkout.data };
  }
  async function upload(c: any, token = 'agent-alpha', type: 'text' | 'image' = 'text', mime_type = 'text/plain', bytes = Buffer.from(content)) {
    const uploaded = await post('/v1/assets', { competition_id: c.id, type, mime_type, content_base64: bytes.toString('base64') }, token);
    assert.equal(uploaded.status, 201); return uploaded.data;
  }
  async function submit(c: any, token = 'agent-alpha', qualified = true) {
    const asset = await upload(c, token);
    const r = await post(`/v1/competitions/${c.id}/submissions`, { title: 'A Green Horizon', artifacts: [{ asset_id: asset.id }] }, token);
    assert.equal(r.status, 201);
    if (qualified) { const g = await post(`/__mock/submissions/${r.data.id}/qualification`, grade, 'admin-demo'); assert.equal(g.status, 200); return g.data; }
    return r.data;
  }
  const advance = (seconds: number) => post('/__mock/advance', { seconds }, 'admin-demo');
  const observe = (paymentId: string, observation: string) => post(`/__mock/payments/${paymentId}/observation`, { observation }, 'admin-demo');
  return { app, request, post, open, upload, submit, advance, observe };
}

test('OpenAPI 3.1 structure, references, examples, operation IDs, and mutation keys are valid', () => {
  assert.equal(contract.openapi, '3.1.0');
  assert.equal(new Set(operations.map(o => o.operationId)).size, operations.length);
  const walk = (value: any) => {
    if (!value || typeof value !== 'object') return;
    if (value.$ref) assert.ok(resolve(value));
    for (const child of Object.values(value)) walk(child);
  };
  walk(contract);
  for (const op of operations) {
    assert.ok(op.responses['400'] && op.responses['409'] && op.responses['503']);
    const rb = resolve(op.requestBody);
    if (rb) for (const media of Object.values(rb.content) as any[]) {
      if (media.example) assert.ok(validator(media.schema)(media.example), `${op.operationId} request example`);
    }
    if (op.method === 'post' && op.operationId !== 'receivePayPalWebhook') assert.ok(op.parameters.some((p: any) => p.name === 'Idempotency-Key' && p.required));
  }
});

test('Five Minute Scenes: authorize, early select, confirmed capture, private delivery, and additional $5 purchase', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('GET', '/health', undefined, null)).status, 200);
  assert.equal((await f.request('GET', '/v1/config', undefined, null)).data.capabilities.payouts, 'simulated');
  const { c, payment } = await f.open();
  assert.equal(Date.parse(c.submission_deadline) - Date.parse(c.opens_at), 300_000);
  assert.equal(Date.parse(c.decision_deadline) - Date.parse(c.qualification_deadline), 300_000);
  const s = await f.submit(c);
  assert.ok(!('content' in s)); assert.ok(s.artifacts[0].preview.text_excerpt.length <= 160 && s.artifacts[0].preview.text_excerpt.length <= content.length / 10);
  assert.equal((await f.request('GET', `/v1/submissions/${s.id}`)).status, 200);
  const first = await f.post(`/v1/competitions/${c.id}/selection`, { submission_id: s.id });
  assert.equal(first.status, 202); assert.equal(first.data.delivery_unlocked, false);
  assert.equal((await f.request('GET', `/v1/competitions/${c.id}`)).data.state, 'open');
  assert.equal((await f.post(`/v1/purchases/${first.data.id}/delivery-access`)).data.code, 'DELIVERY_LOCKED');
  await f.observe(payment.id, 'pending');
  assert.equal((await f.request('GET', `/v1/payments/${payment.id}`)).data.capture_state, 'pending');
  await f.observe(payment.id, 'completed');
  const delivery = await f.post(`/v1/purchases/${first.data.id}/delivery-access`);
  assert.equal(delivery.status, 201); assert.equal(delivery.headers['cache-control'], 'no-store');
  assert.equal((await f.request('GET', new URL(delivery.data.artifacts[0].url).pathname)).data, content);
  const second = await f.submit(c, 'agent-beta'); // Still open after first winner.
  const add = await f.post(`/v1/competitions/${c.id}/additional-purchases`, { submission_id: second.id });
  assert.equal(add.status, 201); assert.equal(add.data.price.amount_minor, 500); assert.equal(add.data.checkout.intent, 'CAPTURE');
  assert.notEqual(add.data.payment_id, payment.id);
  await f.post(`/v1/purchases/${add.data.id}/capture`);
  assert.equal((await f.request('GET', `/v1/purchases/${add.data.id}`)).data.delivery_unlocked, false);
  await f.observe(add.data.payment_id, 'completed');
  assert.equal((await f.request('GET', `/v1/purchases/${add.data.id}`)).data.delivery_unlocked, true);
  await f.advance(420);
  const closed = (await f.request('GET', `/v1/competitions/${c.id}`)).data;
  assert.equal(closed.state, 'closed'); assert.equal(closed.outcome, 'winner_selected');
  const ledger = (await f.request('GET', `/v1/competitions/${c.id}/settlement`)).data;
  assert.deepEqual(ledger.allocations.map((a: any) => a.amount.amount_minor), [450, 450]);
  assert.ok(ledger.allocations.every((a: any) => a.payout_state === 'simulated' && a.provider_payout_id === null));
  assert.equal((await f.request('GET', '/v1/agents/me/earnings', undefined, 'agent-alpha')).data.items.length, 1);
  assert.equal((await f.request('GET', `/v1/competitions/${c.id}/submissions`)).data.items.length, 2);
  assert.equal((await f.request('GET', `/v1/competitions/${c.id}/purchases`)).data.items.length, 2);
  assert.equal((await f.request('GET', `/v1/competitions/${c.id}/purchases`, undefined, 'buyer-other')).status, 404);
  assert.equal((await f.request('GET', '/v1/competitions')).data.items.length, 1);
});

test('Idempotency survives changed JSON key order, rejects changed bodies, and prevents duplicate first charges across keys', async t => {
  const f = await fixture(t);
  const one = await f.post('/v1/competitions', brief, 'buyer-demo', 'create_once');
  const two = await f.post('/v1/competitions', Object.fromEntries(Object.entries(brief).reverse()), 'buyer-demo', 'create_once');
  assert.deepEqual(two.data, one.data);
  assert.equal((await f.post('/v1/competitions', { ...brief, title: 'Changed' }, 'buyer-demo', 'create_once')).data.code, 'IDEMPOTENCY_CONFLICT');
  const { c, payment } = await f.open(); const s = await f.submit(c);
  const responses = await Promise.all([1, 2].map(i => f.post(`/v1/competitions/${c.id}/selection`, { submission_id: s.id }, 'buyer-demo', `selection_${i}`)));
  assert.equal(responses[0].data.id, responses[1].data.id);
  const beta = await f.submit(c, 'agent-beta');
  assert.equal((await f.post(`/v1/competitions/${c.id}/selection`, { submission_id: beta.id })).data.code, 'DECISION_LOCKED');
  assert.equal((await f.post(`/v1/competitions/${c.id}/rejection`)).data.code, 'DECISION_LOCKED');
  const op = (await f.request('GET', `/v1/payments/${payment.id}`)).data.operation_id;
  await f.observe(payment.id, 'completed'); await f.observe(payment.id, 'completed');
  assert.equal((await f.request('GET', `/v1/payments/${payment.id}`)).data.operation_id, op);
  assert.equal((await f.request('GET', `/v1/competitions/${c.id}/settlement`)).data.allocations.length, 1);
});

test('Reject-all captures exactly 10 percent and conserves cents across equal principal shares', async t => {
  const f = await fixture(t); const { c, payment } = await f.open(); await f.submit(c); await f.submit(c, 'agent-beta');
  assert.equal((await f.post(`/v1/competitions/${c.id}/rejection`)).status, 409);
  await f.advance(420);
  const rejection = await f.post(`/v1/competitions/${c.id}/rejection`); assert.equal(rejection.status, 202);
  assert.equal(rejection.data.purpose, 'participation_fee');
  assert.equal((await f.request('GET', `/v1/competitions/${c.id}/settlement`)).data.allocations.length, 0);
  const complete = await f.observe(payment.id, 'completed'); assert.equal(complete.data.captured_minor, 50);
  assert.equal(complete.data.authorization_state, 'captured');
  const allocations = (await f.request('GET', `/v1/competitions/${c.id}/settlement`)).data.allocations;
  assert.deepEqual(allocations.map((a: any) => a.amount.amount_minor), [23, 22]);
  assert.equal(allocations.reduce((sum: number, a: any) => sum + a.amount.amount_minor, 0), 45);
  assert.ok(allocations.every((a: any) => a.kind === 'participation'));
});

test('Decision deadline is exclusive and serializes timeout before late selection', async t => {
  const f = await fixture(t); const { c, payment } = await f.open(); const s = await f.submit(c);
  await f.advance(720);
  const selection = await f.post(`/v1/competitions/${c.id}/selection`, { submission_id: s.id });
  assert.equal(selection.status, 409);
  const pay = (await f.request('GET', `/v1/payments/${payment.id}`)).data;
  assert.equal(pay.purpose, 'participation_fee'); assert.equal(pay.capture_state, 'pending');
  assert.equal((await f.post(`/v1/competitions/${c.id}/rejection`)).data.operation_id, pay.operation_id);
});

test('A choice committed just before deadline survives timeout without a participation charge', async t => {
  const f = await fixture(t); const { c, payment } = await f.open(); const s = await f.submit(c);
  await f.advance(719); assert.equal((await f.post(`/v1/competitions/${c.id}/selection`, { submission_id: s.id })).status, 202);
  await f.advance(1); const pay = (await f.request('GET', `/v1/payments/${payment.id}`)).data;
  assert.equal(pay.purpose, 'first_purchase');
});

test('Empty or objectively failed competitions void without a fee', async t => {
  for (const failed of [false, true]) {
    const f = await fixture(t); const { c, payment } = await f.open();
    if (failed) {
      const s = await f.submit(c, 'agent-alpha', false);
      await f.post(`/__mock/submissions/${s.id}/qualification`, { ...grade, status: 'failed', failure_code: 'requirements_not_met', checks: [{ ...grade.checks[0], passed: false }] }, 'admin-demo');
    }
    await f.advance(720);
    assert.equal((await f.request('GET', `/v1/competitions/${c.id}`)).data.outcome, 'no_qualifiers');
    const pay = (await f.request('GET', `/v1/payments/${payment.id}`)).data;
    assert.equal(pay.authorization_state, 'voided'); assert.equal(pay.captured_minor, 0);
  }
});

test('Spam and invalid outputs fail prechecks without inventing failed creative requirements', async t => {
  for (const failure_code of ['spam', 'invalid_output']) {
    const f = await fixture(t); const { c, payment } = await f.open(); const s = await f.submit(c, 'agent-alpha', false);
    const rejected = await f.post(`/__mock/submissions/${s.id}/qualification`, { ...grade, status: 'failed', failure_code, checks: [] }, 'admin-demo');
    assert.equal(rejected.status, 200); assert.equal(rejected.data.qualification_status, 'failed');
    await f.advance(420);
    assert.equal((await f.request('GET', `/v1/competitions/${c.id}`)).data.outcome, 'no_qualifiers');
    assert.equal((await f.request('GET', `/v1/payments/${payment.id}`)).data.authorization_state, 'voided');
  }
});

test('Evaluator infrastructure errors cancel an undecided competition even when another entry qualifies', async t => {
  const f = await fixture(t); const { c, payment } = await f.open(); const s = await f.submit(c, 'agent-alpha', false); await f.submit(c, 'agent-beta');
  await f.advance(420);
  assert.equal((await f.request('GET', `/v1/competitions/${c.id}`)).data.outcome, 'infrastructure_failure');
  assert.equal((await f.request('GET', `/v1/payments/${payment.id}`)).data.authorization_state, 'voided');
  assert.equal((await f.post(`/__mock/submissions/${s.id}/qualification`, grade, 'admin-demo')).status, 409);
});

test('Submission deadline, duplicate principal limit, and qualification consistency are enforced', async t => {
  const f = await fixture(t); const { c } = await f.open(); const s = await f.submit(c, 'agent-alpha', false);
  assert.equal((await f.post(`/v1/competitions/${c.id}/submissions`, { title: 'More', artifacts: [{ asset_id: s.artifacts[0].asset_id }] }, 'agent-alpha')).data.code, 'DUPLICATE_SUBMISSION');
  assert.equal((await f.post(`/__mock/submissions/${s.id}/qualification`, { ...grade, checks: [] }, 'admin-demo')).status, 400);
  assert.equal((await f.post(`/v1/competitions/${c.id}/selection`, { submission_id: s.id })).status, 409);
  await f.advance(300);
  assert.equal((await f.post(`/v1/competitions/${c.id}/submissions`, { title: 'Late', artifacts: [{ asset_id: s.artifacts[0].asset_id }] }, 'agent-beta')).data.code, 'DEADLINE_PASSED');
  assert.equal((await f.post(`/__mock/submissions/${s.id}/qualification`, grade, 'admin-demo')).status, 200); // Grace permits grading, not receipt.
});

test('Pending/unknown captures do not unlock work; definitive failure does not switch to participation fee', async t => {
  const f = await fixture(t); const { c, payment } = await f.open(); const s = await f.submit(c);
  const purchase = (await f.post(`/v1/competitions/${c.id}/selection`, { submission_id: s.id })).data;
  await f.observe(payment.id, 'unknown');
  assert.equal((await f.request('GET', `/v1/payments/${payment.id}`)).data.operation_state, 'unknown');
  assert.equal((await f.post(`/v1/purchases/${purchase.id}/delivery-access`)).status, 409);
  await f.post(`/v1/payments/${payment.id}/reconcile`, undefined, 'admin-demo');
  await f.observe(payment.id, 'failed'); await f.advance(720);
  const pay = (await f.request('GET', `/v1/payments/${payment.id}`)).data;
  assert.equal(pay.capture_state, 'failed'); assert.equal(pay.purpose, 'first_purchase');
  assert.equal((await f.request('GET', `/v1/purchases/${purchase.id}`)).data.status, 'payment_failed');
});

test('Lost/expired authorization cancels without capturing', async t => {
  const f = await fixture(t); const { c, payment } = await f.open();
  await f.observe(payment.id, 'expired');
  assert.equal((await f.request('GET', `/v1/competitions/${c.id}`)).data.state, 'cancelled');
  assert.equal((await f.request('GET', `/v1/payments/${payment.id}`)).data.captured_minor, 0);
});

test('Refund requests and confirmed refunds lock existing URLs and reverse allocations independently of capture', async t => {
  const f = await fixture(t); const { c, payment } = await f.open(); const s = await f.submit(c);
  const purchase = (await f.post(`/v1/competitions/${c.id}/selection`, { submission_id: s.id })).data;
  await f.observe(payment.id, 'completed');
  const access = (await f.post(`/v1/purchases/${purchase.id}/delivery-access`)).data;
  const ref = await f.post(`/v1/payments/${payment.id}/refunds`, { reason: 'Demo refund' }, 'admin-demo');
  assert.equal(ref.status, 202); assert.equal(ref.data.state, 'queued');
  assert.equal((await f.request('GET', `/v1/refunds/${ref.data.id}`)).status, 200);
  assert.equal((await f.request('GET', new URL(access.artifacts[0].url).pathname)).data.code, 'DELIVERY_LOCKED');
  assert.equal((await f.post(`/v1/payments/${payment.id}/refunds`, { reason: 'Again' }, 'admin-demo')).status, 409);
  await f.observe(payment.id, 'refunded');
  assert.equal((await f.request('GET', `/v1/refunds/${ref.data.id}`)).data.state, 'completed');
  const pay = (await f.request('GET', `/v1/payments/${payment.id}`)).data;
  assert.equal(pay.capture_state, 'completed'); assert.equal(pay.refunded_minor, 500);
  assert.equal((await f.request('GET', `/v1/purchases/${purchase.id}`)).data.status, 'refunded');
  assert.equal((await f.request('GET', `/v1/competitions/${c.id}/settlement`)).data.allocations[0].ledger_state, 'reversed');
});

test('A dispute freezes future delivery and payout; access also expires after sixty seconds', async t => {
  const f = await fixture(t); const { c, payment } = await f.open(); const s = await f.submit(c);
  const purchase = (await f.post(`/v1/competitions/${c.id}/selection`, { submission_id: s.id })).data;
  await f.observe(payment.id, 'completed');
  const access = (await f.post(`/v1/purchases/${purchase.id}/delivery-access`)).data;
  await f.advance(60); assert.equal((await f.request('GET', new URL(access.artifacts[0].url).pathname)).status, 409);
  await f.observe(payment.id, 'disputed');
  assert.equal((await f.post(`/v1/purchases/${purchase.id}/delivery-access`)).status, 409);
  assert.equal((await f.request('GET', `/v1/purchases/${purchase.id}`)).data.status, 'disputed');
  assert.equal((await f.request('GET', `/v1/competitions/${c.id}/settlement`)).data.allocations[0].payout_state, 'blocked');
});

test('Authentication/ownership/admin boundaries prevent ID-based cross-account access', async t => {
  const f = await fixture(t); const { c, payment } = await f.open(); const s = await f.submit(c);
  assert.equal((await f.request('GET', '/v1/competitions', undefined, null)).status, 401);
  assert.equal((await f.request('GET', '/v1/competitions', undefined, null, null, { authorization: 'buyer-demo' })).status, 401);
  assert.equal((await f.request('GET', `/v1/payments/${payment.id}`, undefined, 'buyer-other')).status, 404);
  assert.equal((await f.request('GET', `/v1/submissions/${s.id}`, undefined, 'agent-beta')).status, 404);
  assert.equal((await f.request('GET', `/v1/competitions/${c.id}/submissions`, undefined, 'agent-beta')).data.items.length, 0);
  assert.equal((await f.post(`/v1/competitions/${c.id}/selection`, { submission_id: s.id }, 'buyer-other')).status, 404);
  assert.equal((await f.post('/__mock/advance', { seconds: 1 })).status, 403);
  assert.equal((await f.post(`/v1/payments/${payment.id}/refunds`, { reason: 'No rights' })).status, 403);
});

test('Malformed amounts, currency, windows, terms, and missing idempotency keys return explicit problems', async t => {
  const f = await fixture(t);
  for (const changed of [
    { bid: { currency: 'USD', amount_minor: 5.5 } }, { bid: { currency: 'EUR', amount_minor: 500 } },
    { bid: { currency: 'USD', amount_minor: -1 } }, { bid: { currency: 'USD', amount_minor: 0 } },
    { submission_window_seconds: 299 }, { submission_window_seconds: 86401 }, { decision_window_seconds: 86401 },
    { unknown_field: 'must not be accepted' },
  ]) assert.equal((await f.post('/v1/competitions', { ...brief, ...changed })).status, 400);
  assert.equal((await f.request('POST', '/v1/competitions', brief, 'buyer-demo', null)).status, 400);
  assert.equal((await f.post('/v1/competitions', { ...brief, accepted_terms_version: 'old' })).status, 422);
});

test('Pagination is stable and validates cursor/limit', async t => {
  const f = await fixture(t); await f.post('/v1/competitions', brief); await f.post('/v1/competitions', { ...brief, title: 'Second' });
  const first = (await f.request('GET', '/v1/competitions?limit=1')).data;
  assert.equal(first.items.length, 1); assert.ok(first.next_cursor);
  const second = (await f.request('GET', `/v1/competitions?limit=1&cursor=${first.next_cursor}`)).data;
  assert.equal(second.items.length, 1); assert.notEqual(first.items[0].id, second.items[0].id); assert.equal(second.next_cursor, null);
  assert.equal((await f.request('GET', '/v1/competitions?limit=0')).status, 400);
  assert.equal((await f.request('GET', '/v1/competitions?cursor=invalid')).status, 400);
});

test('Verified duplicate/out-of-order webhook envelopes cannot forge payment completion or regress it', async t => {
  const f = await fixture(t); const { c, payment } = await f.open(); const s = await f.submit(c);
  const purchase = (await f.post(`/v1/competitions/${c.id}/selection`, { submission_id: s.id })).data;
  const headers = { 'paypal-transmission-id': 'transmission_1', 'paypal-transmission-time': '2026-11-10T18:00:00Z',
    'paypal-transmission-sig': 'MOCK_VERIFIED', 'paypal-cert-url': 'https://mock.invalid/cert', 'paypal-auth-algo': 'MOCK' };
  const event = { id: 'event_1', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'untrusted_capture', status: 'COMPLETED' } };
  assert.equal((await f.request('POST', '/v1/webhooks/paypal', event, null, null, { ...headers, 'paypal-transmission-sig': 'bad' })).status, 400);
  for (let i = 0; i < 2; i++) assert.equal((await f.request('POST', '/v1/webhooks/paypal', event, null, null, headers)).status, 200);
  assert.equal((await f.request('GET', `/v1/purchases/${purchase.id}`)).data.delivery_unlocked, false);
  await f.observe(payment.id, 'completed');
  await f.request('POST', '/v1/webhooks/paypal', { ...event, id: 'event_old', event_type: 'PAYMENT.CAPTURE.PENDING' }, null, null, headers);
  assert.equal((await f.request('GET', `/v1/purchases/${purchase.id}`)).data.delivery_unlocked, true);
});

test('Generated TypeScript client talks to the real HTTP mock with typed body, headers, and responses', async t => {
  const f = await fixture(t); const address = await f.app.listen({ host: '127.0.0.1', port: 0 });
  const client = createApiClient({ baseUrl: address, token: 'buyer-demo' });
  const result = await client.POST('/v1/competitions', { params: { header: { 'Idempotency-Key': 'typed_client_1' } }, body: brief });
  assert.equal(result.response.status, 201); assert.equal(result.data?.bid.amount_minor, 500);
  const read = await client.GET('/v1/competitions/{competition_id}', { params: { path: { competition_id: result.data!.id } } });
  assert.equal(read.data?.title, 'Five Minute Scenes');
});

test('Text and image artifacts expose qualified safe previews and release each original only after confirmed payment', async t => {
  const f = await fixture(t); const { c, payment } = await f.open();
  const imageBytes = await sharp({ create: { width: 960, height: 640, channels: 3, background: '#8b2cf5' } }).png().toBuffer();
  const image = await f.upload(c, 'agent-alpha', 'image', 'image/png', imageBytes);
  const text = await f.upload(c);
  assert.equal((await f.request('GET', `/v1/assets/${image.id}`, undefined, 'agent-alpha')).data.width, 960);
  assert.equal((await f.request('GET', `/v1/assets/${image.id}`, undefined, 'buyer-demo')).status, 404);
  assert.equal((await f.request('GET', new URL(image.preview.url).pathname)).status, 404);
  assert.equal((await f.request('GET', new URL(image.preview.url).pathname, undefined, 'agent-beta')).status, 404);
  const submitted = await f.post(`/v1/competitions/${c.id}/submissions`, { title: 'Visual scene', artifacts: [{ asset_id: image.id }, { asset_id: text.id }] }, 'agent-alpha');
  assert.equal(submitted.status, 201); const s = submitted.data;
  assert.equal(s.artifacts.length, 2); assert.ok(s.artifacts.every((a: any) => !('content' in a) && !('original_url' in a)));
  assert.equal((await f.request('GET', `/v1/submissions/${s.id}`)).status, 404);
  assert.equal((await f.request('GET', `/v1/competitions/${c.id}/submissions`)).data.items.length, 0);
  assert.equal((await f.request('GET', `/v1/competitions/${c.id}/submissions`, undefined, 'admin-demo')).data.items.length, 1);
  await f.post(`/__mock/submissions/${s.id}/qualification`, grade, 'admin-demo');
  const preview = await f.request('GET', new URL(image.preview.url).pathname);
  assert.equal(preview.status, 200); assert.equal(preview.headers['cache-control'], 'no-store'); assert.equal(preview.headers['x-content-type-options'], 'nosniff');
  const previewMeta = await sharp(preview.data).metadata();
  assert.equal(previewMeta.format, 'png'); assert.ok(previewMeta.width! <= 320 && previewMeta.height! <= 240);
  assert.notDeepEqual(preview.data, imageBytes);
  assert.equal((await f.request('GET', new URL(text.preview.url).pathname)).data, text.preview.text_excerpt);
  const purchase = (await f.post(`/v1/competitions/${c.id}/selection`, { submission_id: s.id })).data;
  assert.equal((await f.post(`/v1/purchases/${purchase.id}/delivery-access`)).status, 409);
  await f.observe(payment.id, 'completed');
  const access = (await f.post(`/v1/purchases/${purchase.id}/delivery-access`)).data;
  assert.equal(access.artifacts.length, 2);
  const imageDownload = await f.request('GET', new URL(access.artifacts[0].url).pathname);
  assert.deepEqual(imageDownload.data, imageBytes); // Exact protected original, not preview.
  assert.equal((await f.request('GET', new URL(access.artifacts[0].url).pathname, undefined, 'buyer-other')).status, 404);
  await f.observe(payment.id, 'disputed');
  assert.equal((await f.request('GET', new URL(access.artifacts[0].url).pathname)).status, 409);
});

test('Asset ingestion enforces ownership, competition binding, decoded media, limits, and no remote URL input', async t => {
  const f = await fixture(t); const { c } = await f.open(); const other = await f.open();
  const asset = await f.upload(c);
  const submitPath = `/v1/competitions/${c.id}/submissions`;
  assert.equal((await f.post(submitPath, { title: 'Stolen', artifacts: [{ asset_id: asset.id }] }, 'agent-beta')).status, 404);
  assert.equal((await f.post(`/v1/competitions/${other.c.id}/submissions`, { title: 'Wrong brief', artifacts: [{ asset_id: asset.id }] }, 'agent-alpha')).status, 404);
  assert.equal((await f.post(submitPath, { title: 'Duplicate', artifacts: [{ asset_id: asset.id }, { asset_id: asset.id }] }, 'agent-alpha')).status, 400);
  assert.equal((await f.post(submitPath, { title: 'Old schema', content }, 'agent-beta')).status, 400);
  const input = { competition_id: c.id, type: 'image', mime_type: 'image/png', content_base64: Buffer.from('<svg onload="bad()"/>').toString('base64') };
  assert.equal((await f.post('/v1/assets', input, 'agent-beta')).status, 400);
  assert.equal((await f.post('/v1/assets', { ...input, url: 'http://127.0.0.1/private' }, 'agent-beta')).status, 400);
  assert.equal((await f.post('/v1/assets', { ...input, content_base64: '%%%%' }, 'agent-beta')).status, 400);
  assert.equal((await f.post('/v1/assets', { ...input, type: 'text', content_base64: Buffer.from('text').toString('base64') }, 'agent-beta')).status, 400);
  const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: 'red' } }).png().toBuffer();
  assert.equal((await f.post('/v1/assets', { ...input, mime_type: 'image/jpeg', content_base64: png.toString('base64') }, 'agent-beta')).status, 400);
  assert.equal((await f.post('/v1/assets', { ...input, type: 'text', mime_type: 'text/plain', content_base64: Buffer.from([0xff,0xfe]).toString('base64') }, 'agent-beta')).status, 400);
  assert.equal((await f.post('/v1/assets', { ...input, type: 'text', mime_type: 'text/plain', content_base64: Buffer.alloc(2097153, 65).toString('base64') }, 'agent-beta')).status, 400);
  await f.advance(300);
  assert.equal((await f.post('/v1/assets', { competition_id: c.id, type: 'text', mime_type: 'text/plain', content_base64: Buffer.from('late').toString('base64') }, 'agent-beta')).data.code, 'DEADLINE_PASSED');
});

test('Buyer gallery and preview access hide pending, failed, and error entries; admin and submitting agent can review', async t => {
  const f = await fixture(t); const { c } = await f.open();
  const pending = await f.submit(c, 'agent-alpha', false);
  const failed = await f.submit(c, 'agent-beta', false);
  await f.post(`/__mock/submissions/${failed.id}/qualification`, { ...grade, status: 'failed', failure_code: 'spam', checks: [] }, 'admin-demo');
  const errored = await f.submit(c, 'agent-gamma', false);
  await f.post(`/__mock/submissions/${errored.id}/qualification`, { ...grade, status: 'error', failure_code: null, checks: [] }, 'admin-demo');
  assert.equal((await f.request('GET', `/v1/competitions/${c.id}/submissions?limit=1`)).data.items.length, 0);
  assert.equal((await f.request('GET', `/v1/competitions/${c.id}/submissions`, undefined, 'admin-demo')).data.items.length, 3);
  for (const [submission, token] of [[pending, 'agent-alpha'], [failed, 'agent-beta'], [errored, 'agent-gamma']] as const) {
    assert.equal((await f.request('GET', `/v1/submissions/${submission.id}`)).status, 404);
    assert.equal((await f.request('GET', new URL(submission.artifacts[0].preview.url).pathname)).status, 404);
    assert.equal((await f.request('GET', `/v1/submissions/${submission.id}`, undefined, token)).status, 200);
    assert.equal((await f.request('GET', `/v1/submissions/${submission.id}`, undefined, 'admin-demo')).status, 200);
  }
  await f.post(`/__mock/submissions/${pending.id}/qualification`, grade, 'admin-demo');
  const gallery = (await f.request('GET', `/v1/competitions/${c.id}/submissions?limit=1`)).data;
  assert.equal(gallery.items.length, 1); assert.equal(gallery.items[0].id, pending.id); assert.equal(gallery.next_cursor, null);
});

test('Three public creative agents run idempotently, expose distinct visual work, and support an early and an additional winner', async t => {
  const f = await fixture(t); const { c, payment } = await f.open();
  const agents = (await f.request('GET', '/v1/agents', undefined, null)).data.items;
  assert.deepEqual(agents.map((a: any) => a.name), ['Neon Frame', 'Paper Sun', 'Lunar Ink']);
  for (const agent of agents) {
    const profile = await f.request('GET', `/v1/agents/${agent.id}`, undefined, null);
    assert.equal(profile.status, 200); assert.deepEqual(profile.data.capabilities, ['text', 'image']);
    assert.ok(!JSON.stringify(profile.data).match(/credential|secret|api_key|payout|provider_id/));
  }
  const path = `/v1/competitions/${c.id}/agent-runs`;
  assert.equal((await f.post(path, { agent_ids: [agents[0].id] }, 'buyer-other')).status, 404);
  assert.equal((await f.post(path, { agent_ids: [agents[0].id] }, 'agent-alpha')).status, 404);
  assert.equal((await f.post(path, { agent_ids: ['agent_unknown'] })).status, 400);
  assert.equal((await f.post(path, { agent_ids: [agents[0].id], api_key: 'forbidden' })).status, 400);
  const started = await f.post(path, { agent_ids: agents.map((a: any) => a.id) });
  assert.equal(started.status, 202); assert.equal(started.data.items.length, 3);
  assert.ok(started.data.items.every((r: any) => r.status === 'submitted' && r.submission_id));
  const repeated = await f.post(path, { agent_ids: agents.map((a: any) => a.id) }, 'admin-demo');
  assert.deepEqual(repeated.data.items.map((r: any) => r.id), started.data.items.map((r: any) => r.id));
  const listed = await f.request('GET', path);
  assert.equal(listed.data.items.length, 3);
  assert.equal((await f.request('GET', `/v1/competitions/${c.id}/submissions`)).data.items.length, 0);
  const work = (await f.request('GET', `/v1/competitions/${c.id}/submissions`, undefined, 'admin-demo')).data.items;
  assert.equal(new Set(work.map((s: any) => s.artifacts.find((a: any) => a.type === 'image').sha256)).size, 3);
  for (const submission of work) await f.post(`/__mock/submissions/${submission.id}/qualification`, grade, 'admin-demo');
  const gallery = (await f.request('GET', `/v1/competitions/${c.id}/submissions`)).data.items;
  assert.equal(gallery.length, 3);
  for (const submission of gallery) {
    const image = submission.artifacts.find((a: any) => a.type === 'image');
    const preview = await f.request('GET', new URL(image.preview.url).pathname);
    assert.equal(preview.status, 200); assert.ok((await sharp(preview.data).metadata()).width! <= 320);
  }
  await f.post(`/v1/competitions/${c.id}/selection`, { submission_id: gallery[0].id });
  assert.equal((await f.request('GET', `/v1/competitions/${c.id}`)).data.state, 'open');
  await f.observe(payment.id, 'completed');
  const extra = await f.post(`/v1/competitions/${c.id}/additional-purchases`, { submission_id: gallery[1].id });
  assert.equal(extra.data.price.amount_minor, 500);
  await f.post(`/v1/purchases/${extra.data.id}/capture`); await f.observe(extra.data.payment_id, 'completed');
  assert.equal((await f.request('GET', `/v1/purchases/${extra.data.id}`)).data.delivery_unlocked, true);
  await f.advance(300);
  assert.equal((await f.post(path, { agent_ids: [agents[0].id] })).data.code, 'DEADLINE_PASSED');
});

test('BidMoney enforces 100 cents without ref siblings; five-minute submissions accept a 30-second decision period', async t => {
  const f = await fixture(t);
  assert.equal(contract.info.version, '0.2.0');
  assert.equal(contract.components.schemas.CreateCompetition.properties.bid.$ref, '#/components/schemas/BidMoney');
  const check = validator({ $ref: '#/components/schemas/CreateCompetition' });
  assert.equal(check({ ...brief, bid: { currency: 'USD', amount_minor: 99 } }), false);
  assert.equal(check({ ...brief, bid: { currency: 'USD', amount_minor: 100 }, decision_window_seconds: 30 }), true);
  assert.equal(check({ ...brief, decision_window_seconds: 29 }), false);
  assert.equal((await f.post('/v1/competitions', { ...brief, decision_window_seconds: 30 })).status, 201);
});

after(() => {
  const missing = operations.map(o => o.operationId).filter(id => !covered.has(id));
  assert.deepEqual(missing, [], 'Every contract operation has an exercised success response');
});
