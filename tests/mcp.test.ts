import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createApi } from '../apps/api/src/app.js';
import { Store } from '../apps/api/src/store.js';
import { fakeProvider } from '../apps/api/src/provider/fake.js';
import { heuristicEvaluator } from '../apps/api/src/claude.js';

const page = (topic = 'contact') => `<!doctype html><html lang="en"><head><title>MCP builder</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main><h1>Independent builders welcome</h1><p>This finished page was submitted over MCP by an outside agent.</p><a href="#${topic}">${topic}</a><section id="${topic}"><h2>Start a conversation</h2><p>Tell us about your next website.</p></section></main></body></html>`;

async function setup(t: any) {
  let now = Date.parse('2026-11-12T10:00:00.000Z');
  const store = new Store(':memory:');
  const fake = fakeProvider({ webOrigin: 'http://buyer.test', autoApprove: true, now: () => now });
  const api = await createApi({ store, provider: fake.provider, evaluator: heuristicEvaluator(), strictResponses: true,
    apiOrigin: 'http://api.test', webOrigin: 'http://buyer.test', now: () => now, log: () => {} });
  await api.app.listen({ port: 0, host: '127.0.0.1' });
  const address = api.app.server.address();
  assert.ok(address && typeof address !== 'string');
  const url = new URL(`http://127.0.0.1:${address.port}/mcp`);
  const clients: Client[] = [];
  t.after(async () => { for (const c of clients) await c.close().catch(() => {}); await api.idle(); await api.app.close(); store.close(); });
  async function post(path: string, token?: string, body?: any) {
    const res = await api.app.inject({ method: 'POST', url: path, headers: {
      'Idempotency-Key': crypto.randomUUID(), ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, ...(body === undefined ? {} : { payload: body }) });
    assert.ok(res.statusCode < 300, res.body);
    return res.json();
  }
  async function agentToken(name = 'MCP Builder') {
    const start = await api.app.inject('/v1/operators/connect');
    const state = new URL(start.headers.location!).searchParams.get('state');
    const back = await api.app.inject(`/v1/operators/connect/callback?state=${state}&code=${encodeURIComponent('fake:EXTERNAL0001:Outside Operator')}`);
    const operator = new URLSearchParams(new URL(back.headers.location!).hash.slice(1)).get('operator_token')!;
    const registered = await post('/v1/operators/me/agents', operator, { name, description: 'An outside agent connected over MCP.', style: 'Simple and usable.', webhook_url: null });
    return { token: registered.token as string, agentId: registered.agent.id as string, operator };
  }
  async function openBrief(requirement = 'Includes a Contact action') {
    const buyer = await post('/v1/buyer-sessions');
    const brief = await post('/v1/competitions', buyer.token, { title: 'An independent builder page', brief: 'Describe an independent builder and give visitors a contact action.',
      bid: { currency: 'USD', amount_minor: 1000 }, submission_window_seconds: 300, decision_window_seconds: 300,
      requirements: [{ id: 'contact', description: requirement }], accepted_terms_version: 'race-v1' });
    await post(`/v1/competitions/${brief.id}/checkout`, buyer.token);
    await post(`/v1/competitions/${brief.id}/authorize`, buyer.token);
    return { id: brief.id as string, buyer: buyer.token as string };
  }
  async function connect(token?: string) {
    const client = new Client({ name: 'provable-test', version: '0.0.1' });
    await client.connect(new StreamableHTTPClientTransport(url, token ? { requestInit: { headers: { Authorization: `Bearer ${token}` } } } : undefined));
    clients.push(client);
    return client;
  }
  async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
    const r = await client.callTool({ name, arguments: args }) as { isError?: boolean; content: { type: string; text: string }[] };
    const text = r.content.map(c => c.text).join('\n');
    return { isError: !!r.isError, text, data: r.isError ? null : JSON.parse(text) };
  }
  const settle = async () => { for (let i = 0; i < 3; i++) { await api.work(); await api.idle(); } };
  return { api, store, url, post, agentToken, openBrief, connect, call, settle, advance: async (s: number) => { now += s * 1000; await api.tick(); } };
}

