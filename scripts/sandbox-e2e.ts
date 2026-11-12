// Real PayPal sandbox run of the whole money flow, in-process, without a browser (test-card checkout).
//   PAYPAL_CLIENT_ID=… PAYPAL_CLIENT_SECRET=… HOUSE_OPERATOR_PAYER_ID=… npx tsx scripts/sandbox-e2e.ts
// 1. winner: authorize → two agents enter → select → capture → payout to the operator's sandbox account → delivery
// 2. extra entry: separate CAPTURE checkout → second payout
// 3. reject all: authorization voided, nothing captured
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createApi } from '../apps/api/src/app.js';
import { heuristicEvaluator } from '../apps/api/src/claude.js';
import { paypalProvider } from '../apps/api/src/provider/paypal.js';
import { Store } from '../apps/api/src/store.js';

const env = process.env;
const clientId = env.PAYPAL_CLIENT_ID ?? env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
const payerId = env.HOUSE_OPERATOR_PAYER_ID ?? env.DEMO_OPERATOR_PAYER_ID;
if (!clientId || !env.PAYPAL_CLIENT_SECRET || !payerId) throw new Error('Set PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET and HOUSE_OPERATOR_PAYER_ID (sandbox).');

const provider = paypalProvider({ clientId, clientSecret: env.PAYPAL_CLIENT_SECRET, webhookId: null, testCardCheckout: true });
const api = await createApi({ store: new Store(':memory:'), provider, evaluator: heuristicEvaluator(), webOrigin: 'http://web.local', apiOrigin: 'http://api.local',
  houseOperatorPayerId: payerId, strictResponses: true, log: (m, x) => console.log(`   [api] ${m}`, x ?? '') });
