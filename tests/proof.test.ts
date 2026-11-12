import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from '../apps/api/src/app.js';
import { heuristicEvaluator } from '../apps/api/src/claude.js';
import { fakeProvider } from '../apps/api/src/provider/fake.js';
import { canonicalJson, loadReceiptKey, receiptKeyFromSeed, verifyReceipt } from '../apps/api/src/receipts.js';
import { Store } from '../apps/api/src/store.js';

const WEB = 'http://web.test';
const T0 = Date.parse('2026-11-12T10:00:00.000Z');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Crumb &amp; Co.</title></head><body>
<h1>Crumb &amp; Co. — a family bakery</h1><section><h2>Opening hours</h2><p>Tuesday to Sunday, 7am to 3pm.</p></section>
<a class="cta" href="#preorder">Pre-order now</a><p id="preorder">Choose your collection time.</p></body></html>`;
const noHours = html.replace('Opening hours', 'Our story').replace('Tuesday to Sunday, 7am to 3pm.', 'Three generations of bakers.');
const brief = {
  title: 'Landing page for a neighborhood bakery', brief: 'One page for Crumb & Co. Hero, opening hours, pre-order button. Mobile first.',
  bid: { currency: 'USD', amount_minor: 2000 }, submission_window_seconds: 300, decision_window_seconds: 3600,
  requirements: [{ id: 'req_hours', description: 'Shows opening hours.' }, { id: 'req_preorder', description: 'Has a clearly visible pre-order button.' }],
  accepted_terms_version: 'race-v1',
};

async function fixture(t: any) {
  let now = T0;
  const fake = fakeProvider({ webOrigin: WEB, now: () => now });
  const receiptKey = receiptKeyFromSeed(Buffer.alloc(32, 7), 'test');
  const api = await createApi({
    store: new Store(':memory:'), provider: fake.provider, evaluator: heuristicEvaluator(), webOrigin: WEB, apiOrigin: 'http://api.test',
    adminToken: 'admin_token_for_tests_0001', houseOperatorPayerId: 'HOUSEPAYER0001', houseAgents: null, now: () => now,
    strictResponses: true, simulatePayouts: false, log: () => {}, notify: async () => {}, receiptKey,
  });
  t.after(async () => { await api.idle(); await api.app.close(); });
  let n = 0;
  async function call(method: 'GET' | 'POST', url: string, token: string | null = null, payload?: unknown) {
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (method === 'POST') headers['idempotency-key'] = `proof_${++n}_key`;
    const r = await api.app.inject({ method, url, headers, ...(payload !== undefined ? { payload: payload as any } : {}) });
    const type = String(r.headers['content-type'] ?? '');
    return { status: r.statusCode, headers: r.headers, data: type.startsWith('application/json') || type.startsWith('application/problem+json') ? r.json() : r.statusCode === 302 ? null : r.body };
  }
  async function settle() { for (let i = 0; i < 4; i++) { await api.work(); await api.idle(); } }
  async function advance(seconds: number) { now += seconds * 1000; await settle(); }
  const buyer = async () => (await call('POST', '/v1/buyer-sessions')).data.token as string;
  async function agent(payerId: string, name: string) {
    const start = await call('GET', '/v1/operators/connect');
    const state = new URL(String(start.headers.location)).searchParams.get('state')!;
    const back = await call('GET', `/v1/operators/connect/callback?code=${encodeURIComponent(`fake:${payerId}:${name}`)}&state=${state}`);
    const op = new URLSearchParams(String(back.headers.location).split('#')[1]).get('operator_token')!;
    const r = await call('POST', '/v1/operators/me/agents', op, { name, description: `${name} builds pages.`, style: 'Clean.', webhook_url: null });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    return r.data as { token: string; agent: { id: string } };
  }
  async function open(b: string) {
    const c = (await call('POST', '/v1/competitions', b, brief)).data;
    const checkout = (await call('POST', `/v1/competitions/${c.id}/checkout`, b)).data;
    fake.controls.approve(checkout.provider_order_id);
    assert.equal((await call('POST', `/v1/competitions/${c.id}/authorize`, b)).status, 202);
    return (await call('GET', `/v1/competitions/${c.id}`, b)).data;
  }
  async function enter(token: string, competitionId: string, page = html) {
    const asset = await call('POST', '/v1/assets', token, { competition_id: competitionId, type: 'html', mime_type: 'text/html', content_base64: Buffer.from(page).toString('base64') });
    assert.equal(asset.status, 201, JSON.stringify(asset.data));
    const s = await call('POST', `/v1/competitions/${competitionId}/submissions`, token, { title: 'Crumb & Co.', artifacts: [{ asset_id: asset.data.id }] });
    assert.equal(s.status, 201, JSON.stringify(s.data));
    return s.data;
  }
  return { api, fake, call, settle, advance, buyer, agent, open, enter, receiptKey };
}

test('signed delivery receipt: buyer only, after capture; verifies with the published key; tampering fails; fingerprint matches the delivered bytes', async t => {
  const f = await fixture(t);
  const b = await f.buyer(); const stranger = await f.buyer();
  const ann = await f.agent('PAYERANN0001', 'Pixel Forge');
  const c = await f.open(b);
  const s = await f.enter(ann.token, c.id); await f.settle();

  f.fake.controls.captureStatus = 'PENDING';
  const pick = await f.call('POST', `/v1/competitions/${c.id}/selection`, b, { submission_id: s.id });
  assert.equal(pick.status, 202); await f.settle();
  const url = `/v1/purchases/${pick.data.id}/receipt`;
  const locked = await f.call('GET', url, b);
  assert.equal(locked.status, 409); assert.equal(locked.data.code, 'DELIVERY_LOCKED', 'no receipt before the capture completes');

  f.fake.controls.settleCapture([...f.fake.captures.keys()][0]);
  await f.advance(15); await f.advance(10);

  assert.equal((await f.call('GET', url)).status, 401);
  assert.equal((await f.call('GET', url, stranger)).status, 404, 'another buyer');
  assert.equal((await f.call('GET', url, ann.token)).status, 404, 'the winning agent');
  assert.equal((await f.call('GET', '/v1/purchases/pur_missing/receipt', b)).status, 404);

  const r = await f.call('GET', url, b);
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.headers['cache-control'], 'no-store');
  const receipt = r.data;
  const key = (await f.call('GET', '/.well-known/provable-receipts.json')).data;
  assert.deepEqual([key.alg, key.format, key.key_id, key.public_key], ['Ed25519', 'provable-receipt-v1', f.receiptKey.keyId, f.receiptKey.publicKey]);
  assert.equal(Buffer.from(key.public_key, 'base64url').length, 32);
  assert.equal(receipt.key_id, key.key_id);
  assert.ok(verifyReceipt(receipt, key.public_key));

  assert.equal(receipt.format, 'provable-receipt-v1'); assert.equal(receipt.purchase_id, pick.data.id); assert.equal(receipt.competition_id, c.id);
  assert.equal(receipt.brief.requirements_sha256, createHash('sha256').update(canonicalJson(brief.requirements)).digest('hex'));
  assert.deepEqual(receipt.entry, { submission_id: s.id, agent_id: ann.agent.id, agent_name: 'Pixel Forge', internal: false });
  assert.deepEqual(receipt.evaluation.checks, [{ requirement_id: 'req_hours', passed: true }, { requirement_id: 'req_preorder', passed: true }]);
  assert.equal(receipt.evaluation.status, 'qualified');
  assert.equal(receipt.payment.captured, true); assert.equal(receipt.payment.amount.amount_minor, 2123); assert.ok(receipt.payment.provider_capture_id);
  assert.equal(receipt.payout, undefined, 'payout state can change after issue: not in the receipt');
  assert.deepEqual(Object.keys(receipt).sort(), ['artifacts', 'brief', 'competition_id', 'entry', 'evaluation', 'format', 'issued_at', 'issuer', 'key_id', 'payment', 'purchase_id', 'signature']);
  const text = JSON.stringify(receipt);
  assert.ok(!text.includes(b) && !text.includes(c.buyer_id) && !/PAYERANN|@/.test(text), 'no buyer identity, tokens or payer IDs');

  // The receipt's fingerprint is the fingerprint of the bytes actually delivered.
  const access = await f.call('POST', `/v1/purchases/${pick.data.id}/delivery-access`, b);
  const original = await f.call('GET', new URL(access.data.artifacts[0].url).pathname, b);
  assert.equal(createHash('sha256').update(original.data).digest('hex'), receipt.artifacts[0].sha256);
  assert.equal(Buffer.byteLength(original.data), receipt.artifacts[0].size_bytes);

  for (const tamper of [
    (x: any) => { x.payment.amount.amount_minor = 1; },
    (x: any) => { x.artifacts[0].sha256 = '0'.repeat(64); },
    (x: any) => { x.evaluation.checks[0].passed = false; },
    (x: any) => { x.signature = x.signature.slice(0, -2) + (x.signature.endsWith('AA') ? 'BA' : 'AA'); },
  ]) { const copy = structuredClone(receipt); tamper(copy); assert.equal(verifyReceipt(copy, key.public_key), false); }
  assert.equal(verifyReceipt(receipt, receiptKeyFromSeed(Buffer.alloc(32, 8)).publicKey), false, 'another key');

  // The dependency-free verifier agrees, with the key from a file and the original file.
  const dir = mkdtempSync(join(tmpdir(), 'receipt-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const files = { receipt: join(dir, 'receipt.json'), original: join(dir, 'original.html'), key: join(dir, 'key.json'), bad: join(dir, 'bad.json'), other: join(dir, 'other.html') };
  writeFileSync(files.receipt, JSON.stringify(receipt, null, 2)); writeFileSync(files.original, original.data);
  writeFileSync(files.key, JSON.stringify(key)); writeFileSync(files.other, `${original.data} `);
  const bad = structuredClone(receipt); bad.entry.agent_name = 'Someone Else'; writeFileSync(files.bad, JSON.stringify(bad));
  const run = (...args: string[]) => { try { return { code: 0, out: execFileSync(process.execPath, ['scripts/verify-receipt.mjs', ...args], { encoding: 'utf8', stdio: 'pipe' }) }; }
    catch (e: any) { return { code: e.status as number, out: `${e.stdout}${e.stderr}` }; } };
  const good = run(files.receipt, files.original, '--key', files.key);
  assert.equal(good.code, 0, good.out); assert.match(good.out, /signature valid/); assert.match(good.out, /matches artifact/);
  assert.equal(run(files.receipt, '--key', key.public_key).code, 0, 'raw base64url key');
  assert.equal(run(files.bad, '--key', files.key).code, 1, 'tampered receipt');
  assert.equal(run(files.receipt, files.other, '--key', files.key).code, 1, 'a different file');
  assert.equal(run(files.receipt, '--key', receiptKeyFromSeed(Buffer.alloc(32, 9)).publicKey).code, 1, 'wrong key');

  // The verifier itself is served next to the key.
  const script = await f.call('GET', '/verify-receipt.mjs');
  assert.equal(script.status, 200); assert.match(String(script.data), /provable-receipt-v1/);
});

test('receipt key: env PEM or seed, else derived from a stable server secret, else ephemeral; key material never in the key ID', () => {
  const a = loadReceiptKey({ ADMIN_TOKEN: 'secret-one' });
  assert.equal(a.source, 'derived:ADMIN_TOKEN');
  assert.equal(loadReceiptKey({ ADMIN_TOKEN: 'secret-one' }).publicKey, a.publicKey, 'stable across restarts');
  assert.notEqual(loadReceiptKey({ ADMIN_TOKEN: 'secret-two' }).publicKey, a.publicKey);
  assert.equal(loadReceiptKey({ WORKFLOWS_SECRET: 'w' }).source, 'derived:WORKFLOWS_SECRET');
  const seed = Buffer.alloc(32, 3);
  assert.equal(loadReceiptKey({ RECEIPT_SIGNING_KEY: seed.toString('base64'), ADMIN_TOKEN: 'x' }).publicKey, receiptKeyFromSeed(seed).publicKey);
  const pem = generateKeyPairSync('ed25519').privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  assert.equal(loadReceiptKey({ RECEIPT_SIGNING_KEY: pem }).source, 'env');
  assert.equal(loadReceiptKey({}).source, 'ephemeral');
  assert.match(a.keyId, /^rk_[0-9a-f]{16}$/);
});

test('public stats: aggregate counts for a captured, a voided and a failed outside entry; no IDs; cached', async t => {
  const f = await fixture(t);
  const b = await f.buyer();
  const ann = await f.agent('PAYERANN0001', 'Pixel Forge');
  const empty = (await f.call('GET', '/stats.json')).data;
  assert.equal(empty.briefs_opened, 0); assert.equal(empty.qualified_rate, null); assert.equal(empty.outside_agents_registered, 1);

  const won = await f.open(b);
  const s = await f.enter(ann.token, won.id); await f.settle();
  await f.call('POST', `/v1/competitions/${won.id}/selection`, b, { submission_id: s.id }); await f.settle(); await f.advance(10);

  const rejected = await f.open(b);
  const failed = await f.enter(ann.token, rejected.id, noHours); await f.settle();
  assert.equal((await f.call('POST', `/v1/competitions/${rejected.id}/rejection`, b)).status, 202); await f.settle();
  await f.call('POST', '/v1/competitions', b, brief); // a draft never authorized: not counted

  await f.advance(31); // past the 30 s cache
  const r = await f.call('GET', '/stats.json');
  assert.equal(r.status, 200); assert.match(String(r.headers['cache-control']), /max-age=30/);
  const st = r.data;
  assert.deepEqual(Object.keys(st.definitions).sort(), Object.keys(st).filter(k => k !== 'definitions').sort(), 'every field is defined in one line');
  assert.deepEqual({ ...st, generated_at: undefined, definitions: undefined }, {
    mode: 'mock', generated_at: undefined, definitions: undefined,
    briefs_opened: 2, entries_submitted: 2, entries_checked: 2, entries_qualified: 1, qualified_rate: 0.5,
    competitions_captured: 1, competitions_voided: 1, voided_by_outcome: { rejected: 1, no_decision: 0, no_qualifiers: 0 },
    purchases_completed: 1, paid_to_operators_usd: 19, payouts_paid_count: 1,
    outside_agents_registered: 1, outside_entries: 2, house_entries: 0,
  });
  const text = JSON.stringify(st);
  for (const secret of [won.id, rejected.id, s.id, failed.id, ann.agent.id, won.buyer_id, 'Pixel Forge', 'PAYERANN0001']) assert.ok(!text.includes(secret), `stats leak ${secret}`);
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-/.test(text), 'no UUIDs');

  await f.enter(ann.token, (await f.open(b)).id); await f.settle();
  assert.equal((await f.call('GET', '/stats.json')).data.generated_at, st.generated_at, 'served from the 30 s cache');
});
