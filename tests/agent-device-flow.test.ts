import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { createApi } from '../apps/api/src/app.js';
import { Store } from '../apps/api/src/store.js';
import { fakeProvider } from '../apps/api/src/provider/fake.js';
import { heuristicEvaluator } from '../apps/api/src/claude.js';
import { hashToken } from '../apps/api/src/identity.js';
import { DEVICE_LIMITS } from '../apps/api/src/device-flow.js';
import { operations, validateResponse } from '../scripts/contract.js';

const { connectWithCode, agentClient } = await import(new URL('../examples/agent.mjs', import.meta.url).href);
const WEB = 'http://buyer.test';

async function fixture(t: any, opts: { dbPath?: string; now?: { value: number } } = {}) {
  const clock = opts.now ?? { value: Date.parse('2026-11-12T15:00:00Z') };
  const store = new Store(opts.dbPath ?? ':memory:');
  const fake = fakeProvider({ webOrigin: WEB, now: () => clock.value });
  const api = await createApi({ store, provider: fake.provider, evaluator: heuristicEvaluator(), webOrigin: WEB, apiOrigin: 'http://api.test',
    now: () => clock.value, strictResponses: true, log: () => {} });
  let closed = false;
  const close = async () => { if (closed) return; closed = true; await api.idle(); await api.app.close(); store.close(); };
  t.after(close);
  let sequence = 0;
  async function call(method: 'GET' | 'POST', path: string, body?: any, token: string | null = null, extra: Record<string, string> = {}) {
    const headers: Record<string, string> = { ...extra };
    if (token) headers.authorization = `Bearer ${token}`;
    if (method === 'POST' && !headers['idempotency-key']) headers['idempotency-key'] = `device_test_${++sequence}`;
    const r = await api.app.inject({ method, url: path, headers, ...(body !== undefined ? { payload: body } : {}) });
    const type = String(r.headers['content-type'] ?? '');
    const data = r.statusCode === 302 ? null : r.json();
    const op = operations.find(o => o.method === method.toLowerCase() && new RegExp(`^${o.path.replace(/\{[^}]+\}/g, '[^/]+')}$`).test(path.split('?')[0]));
    assert.ok(op, `contract operation for ${method} ${path}`);
    if (r.statusCode !== 302) validateResponse(op, r.statusCode, type, data);
    return { status: r.statusCode, data, headers: r.headers };
  }
  async function operator(payerId: string, name: string) {
    const start = await call('GET', '/v1/operators/connect');
    const state = new URL(String(start.headers.location)).searchParams.get('state')!;
    const back = await call('GET', `/v1/operators/connect/callback?code=${encodeURIComponent(`fake:${payerId}:${name}`)}&state=${state}`);
    return new URLSearchParams(String(back.headers.location).split('#')[1]).get('operator_token')!;
  }
  const newCode = (body: any = { client_name: 'Crumb Studio', description: 'Warm editorial pages.' }, ip = '203.0.113.7') =>
    call('POST', '/v1/agent-device-codes', body, null, { 'x-forwarded-for': ip });
  const poll = (deviceCode: string) => call('POST', '/v1/agent-device-tokens', { device_code: deviceCode });
  const advance = (seconds: number) => { clock.value += seconds * 1000; };
  return { api, call, operator, newCode, poll, advance, close, clock };
}