let n = 0;
async function call(method: 'GET' | 'POST', url: string, token: string | null, payload?: unknown) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (method === 'POST') headers['idempotency-key'] = `e2e_${Date.now()}_${++n}`;
  const r = await api.app.inject({ method, url, headers, ...(payload !== undefined ? { payload: payload as any } : {}) });
  const data = String(r.headers['content-type']).startsWith('text/html') ? r.body : r.json();
  if (r.statusCode >= 400) throw new Error(`${method} ${url} → ${r.statusCode} ${JSON.stringify(data)}`);
  return data;
}
async function until<T>(what: string, fn: () => Promise<T | undefined | false>, seconds = 90): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < seconds * 1000) {
    await api.work(); await api.idle();
    const v = await fn(); if (v) { console.log(`✓ ${what} (${Math.round((Date.now() - start) / 1000)}s)`); return v; }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`timed out: ${what}`);
}
const page = (who: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Crumb &amp; Co. by ${who}</title><style>body{font-family:system-ui;margin:0;padding:24px}.cta{background:#b5522b;color:#fff;padding:12px 20px;border-radius:8px}</style></head>
<body><h1>Crumb &amp; Co. bakery (${who})</h1><p>Sourdough, cardamom buns and croissants baked every morning since 1987.</p><h2>Opening hours</h2><p>Tuesday to Sunday, 7am to 3pm.</p><a class="cta" href="#">Pre-order now</a></body></html>`;
const brief = { title: 'Landing page for a neighborhood bakery', brief: 'One page for Crumb & Co.: hero, opening hours, pre-order button, mobile first.',
  bid: { currency: 'USD', amount_minor: 1000 }, submission_window_seconds: 300, decision_window_seconds: 3600, accepted_terms_version: 'race-v1',
  requirements: [{ id: 'req_hours', description: 'Shows opening hours.' }, { id: 'req_preorder', description: 'Has a pre-order button.' }, { id: 'req_mobile', description: 'Works on a phone.' }] };

const atelier = api.houseTokens.get('agent_house_atelier')!;
const voltage = api.houseTokens.get('agent_house_voltage')!;
const buyer = (await call('POST', '/v1/buyer-sessions', null)).token;

async function openCompetition() {
  const c = await call('POST', '/v1/competitions', buyer, brief);
  const checkout = await call('POST', `/v1/competitions/${c.id}/checkout`, buyer);
  const pay = await call('POST', `/v1/competitions/${c.id}/authorize`, buyer);
  assert.equal(pay.authorization_state, 'authorized');
  console.log(`✓ ${c.id}: PayPal order ${checkout.provider_order_id} authorized ${pay.provider_authorization_id} for $${(pay.amount.amount_minor / 100).toFixed(2)} (price $10.00 + processing $${(c.processing_fee.amount_minor / 100).toFixed(2)})`);
  return { c, pay };
}
async function enter(token: string, competitionId: string, who: string) {
  const asset = await call('POST', '/v1/assets', token, { competition_id: competitionId, type: 'html', mime_type: 'text/html', content_base64: Buffer.from(page(who)).toString('base64') });
  return call('POST', `/v1/competitions/${competitionId}/submissions`, token, { title: `Crumb & Co. — ${who}`, artifacts: [{ asset_id: asset.id }] });
}

// 1. Winner → capture → payout → delivery
const one = await openCompetition();
const a = await enter(atelier, one.c.id, 'Atelier');
const b = await enter(voltage, one.c.id, 'Voltage');
await until('both entries qualified', async () => (await call('GET', `/v1/competitions/${one.c.id}/submissions`, buyer)).items.length === 2);
const pick = await call('POST', `/v1/competitions/${one.c.id}/selection`, buyer, { submission_id: a.id });
const captured = await until('authorization captured in full', async () => { const p = await call('GET', `/v1/payments/${one.pay.id}`, buyer); return p.capture_state === 'completed' && p; });
console.log(`   capture ${captured.provider_capture_id}: $${(captured.captured_minor / 100).toFixed(2)}, PayPal fee $${(captured.provider_expense_minor / 100).toFixed(2)}`);
const paid = await until('payout to the operator reached SUCCESS', async () => { const s = await call('GET', `/v1/competitions/${one.c.id}/settlement`, buyer); return s.allocations[0]?.payout_state === 'paid' && s; }, 120);
console.log(`   payout batch ${paid.allocations[0].provider_payout_id}: $${(paid.allocations[0].amount.amount_minor / 100).toFixed(2)} to the operator`);
const access = await call('POST', `/v1/purchases/${pick.id}/delivery-access`, buyer);
const original = await call('GET', new URL(access.artifacts[0].url).pathname, buyer);
assert.equal(createHash('sha256').update(original).digest('hex'), a.artifacts[0].sha256);
console.log('✓ delivered original matches the submitted fingerprint');

// 2. Extra entry → separate CAPTURE checkout → second payout
const extra = await call('POST', `/v1/competitions/${one.c.id}/additional-purchases`, buyer, { submission_id: b.id });
assert.equal(extra.checkout.intent, 'CAPTURE');
await call('POST', `/v1/purchases/${extra.id}/capture`, buyer);
await until('extra entry captured and unlocked', async () => (await call('GET', `/v1/purchases/${extra.id}`, buyer)).delivery_unlocked);
await until('second payout reached SUCCESS', async () => (await call('GET', `/v1/competitions/${one.c.id}/settlement`, buyer)).allocations.filter((x: any) => x.payout_state === 'paid').length === 2, 120);

// 3. Reject all → void
const three = await openCompetition();
await enter(atelier, three.c.id, 'Atelier');
await until('entry qualified', async () => (await call('GET', `/v1/competitions/${three.c.id}/submissions`, buyer)).items.length === 1);
await call('POST', `/v1/competitions/${three.c.id}/rejection`, buyer);
await until('authorization voided; buyer pays nothing', async () => (await call('GET', `/v1/payments/${three.pay.id}`, buyer)).authorization_state === 'voided');
const voided = await provider.getAuthorization((await call('GET', `/v1/payments/${three.pay.id}`, buyer)).provider_authorization_id);
assert.equal(voided.status, 'VOIDED');
console.log(`✓ PayPal confirms authorization ${voided.status}`);
await api.app.close();
console.log('\nAll sandbox flows passed.');
