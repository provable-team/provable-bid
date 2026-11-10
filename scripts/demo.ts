/** Seeds a running loopback mock with three creative agents and two paid purchases.
 * No AI calls, PayPal calls, or real payouts. Start `npm run mock` first.
 */
import assert from 'node:assert/strict';
import { assertPaidOriginals } from './assert-demo.js';
import { driveMockCompetition, requireMockOrigin } from './mock-driver.js';
import { randomUUID } from 'node:crypto';
import { createApiClient } from '../packages/api-client/src/index.js';
const baseUrl = process.env.MOCK_API_URL ?? 'http://127.0.0.1:4010';
requireMockOrigin(baseUrl);
const buyer = createApiClient({ baseUrl, token: 'buyer-demo' });
const admin = createApiClient({ baseUrl, token: 'admin-demo' });
const header = () => ({ 'Idempotency-Key': randomUUID() });
function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (!result.response.ok || result.data === undefined) throw new Error(JSON.stringify(result.error ?? { status: result.response.status }));
  return result.data;
}
const config = unwrap(await buyer.GET('/v1/config'));
assert.equal(config.mode, 'mock', 'Demo refuses a non-mock API.');
const competition = unwrap(await buyer.POST('/v1/competitions', {
  params: { header: header() }, body: {
    title: 'Five Minute Scenes', brief: 'Create cinematic key art and a short scene about two astronauts discovering a garden on Mars.',
    bid: { currency: 'USD', amount_minor: 500 }, submission_window_seconds: 300, decision_window_seconds: 60,
    requirements: [{ id: 'req_mars', description: 'Two astronauts and a garden on Mars are depicted in the work.' }],
    accepted_terms_version: config.terms_version,
  },
}));
const competitionPath = { competition_id: competition.id };
const checkout = unwrap(await buyer.POST('/v1/competitions/{competition_id}/checkout', { params: { path: competitionPath, header: header() } }));
unwrap(await buyer.POST('/v1/competitions/{competition_id}/authorize', { params: { path: competitionPath, header: header() } }));
const agents = unwrap(await buyer.GET('/v1/agents'));
const started = unwrap(await buyer.POST('/v1/competitions/{competition_id}/agent-runs', {
  params: { path: competitionPath, header: header() }, body: { agent_ids: agents.items.map(a => a.id) },
}));
assert.equal(started.items.length, 3);
assert.ok(started.items.every(run => run.status === 'submitted'));
await driveMockCompetition({ baseUrl, competitionId: competition.id, qualify: true });
const gallery = unwrap(await buyer.GET('/v1/competitions/{competition_id}/submissions', { params: { path: competitionPath } }));
const first = unwrap(await buyer.POST('/v1/competitions/{competition_id}/selection', {
  params: { path: competitionPath, header: header() }, body: { submission_id: gallery.items[0].id },
}));
unwrap(await admin.POST('/__mock/payments/{payment_id}/observation', {
  params: { path: { payment_id: checkout.payment_id }, header: header() }, body: { observation: 'completed' },
}));
const extra = unwrap(await buyer.POST('/v1/competitions/{competition_id}/additional-purchases', {
  params: { path: competitionPath, header: header() }, body: { submission_id: gallery.items[1].id },
}));
unwrap(await buyer.POST('/v1/purchases/{purchase_id}/capture', { params: { path: { purchase_id: extra.id }, header: header() } }));
unwrap(await admin.POST('/__mock/payments/{payment_id}/observation', {
  params: { path: { payment_id: extra.payment_id }, header: header() }, body: { observation: 'completed' },
}));
const firstVerified = await assertPaidOriginals(baseUrl, first.id);
const additionalVerified = await assertPaidOriginals(baseUrl, extra.id);
assert.notEqual(firstVerified.payment.id, additionalVerified.payment.id);
assert.notEqual(firstVerified.payment.provider_order_id, additionalVerified.payment.provider_order_id);
assert.notEqual(firstVerified.payment.provider_capture_id, additionalVerified.payment.provider_capture_id);
const delivery = firstVerified.access;
const current = unwrap(await buyer.GET('/v1/competitions/{competition_id}', { params: { path: competitionPath } }));
console.log(JSON.stringify({
  mode: 'mock — no real generation, payments, or payouts', competition_id: competition.id,
  state: current.state, outcome: current.outcome, submission_deadline: current.submission_deadline,
  agents: agents.items.map(a => ({ id: a.id, name: a.name, style: a.style })),
  gallery: gallery.items.map(s => ({ id: s.id, agent_id: s.agent_id, artifacts: s.artifacts })),
  first_purchase_id: first.id, additional_purchase_id: extra.id,
  assertions: { first: firstVerified.assertions, additional: additionalVerified.assertions, separate_orders_and_payments: true },
  first_purchase_originals: delivery.artifacts, delivery_expires_at: delivery.expires_at,
  message: 'First winner selected. Submissions stay open to the fixed deadline; qualified extra work costs $5 each.',
}, null, 2));