test('MCP: initialize and list tools without a token; public tools read config and open briefs', async t => {
  const f = await setup(t);
  const brief = await f.openBrief();
  const client = await f.connect();
  assert.equal(client.getServerVersion()?.name, 'provable.bid');
  assert.match(client.getInstructions() ?? '', /sandbox test money/);
  assert.match(client.getInstructions() ?? '', /95%/);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(x => x.name).sort(), ['get_brief', 'get_brief_reference', 'get_config', 'get_submission', 'list_brief_references', 'list_my_earnings', 'list_open_briefs', 'submit_entry', 'whoami']);
  for (const tool of tools) {
    assert.ok(tool.description && tool.description.length > 40, `${tool.name} has a description`);
    assert.equal(tool.inputSchema.type, 'object');
    assert.equal(tool.annotations?.readOnlyHint, tool.name !== 'submit_entry', `${tool.name} readOnlyHint`);
  }
  assert.deepEqual(tools.find(x => x.name === 'submit_entry')!.inputSchema.required?.sort(), ['competition_id', 'html']);

  const config = await f.call(client, 'get_config');
  assert.equal(config.data.mode, 'mock');
  assert.equal(config.data.policy.commission_bps, 500);
  assert.equal(config.data.capabilities.external_agents, true);

  const list = await f.call(client, 'list_open_briefs');
  assert.equal(list.isError, false, list.text);
  assert.deepEqual(list.data.open_briefs.map((b: any) => b.id), [brief.id]);
  assert.equal(list.data.open_briefs[0].requirement_count, 1);
  assert.equal(list.data.open_briefs[0].price_display, '10.00 USD');

  const full = await f.call(client, 'get_brief', { competition_id: brief.id });
  assert.equal(full.data.id, brief.id);
  assert.equal(full.data.requirements[0].id, 'contact');
  assert.ok(full.data.submission_deadline);
  assert.equal(full.data.build_progress, undefined, 'only the owning buyer sees build progress');
  const missing = await f.call(client, 'get_brief', { competition_id: 'cmp_missing' });
  assert.equal(missing.isError, true);
  assert.match(missing.text, /NOT_FOUND/);

  // Anonymous reads share one reader session per process, not a new credential per call.
  const buyers = () => [...f.store.collection<any>('credential').values()].filter(c => c.principal.role === 'buyer').length;
  const before = buyers();
  await f.call(client, 'list_open_briefs');
  await f.call(client, 'get_brief', { competition_id: brief.id });
  assert.equal(buyers(), before);
});

test('MCP: agent tools need a token; bad tokens are tool errors that never echo the token', async t => {
  const f = await setup(t);
  const brief = await f.openBrief();
  const anonymous = await f.connect();
  for (const [name, args] of [['whoami', {}], ['list_my_earnings', {}], ['get_submission', { submission_id: 'sub_x00' }],
    ['submit_entry', { competition_id: brief.id, html: page() }]] as const) {
    const r = await f.call(anonymous, name, args);
    assert.equal(r.isError, true, name);
    assert.match(r.text, /UNAUTHENTICATED/);
    assert.match(r.text, /http:\/\/buyer\.test\/operators/);
    assert.match(r.text, /agent-guide\.md/);
  }
  const secret = 'pba_not_a_real_token_9f8e7d6c5b4a';
  const invalid = await f.connect(secret);
  for (const name of ['whoami', 'list_my_earnings', 'list_open_briefs']) {
    const r = await f.call(invalid, name);
    assert.equal(r.isError, true, name);
    assert.match(r.text, /UNAUTHENTICATED/);
    assert.ok(!r.text.includes(secret), 'the token is never echoed');
  }
  const submit = await f.call(invalid, 'submit_entry', { competition_id: brief.id, html: page() });
  assert.equal(submit.isError, true);
  assert.ok(!submit.text.includes(secret));
  // A buyer or operator credential is not an agent credential: the REST rule applies.
  const { operator } = await f.agentToken();
  const asOperator = await f.call(await f.connect(operator), 'whoami');
  assert.equal(asOperator.isError, true);
  assert.match(asOperator.text, /FORBIDDEN/);
  // Config stays public even with a bad token, as in REST.
  assert.equal((await f.call(invalid, 'get_config')).isError, false);
});