test('device flow: code, pending, slow_down, operator reviews and approves, credential issued once, then consumed', async t => {
  const f = await fixture(t);
  const op = await f.operator('PAYERDEV0001', 'Dev Operator');
  const start = await f.newCode();
  assert.equal(start.status, 200);
  assert.equal(start.headers['cache-control'], 'no-store');
  const code = start.data;
  assert.match(code.user_code, /^[BCDFGHJKLMNPQRSTVWXZ]{4}-[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
  assert.ok(Buffer.from(code.device_code.replace(/^pbd_/, ''), 'base64url').length >= 32, 'device code has at least 32 random bytes');
  assert.equal(code.verification_uri, `${WEB}/operators/activate`);
  assert.equal(code.verification_uri_complete, `${WEB}/operators/activate?code=${code.user_code}`);
  assert.equal(code.expires_in, 600);
  assert.equal(code.interval, 5);

  const pending = await f.poll(code.device_code);
  assert.equal(pending.status, 400);
  assert.equal(pending.data.code, 'AUTHORIZATION_PENDING');
  assert.equal(pending.data.type, 'urn:provable:problem:authorization_pending', 'the problem type carries the RFC 8628 error name');
  assert.equal(pending.data.retryable, true);
  const tooFast = await f.poll(code.device_code);
  assert.equal(tooFast.data.code, 'SLOW_DOWN');
  f.advance(5);
  assert.equal((await f.poll(code.device_code)).data.code, 'AUTHORIZATION_PENDING');

  // Case-insensitive, hyphen optional.
  const loose = code.user_code.replace('-', '').toLowerCase();
  const seen = await f.call('GET', `/v1/operators/me/device-approvals/${loose}`, undefined, op);
  assert.equal(seen.status, 200);
  assert.deepEqual({ name: seen.data.client_name, description: seen.data.description, code: seen.data.user_code, webhook: seen.data.webhook_url },
    { name: 'Crumb Studio', description: 'Warm editorial pages.', code: code.user_code, webhook: null });
  assert.equal(Date.parse(seen.data.expires_at) - Date.parse(seen.data.created_at), 600_000);

  const approved = await f.call('POST', `/v1/operators/me/device-approvals/${code.user_code}`, { decision: 'approve', name: 'Crumb Studio Prime', style: 'Serif, warm' }, op);
  assert.equal(approved.status, 200);
  assert.equal(approved.data.decision, 'approve');
  assert.equal(approved.data.agent.name, 'Crumb Studio Prime');
  assert.equal(approved.data.agent.operator_name, 'Dev Operator');
  assert.equal(approved.data.agent.internal, false);
  assert.doesNotMatch(JSON.stringify(approved.data), /pba_/, 'the operator never sees the agent token');

  f.advance(5);
  const issued = await f.poll(code.device_code);
  assert.equal(issued.status, 200);
  assert.equal(issued.headers['cache-control'], 'no-store');
  assert.match(issued.data.token, /^pba_/);
  assert.equal(issued.data.agent.id, approved.data.agent.id);
  assert.equal(issued.data.webhook_secret, null);
  // Same scope as a manually registered agent: it is this agent, under this operator, and nothing more.
  const me = await f.call('GET', '/v1/agents/me', undefined, issued.data.token);
  assert.equal(me.data.id, approved.data.agent.id);
  assert.equal((await f.call('GET', '/v1/operators/me', undefined, issued.data.token)).data.code, 'OPERATOR_REQUIRED');
  const account = await f.call('GET', '/v1/operators/me', undefined, op);
  assert.deepEqual(account.data.agents.map((a: any) => a.agent.name), ['Crumb Studio Prime']);

  f.advance(5);
  const again = await f.poll(code.device_code);
  assert.equal(again.status, 400);
  assert.equal(again.data.code, 'EXPIRED_TOKEN', 'the credential is handed out exactly once');
  assert.equal((await f.call('GET', `/v1/operators/me/device-approvals/${code.user_code}`, undefined, op)).status, 404);
  const twice = await f.call('POST', `/v1/operators/me/device-approvals/${code.user_code}`, { decision: 'approve' }, op);
  assert.equal(twice.status, 409);
  // Rotation from the operator page still works for device-flow agents and revokes the issued token.
  await f.call('POST', `/v1/operators/me/agents/${approved.data.agent.id}/credential`, undefined, op);
  assert.equal((await f.call('GET', '/v1/agents/me', undefined, issued.data.token)).status, 401);
});

test('device flow: deny, expiry, unknown codes and webhook validation', async t => {
  const f = await fixture(t);
  const op = await f.operator('PAYERDEV0002', 'Deny Operator');
  const denied = (await f.newCode()).data;
  const decision = await f.call('POST', `/v1/operators/me/device-approvals/${denied.user_code}`, { decision: 'deny' }, op);
  assert.equal(decision.status, 200);
  assert.equal(decision.data.agent, null);
  assert.equal((await f.poll(denied.device_code)).data.code, 'ACCESS_DENIED');
  assert.equal((await f.call('GET', '/v1/operators/me', undefined, op)).data.agents.length, 0, 'deny registers nothing');

  const late = (await f.newCode()).data;
  f.advance(601);
  assert.equal((await f.poll(late.device_code)).data.code, 'EXPIRED_TOKEN');
  assert.equal((await f.call('GET', `/v1/operators/me/device-approvals/${late.user_code}`, undefined, op)).status, 404);
  assert.equal((await f.call('POST', `/v1/operators/me/device-approvals/${late.user_code}`, { decision: 'approve' }, op)).status, 404);

  assert.equal((await f.poll('pbd_unknown_device_code_that_was_never_issued')).data.code, 'EXPIRED_TOKEN');
  const unknown = await f.call('GET', '/v1/operators/me/device-approvals/BCDF-GHJK', undefined, op);
  assert.equal(unknown.status, 404);
  assert.equal((await f.call('GET', '/v1/operators/me/device-approvals/not-a-code', undefined, op)).status, 400);

  const badHook = await f.newCode({ client_name: 'Hooked', webhook_url: 'http://example.com/hook' });
  assert.equal(badHook.status, 400);
  assert.equal(badHook.data.code, 'VALIDATION_ERROR');
  assert.equal((await f.newCode({ client_name: '   ' })).status, 400);
  assert.equal((await f.newCode({ client_name: 'x'.repeat(81) })).status, 400);

  // A webhook URL travels to the registered agent, and its signing secret only to the agent.
  const hooked = (await f.newCode({ client_name: 'Hooked', webhook_url: 'https://agents.example/hook' })).data;
  const ok = await f.call('POST', `/v1/operators/me/device-approvals/${hooked.user_code}`, { decision: 'approve' }, op);
  assert.equal(ok.data.agent.name, 'Hooked');
  f.advance(5);
  const cred = (await f.poll(hooked.device_code)).data;
  assert.match(cred.webhook_secret, /^[a-f0-9]{64}$/);
  assert.equal((await f.call('GET', '/v1/operators/me', undefined, op)).data.agents[0].webhook_url, 'https://agents.example/hook');
});

test('device approvals are operator-only and follow manual registration rules', async t => {
  const f = await fixture(t);
  const code = (await f.newCode()).data;
  const path = `/v1/operators/me/device-approvals/${code.user_code}`;
  assert.equal((await f.call('GET', path)).status, 401);
  assert.equal((await f.call('POST', path, { decision: 'approve' })).status, 401);
  const buyer = (await f.call('POST', '/v1/buyer-sessions')).data.token;
  // Without a PayPal-connected operator account: the same refusal as manual registration.
  const manual = await f.call('POST', '/v1/operators/me/agents', { name: 'Nope', description: '', style: '' }, buyer);
  const viaCode = await f.call('POST', path, { decision: 'approve' }, buyer);
  assert.equal(manual.status, 403);
  assert.deepEqual([viaCode.status, viaCode.data.code, viaCode.data.detail], [manual.status, manual.data.code, manual.data.detail]);
  assert.equal((await f.call('GET', path, undefined, buyer)).data.code, 'OPERATOR_REQUIRED');

  const op = await f.operator('PAYERDEV0003', 'Busy Operator');
  // Idempotent replay of the decision: same key, same result, one agent.
  const key = { 'idempotency-key': 'approve_once_0001' };
  const first = await f.call('POST', path, { decision: 'approve' }, op, key);
  const replay = await f.call('POST', path, { decision: 'approve' }, op, key);
  assert.deepEqual(replay.data, first.data);
  // The 10-agent limit applies to device approvals too, and a refused approval leaves the code pending.
  for (let i = 0; i < 9; i++) await f.call('POST', '/v1/operators/me/agents', { name: `Agent ${i}`, description: '', style: '' }, op);
  const extra = (await f.newCode()).data;
  const refused = await f.call('POST', `/v1/operators/me/device-approvals/${extra.user_code}`, { decision: 'approve' }, op);
  assert.equal(refused.status, 409);
  assert.equal((await f.call('GET', `/v1/operators/me/device-approvals/${extra.user_code}`, undefined, op)).status, 200);
  assert.equal((await f.poll(extra.device_code)).data.code, 'AUTHORIZATION_PENDING');
  assert.equal((await f.call('POST', `/v1/operators/me/device-approvals/${extra.user_code}`, { decision: 'approve', name: 'X' }, op)).status, 400);
});

test('device approvals limit wrong-code attempts per operator; code issue is capped per client', async t => {
  const f = await fixture(t);
  const op = await f.operator('PAYERDEV0004', 'Guess Operator');
  const other = await f.operator('PAYERDEV0005', 'Other Operator');
  const real = (await f.newCode()).data;
  for (let i = 0; i < DEVICE_LIMITS.failedLookups; i++) {
    assert.equal((await f.call('GET', `/v1/operators/me/device-approvals/ZZZZ-ZZZ${'BCDFGHJKLM'[i]}`, undefined, op)).status, 404);
  }
  const blocked = await f.call('GET', `/v1/operators/me/device-approvals/${real.user_code}`, undefined, op);
  assert.equal(blocked.status, 429, 'even a correct code is refused once the limit is reached');
  assert.equal(blocked.data.code, 'RATE_LIMITED');
  assert.ok(Number(blocked.headers['retry-after']) > 0);
  assert.equal((await f.call('POST', `/v1/operators/me/device-approvals/${real.user_code}`, { decision: 'approve' }, op)).status, 429);
  assert.equal((await f.call('GET', `/v1/operators/me/device-approvals/${real.user_code}`, undefined, other)).status, 200, 'per operator');
  f.advance(DEVICE_LIMITS.failedLookupWindowMs / 1000 + 1);
  const fresh = (await f.newCode()).data;
  assert.equal((await f.call('GET', `/v1/operators/me/device-approvals/${fresh.user_code}`, undefined, op)).status, 200, 'the window slides');

  // Outstanding codes per client: the next one is refused with Retry-After; another client is unaffected.
  for (let i = 1; i < DEVICE_LIMITS.perClient; i++) assert.equal((await f.newCode(undefined, '198.51.100.9')).status, 200);
  assert.equal((await f.newCode(undefined, '198.51.100.9')).status, 200);
  const capped = await f.newCode(undefined, '198.51.100.9');
  assert.equal(capped.status, 429);
  assert.ok(Number(capped.headers['retry-after']) > 0);
  assert.equal((await f.newCode(undefined, 'spoofed, 198.51.100.9')).status, 429, 'only the proxy-appended address counts');
  assert.equal((await f.newCode(undefined, '198.51.100.10')).status, 200);
  f.advance(601);
  assert.equal((await f.newCode(undefined, '198.51.100.9')).status, 200, 'expired codes stop counting');
});

test('device codes persist hashed only, survive a restart, and expired ones are pruned', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'provable-device-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const dbPath = join(dir, 'api.db');
  const now = { value: Date.parse('2026-11-12T15:00:00Z') };
  const first = await fixture(t, { dbPath, now });
  const op = await first.operator('PAYERDEV0006', 'Restart Operator');
  const code = (await first.newCode()).data;
  await first.close();

  const rows = () => { const db = new Database(dbPath, { readonly: true }); try { return db.prepare("SELECT kind, id, json FROM docs").all() as { kind: string; id: string; json: string }[]; } finally { db.close(); } };
  const dump = JSON.stringify(rows());
  assert.ok(!dump.includes(code.device_code), 'the device code is never stored');
  assert.ok(!dump.includes(code.device_code.slice(4)), 'not even without its prefix');
  assert.ok(!dump.includes('203.0.113.7'), 'client addresses are not stored');
  const grant = rows().find(r => r.kind === 'device_grant');
  assert.equal(grant?.id, hashToken(code.device_code));

  const second = await fixture(t, { dbPath, now });
  assert.equal((await second.poll(code.device_code)).data.code, 'AUTHORIZATION_PENDING');
  assert.equal((await second.call('POST', `/v1/operators/me/device-approvals/${code.user_code}`, { decision: 'approve' }, op)).status, 200);
  second.advance(5);
  const issued = await second.poll(code.device_code);
  assert.equal(issued.status, 200);
  await second.close();
  const after = JSON.stringify(rows());
  assert.ok(!after.includes(issued.data.token), 'the agent token is stored hashed only');
  assert.ok(after.includes(hashToken(issued.data.token)));

  const third = await fixture(t, { dbPath, now });
  third.advance(30 * 60);
  await third.newCode(); // any device-flow call prunes
  await third.close();
  assert.ok(!rows().some(r => r.id === hashToken(code.device_code)), 'used codes are deleted after retention');
});

test('example agent connects with a code, honours slow_down, and then works with its own token', async t => {
  const f = await fixture(t);
  await f.api.app.listen({ port: 0, host: '127.0.0.1' });
  const address = f.api.app.server.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const op = await f.operator('PAYERDEV0007', 'Example Operator');
  let shown: any = null;
  const waits: number[] = [];
  const polls: string[] = [];
  const credential = await connectWithCode({
    baseUrl, clientName: 'Example Agent', description: 'Example',
    onCode: (info: any) => { shown = info; },
    fetch: async (url: URL, init: RequestInit) => {
      const response = await fetch(url, init);
      if (url.pathname === '/v1/agent-device-tokens') polls.push((await response.clone().json()).code ?? 'credential');
      return response;
    },
    wait: async (ms: number) => {
      waits.push(ms);
      // Second wait: send one poll too early (server answers SLOW_DOWN); third: operator approves.
      f.advance(waits.length === 2 ? 1 : ms / 1000);
      if (waits.length === 3) await f.call('POST', `/v1/operators/me/device-approvals/${shown.user_code}`, { decision: 'approve' }, op);
    },
  });
  assert.match(shown.verification_uri_complete, /\/operators\/activate\?code=/);
  assert.deepEqual(polls, ['AUTHORIZATION_PENDING', 'SLOW_DOWN', 'credential']);
  assert.deepEqual(waits, [5000, 5000, 10000], 'interval grows by 5 seconds after slow_down');
  const client = agentClient({ baseUrl, token: credential.token });
  assert.equal((await client.whoami()).name, 'Example Agent');

  // Denial and expiry end the wait with a clear error.
  await assert.rejects(connectWithCode({ baseUrl, clientName: 'Denied', onCode: (info: any) => { shown = info; },
    wait: async () => { f.advance(5); await f.call('POST', `/v1/operators/me/device-approvals/${shown.user_code}`, { decision: 'deny' }, op); } }), /denied/);
  await assert.rejects(connectWithCode({ baseUrl, clientName: 'Slow', wait: async (ms: number) => { f.advance(ms / 1000); } }), /expired/);
  await assert.rejects(connectWithCode({ baseUrl, clientName: '' }), /1–80/);
});
