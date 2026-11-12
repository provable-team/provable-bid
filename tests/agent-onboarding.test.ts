import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../apps/api/src/app.js';
import { Store } from '../apps/api/src/store.js';
import { fakeProvider } from '../apps/api/src/provider/fake.js';
import { heuristicEvaluator } from '../apps/api/src/claude.js';
import { contract } from '../scripts/contract.js';

const { agentClient } = await import(new URL('../examples/agent.mjs', import.meta.url).href);
const html = '<!doctype html><html lang="en"><head><title>Outside agent</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main><h1>Independent builders welcome</h1><p>This finished page was uploaded by a separately registered outside agent through the public HTTP interface.</p><a href="#contact">Contact</a><section id="contact"><h2>Start a conversation</h2><p>Tell us about your next website.</p></section></main></body></html>';

async function setup(t: any) {
  let now = Date.now();
  const store = new Store(':memory:');
  const fake = fakeProvider({ webOrigin: 'http://buyer.test', autoApprove: true, now: () => now });
  const api = await createApi({ store, provider: fake.provider, evaluator: heuristicEvaluator(),
    apiOrigin: 'http://docs.test', webOrigin: 'http://buyer.test', now: () => now, log: () => {} });
  await api.app.listen({ port: 0, host: '127.0.0.1' });
  const address = api.app.server.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  t.after(async () => { await api.idle(); await api.app.close(); store.close(); });
  async function post(path: string, token?: string, body?: any) {
    const res = await api.app.inject({ method: 'POST', url: path, headers: {
      'Idempotency-Key': crypto.randomUUID(), ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, ...(body === undefined ? {} : { payload: body }) });
    assert.ok(res.statusCode < 300, res.body);
    return res.json();
  }
  async function operator() {
    const start = await api.app.inject('/v1/operators/connect');
    const state = new URL(start.headers.location!).searchParams.get('state');
    const back = await api.app.inject(`/v1/operators/connect/callback?state=${state}&code=${encodeURIComponent('fake:EXTERNAL0001:Outside Operator')}`);
    const token = new URL(back.headers.location!).hash.slice(1);
    return new URLSearchParams(token).get('operator_token')!;
  }
  return { api, baseUrl, post, operator, advance: async (seconds: number) => { now += seconds * 1000; await api.tick(); } };
}

test('integration resources are public, exact, downloadable, and point at the configured deployment', async t => {
  const { api } = await setup(t);
  const discovery = await api.app.inject('/.well-known/agent.json');
  assert.equal(discovery.statusCode, 200);
  assert.equal(discovery.json().operator_onboarding_url, 'http://buyer.test/operators');
  assert.equal(discovery.json().openapi_url, 'http://docs.test/openapi.json');
  const openapi = await api.app.inject('/openapi.json');
  assert.deepEqual(openapi.json().paths, contract.paths);
  assert.equal(openapi.json().servers[0].url, 'http://docs.test');
  assert.equal(contract.servers[0].url, 'http://127.0.0.1:4010', 'the checked-in contract is never mutated');
  const guide = await api.app.inject('/agent-guide.md');
  assert.match(guide.headers['content-type']!, /text\/markdown/);
  assert.match(guide.body, /paypal_sandbox/);
  assert.match(guide.body, /http:\/\/buyer\.test\/operators/);
  assert.doesNotMatch(guide.body, /\{\{(?:API|WEB)_ORIGIN\}\}/);
  const example = await api.app.inject('/examples/agent.mjs');
  assert.equal(example.statusCode, 200);
  assert.match(example.headers['content-disposition']!, /attachment/);
  assert.match(example.body, /export function agentClient/);
});

test('outside-agent example completes HTTP participation and replays lost responses without duplicate commands', async t => {
  const f = await setup(t);
  const operator = await f.operator();
  const registered = await f.post('/v1/operators/me/agents', operator, {
    name: 'Independent Builder', description: 'An outside agent using its own page generator.', style: 'Simple and usable.', webhook_url: null,
  });
  const buyer = await f.post('/v1/buyer-sessions');
  const brief = await f.post('/v1/competitions', buyer.token, { title: 'An independent builder page', brief: 'Describe an independent builder and give visitors a contact action.',
    bid: { currency: 'USD', amount_minor: 1000 }, submission_window_seconds: 300, decision_window_seconds: 300,
    requirements: [{ id: 'contact', description: 'Includes a Contact action' }], accepted_terms_version: 'race-v1' });
  await f.post(`/v1/competitions/${brief.id}/checkout`, buyer.token);
  await f.post(`/v1/competitions/${brief.id}/authorize`, buyer.token);

  const commands: { path: string; key: string; body: string }[] = [];
  const lost = new Set<string>();
  const client = agentClient({ baseUrl: f.baseUrl, token: registered.token, wait: async () => {},
    fetch: async (url: URL, init: RequestInit) => {
      const response = await fetch(url, init);
      if (init.method === 'POST') {
        const key = (init.headers as Record<string, string>)['Idempotency-Key'];
        commands.push({ path: url.pathname, key, body: init.body as string });
        if (!lost.has(url.pathname)) {
          lost.add(url.pathname);
          if (url.pathname.endsWith('/submissions')) return new Response('{"id":', { status: 201, headers: { 'Content-Type': 'application/json' } });
          throw new Error('Response lost after server committed.');
        }
      }
      return response;
    },
  });
  assert.equal((await client.whoami()).internal, false);
  assert.deepEqual((await client.briefs()).map((x: any) => x.id), [brief.id]);
  const entry = await client.submit(brief.id, Buffer.from(html), 'Independent finished page');
  assert.equal(entry.qualification_status, 'pending');
  assert.equal(commands.length, 4);
  assert.deepEqual(commands[0], commands[1], 'upload retry retains key and exact body');
  assert.deepEqual(commands[2], commands[3], 'submission retry retains key and exact body');
  await f.api.idle(); await f.api.work(); await f.api.idle();
  assert.equal((await client.status(entry.id)).qualification_status, 'qualified');
  assert.deepEqual(await client.earnings(), []);
  const again = await client.submit(brief.id, Buffer.from(html), 'Independent finished page');
  assert.equal(again.id, entry.id, 'rerunning an unchanged command replays the same submission');
  await f.advance(1000);
  assert.notEqual((await client.brief(brief.id)).state, 'open');
  assert.equal((await client.submit(brief.id, Buffer.from(html), 'Independent finished page')).id, entry.id,
    'a committed command can still be recovered after the deadline closes');
  await f.post(`/v1/operators/me/agents/${registered.agent.id}/credential`, operator);
  await assert.rejects(client.whoami(), /API 401/);
});

test('example follows opaque cursors, filters closed briefs, and never retries a bad credential', async () => {
  const paths: string[] = [];
  const client = agentClient({ token: 'pba_test', fetch: async (url: URL) => {
    paths.push(url.pathname + url.search);
    return Response.json(paths.length === 1 ? { items: [{ id: 'closed', state: 'closed' }], next_cursor: 'cursor with/+=' }
      : { items: [{ id: 'open', state: 'open' }], next_cursor: null });
  } });
  assert.deepEqual(await client.briefs(), [{ id: 'open', state: 'open' }]);
  assert.equal(new URL(`https://api.test${paths[1]}`).searchParams.get('cursor'), 'cursor with/+=');
  let calls = 0;
  const invalid = agentClient({ token: 'pba_test', fetch: async () => { calls++; return Response.json({ code: 'UNAUTHENTICATED' }, { status: 401 }); } });
  await assert.rejects(invalid.whoami(), /API 401/);
  assert.equal(calls, 1);
  assert.throws(() => agentClient({ token: 'pbo_operator' }), /pba_/);
  assert.throws(() => agentClient({ token: 'pba_test', baseUrl: 'http://remote.example' }), /HTTPS/);
});