test('MCP: submit an entry, see it qualify, retry safely, and read earnings', async t => {
  const f = await setup(t);
  const brief = await f.openBrief();
  const { token } = await f.agentToken();
  const client = await f.connect(token);
  const me = await f.call(client, 'whoami');
  assert.equal(me.data.name, 'MCP Builder');
  assert.equal(me.data.internal, false);

  const entry = await f.call(client, 'submit_entry', { competition_id: brief.id, html: page() });
  assert.equal(entry.isError, false, entry.text);
  assert.match(entry.data.submission_id, /^sub_/);
  assert.equal(entry.data.qualification_status, 'pending');
  assert.equal(entry.data.title, 'MCP builder', 'defaults to the page title');

  const retry = await f.call(client, 'submit_entry', { competition_id: brief.id, html: page() });
  assert.equal(retry.isError, false, retry.text);
  assert.equal(retry.data.submission_id, entry.data.submission_id, 'an identical retry replays the same submission');
  assert.equal(retry.data.asset_id, entry.data.asset_id, 'and the same upload');

  await f.settle();
  const status = await f.call(client, 'get_submission', { submission_id: entry.data.submission_id });
  assert.equal(status.data.qualification_status, 'qualified');
  assert.equal(status.data.qualification.checks[0].requirement_id, 'contact');
  assert.equal(status.data.qualification.narrative, undefined, 'agents never see the buyer narrative');
  assert.deepEqual(status.data.attempts, { used: 1, max: 3, submission_deadline: status.data.attempts.submission_deadline, may_submit_again: false });

  // The same REST rules: a different page after a qualified entry is a duplicate.
  const second = await f.call(client, 'submit_entry', { competition_id: brief.id, html: page('hello') });
  assert.equal(second.isError, true);
  assert.match(second.text, /DUPLICATE_SUBMISSION/);
  // Someone else's submission is invisible.
  const other = await f.agentToken('Other Builder');
  const peek = await f.call(await f.connect(other.token), 'get_submission', { submission_id: entry.data.submission_id });
  assert.equal(peek.isError, true);
  assert.match(peek.text, /NOT_FOUND/);

  const earnings = await f.call(client, 'list_my_earnings', { limit: 10 });
  assert.deepEqual(earnings.data.items, []);
  assert.equal(earnings.data.next_cursor, null);

  // The buyer selects it: the allocation appears in the agent's earnings, exactly as REST returns it.
  await f.advance(301); await f.settle();
  await f.post(`/v1/competitions/${brief.id}/selection`, brief.buyer, { submission_id: entry.data.submission_id });
  await f.settle();
  const after = await f.call(client, 'list_my_earnings');
  const rest = await f.api.app.inject({ url: '/v1/agents/me/earnings', headers: { authorization: `Bearer ${token}` } });
  assert.equal(after.data.items.length, 1, 'the won allocation is listed');
  assert.ok(after.data.items[0].agent_shares.some((x: any) => x.agent_id === me.data.id));
  assert.deepEqual(after.data, rest.json());
});

test('MCP: failed attempt allows a revision; over-size pages are refused before upload', async t => {
  const f = await setup(t);
  const brief = await f.openBrief('Shows the pricing table with monthly plans');
  const { token } = await f.agentToken();
  const client = await f.connect(token);
  const first = await f.call(client, 'submit_entry', { competition_id: brief.id, html: page(), title: 'First try', idempotency_key: 'my-key-0001' });
  assert.equal(first.data.idempotency_key, 'my-key-0001');
  await f.settle();
  const failed = await f.call(client, 'get_submission', { submission_id: first.data.submission_id });
  assert.equal(failed.data.qualification_status, 'failed');
  assert.equal(failed.data.qualification.checks[0].passed, false);
  assert.equal(failed.data.attempts.may_submit_again, true);
  // Reusing a key with a different page is a conflict, not a silent replay.
  const conflict = await f.call(client, 'submit_entry', { competition_id: brief.id, html: page('pricing'), title: 'First try', idempotency_key: 'my-key-0001' });
  assert.equal(conflict.isError, true);
  assert.match(conflict.text, /IDEMPOTENCY_CONFLICT/);
  const revised = await f.call(client, 'submit_entry', { competition_id: brief.id, html: page('pricing').replace('</main>', '<h2>Pricing table</h2><p>Monthly plans from $9.</p></main>'), title: 'Revised' });
  assert.equal(revised.isError, false, revised.text);
  assert.notEqual(revised.data.submission_id, first.data.submission_id);
  await f.settle();
  const ok = await f.call(client, 'get_submission', { submission_id: revised.data.submission_id });
  assert.equal(ok.data.qualification_status, 'qualified');
  assert.equal(ok.data.attempts.used, 2);

  const huge = await f.call(client, 'submit_entry', { competition_id: brief.id, html: page().replace('</body>', `<p>${'x'.repeat(530_000)}</p></body>`) });
  assert.equal(huge.isError, true);
  assert.match(huge.text, /PAYLOAD_TOO_LARGE/);
  // A page near the 512 KiB limit is larger than the API's 1 MB body limit once JSON-escaped; /mcp allows for that.
  const quoted = await f.call(client, 'submit_entry', { competition_id: brief.id, html: page().replace('</body>', `<p>${'"'.repeat(500_000)}</p></body>`) });
  assert.match(quoted.text, /DUPLICATE_SUBMISSION/, 'uploaded, then refused by the one-entry rule (not by the body limit)');
  const badId = await f.call(client, 'get_brief', { competition_id: '../v1/config' });
  assert.equal(badId.isError, true, 'IDs are validated before any request is built');
});

test('MCP HTTP: stateless transport answers 405 to GET/DELETE and 406 without the right Accept', async t => {
  const f = await setup(t);
  const get = await f.api.app.inject({ method: 'GET', url: '/mcp' });
  assert.equal(get.statusCode, 405);
  assert.equal(get.headers.allow, 'POST');
  assert.equal((await f.api.app.inject({ method: 'DELETE', url: '/mcp' })).statusCode, 405);
  const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'raw', version: '1' } } };
  const wrongAccept = await f.api.app.inject({ method: 'POST', url: '/mcp', headers: { accept: 'application/json', 'content-type': 'application/json' }, payload: init });
  assert.equal(wrongAccept.statusCode, 406);
  const ok = await f.api.app.inject({ method: 'POST', url: '/mcp', headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' }, payload: init });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().result.serverInfo.name, 'provable.bid');
  assert.equal(ok.headers['mcp-session-id'], undefined, 'stateless: no session');
  assert.equal(ok.headers['cache-control'], 'no-store');
  const discovery = await f.api.app.inject('/.well-known/agent.json');
  assert.equal(discovery.json().mcp_url, 'http://api.test/mcp');
});

test('MCP HTTP: a browser MCP client on the site passes the CORS preflight with the MCP headers', async t => {
  const f = await setup(t);
  const preflight = await f.api.app.inject({ method: 'OPTIONS', url: '/mcp', headers: {
    origin: 'http://buyer.test', 'access-control-request-method': 'POST',
    'access-control-request-headers': 'authorization,content-type,mcp-protocol-version,mcp-session-id',
  } });
  assert.equal(preflight.statusCode, 204);
  assert.equal(preflight.headers['access-control-allow-origin'], 'http://buyer.test');
  assert.match(String(preflight.headers['access-control-allow-methods']), /\bPOST\b/);
  const allowed = String(preflight.headers['access-control-allow-headers']).toLowerCase().split(/,\s*/);
  for (const h of ['authorization', 'content-type', 'idempotency-key', 'mcp-protocol-version', 'mcp-session-id']) assert.ok(allowed.includes(h), `${h} allowed`);
  const other = await f.api.app.inject({ method: 'OPTIONS', url: '/mcp', headers: { origin: 'https://evil.test', 'access-control-request-method': 'POST' } });
  assert.equal(other.headers['access-control-allow-origin'], undefined, 'other origins stay refused');
});
