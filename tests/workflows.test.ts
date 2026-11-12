import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentAdapter } from '../packages/agent-interface/src/index.js';
import { createApi } from '../apps/api/src/app.js';
import type { PageRenderer } from '../apps/api/src/browser.js';
import { heuristicEvaluator, streamingHouseAgent } from '../apps/api/src/claude.js';
import { fakeProvider } from '../apps/api/src/provider/fake.js';
import { houseToken, TASKS, workflowsEvaluation, workflowsHouseRunner, type WorkflowsClient } from '../apps/api/src/runners.js';
import { Store } from '../apps/api/src/store.js';
import { localWorkflows } from '../apps/api/src/workflows/local.js';
import { defineTasks } from '../apps/api/src/workflows/tasks.js';

// The Render Workflows runner (RUNNER=workflows) against the in-process fake of Render Workflows (local.ts): the same
// task code as on Render, with JSON boundaries, retries, chained runs and idempotency keys. Real clock, real HTTP.

const WEB = 'http://web.test';
const SECRET = 'house_secret_for_tests_0001';
const page = (hours = true) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Crumb &amp; Co.</title></head><body>
<h1>Crumb &amp; Co. — a family bakery since 1987</h1><p>Fresh sourdough and cardamom buns baked every morning.</p>
${hours ? '<section><h2>Opening hours</h2><p>Tuesday to Sunday, 7am to 3pm. Closed Mondays.</p></section>' : '<section><h2>Our story</h2><p>Three generations of bakers.</p></section>'}
<a href="#preorder">Pre-order now</a></body></html>`;
const brief = {
  title: 'Landing page for a neighborhood bakery', brief: 'One page for Crumb & Co. Hero, opening hours, pre-order button. Mobile first.',
  bid: { currency: 'USD', amount_minor: 2000 }, submission_window_seconds: 300, decision_window_seconds: 3600, accepted_terms_version: 'race-v1',
  requirements: [
    { id: 'req_hours', description: 'Shows opening hours.' },
    { id: 'req_preorder', description: 'Has a clearly visible pre-order button.' },
    { id: 'req_mobile', description: 'Works on a 375px-wide phone screen.' },
  ],
};
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const freePort = () => new Promise<number>(resolve => { const s = createServer().listen(0, '127.0.0.1', () => { const p = (s.address() as any).port; s.close(() => resolve(p)); }); });
async function until(cond: () => boolean | Promise<boolean>, work: () => Promise<unknown>, ms = 8000) {
  const end = Date.now() + ms;
  while (!(await cond())) { if (Date.now() > end) throw new Error('timed out'); await work(); await new Promise(r => setTimeout(r, 20)); }
}

async function boot(o: { client: WorkflowsClient; workflow: string; port: number; dbPath?: string; houseAgents?: string[] }) {
  const fake = fakeProvider({ webOrigin: WEB });
  const apiOrigin = `http://127.0.0.1:${o.port}`;
  const evaluator = heuristicEvaluator();
  const api = await createApi({
    store: new Store(o.dbPath ?? ':memory:'), provider: fake.provider, evaluator, webOrigin: WEB, apiOrigin, adminToken: null, houseOperatorPayerId: 'HOUSEPAYER0001',
    renderer: { name: 'fake-kernel', render: async () => { throw new Error('the API must not render in workflows mode'); } },
    houseRunner: workflowsHouseRunner({ client: o.client, workflow: o.workflow, apiOrigin, agentIds: o.houseAgents ?? [] }),
    evaluationRunner: workflowsEvaluation({ client: o.client, workflow: o.workflow, version: evaluator.version }),
    houseTokenSecret: SECRET, progressIntervalMs: 0, strictResponses: true, simulatePayouts: true, log: () => {},
  });
  await api.app.listen({ host: '127.0.0.1', port: o.port });
  let seq = 0;
  const call = async (method: 'GET' | 'POST', url: string, token: string | null, payload?: unknown) => {
    const r = await api.app.inject({ method, url, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(method === 'POST' ? { 'idempotency-key': `command_${++seq}_key` } : {}) }, ...(payload !== undefined ? { payload: payload as any } : {}) });
    assert.ok(r.statusCode < 400, `${method} ${url} → ${r.statusCode} ${r.body.slice(0, 300)}`);
    return { status: r.statusCode, data: r.statusCode === 302 ? r.headers.location : r.json() };
  };
  async function open() {
    const buyer = (await call('POST', '/v1/buyer-sessions', null)).data.token as string;
    const c = (await call('POST', '/v1/competitions', buyer, brief)).data;
    const checkout = (await call('POST', `/v1/competitions/${c.id}/checkout`, buyer)).data;
    fake.controls.approve(checkout.provider_order_id);
    assert.equal((await call('POST', `/v1/competitions/${c.id}/authorize`, buyer)).status, 202);
    return { buyer, c };
  }
  return { api, call, open, apiOrigin };
}

test('Render Workflows runner: house agents build on task runs over HTTP; render and judge are chained runs with retries', async t => {
  const pages: boolean[] = [];
  const atelier = streamingHouseAgent({ id: 'agent_house_atelier', name: 'Atelier', style: '.', description: '.' }, async (_ctx, _p, onText, revision) => {
    pages.push(!!revision);
    const html = page(!!revision); // attempt 1 misses the opening hours; the revision fixes it
    onText(html.slice(0, 200)); onText(html);
    return { text: html, stopReason: 'end_turn' };
  });
  let renders = 0;
  const renderer: PageRenderer = { name: 'fake-kernel', async render() {
    if (++renders === 1) throw new Error('KERNEL session dropped'); // the render task retries this
    return { desktop: jpeg, phone: jpeg, desktopHeight: 900, phoneHeight: 1800, phoneOverflowPx: 0, consoleErrors: [], blockedRequests: [] };
  } };
  const local = localWorkflows(defineTasks({ renderer, evaluator: heuristicEvaluator(), houseSecret: SECRET, houseAgent: id => id === 'agent_house_atelier' ? atelier as AgentAdapter : null, pollMs: 20, log: () => {} }),
    { workflow: 'provable-race-workflows', timeScale: 0.001 });
  const f = await boot({ client: local.client, workflow: local.workflow, port: await freePort(), houseAgents: ['agent_house_atelier'] });
  t.after(() => f.api.app.close());

  const agents = (await f.call('GET', '/v1/agents', null)).data.items;
  assert.deepEqual(agents.filter((a: any) => a.internal).map((a: any) => [a.name, a.status]), [['Atelier', 'available'], ['Meadow', 'unavailable'], ['Voltage', 'unavailable']]);
  const { buyer, c } = await f.open();
  const progress = async () => (await f.call('GET', `/v1/competitions/${c.id}`, buyer)).data.build_progress?.[0];
  await until(async () => (await progress())?.state === 'qualified', () => f.api.work());

  const p = await progress();
  assert.deepEqual([p.state, p.attempt, p.missed_requirement_ids], ['qualified', 2, ['req_hours']], 'progress reached the buyer from another instance, through the revision');
  assert.deepEqual(pages, [false, true]);
  const builds = local.runs.filter(r => r.task === TASKS.houseBuild);
  await until(() => builds[0].status !== 'running', async () => {});
  assert.deepEqual(builds.map(r => [r.status, r.attempts]), [['completed', 1]], 'one build run per agent per competition');
  const count = (name: string) => local.runs.filter(r => r.task === name).length;
  assert.deepEqual([count(TASKS.evaluate), count(TASKS.render), count(TASKS.judge)], [2, 2, 2], 'each attempt: one evaluation, chaining one render and one judge');
  const firstRender = local.runs.find(r => r.task === TASKS.render)!;
  assert.deepEqual([firstRender.status, firstRender.attempts], ['completed', 2], 'the dropped KERNEL session was retried by the render task');
  assert.ok(local.runs.filter(r => r.task !== TASKS.houseBuild).every(r => r.parent || r.task === TASKS.evaluate));

  const [entry] = (await f.call('GET', `/v1/competitions/${c.id}/submissions`, buyer)).data.items;
  assert.equal(entry.artifacts[0].preview.mime_type, 'image/jpeg', 'screenshots from the workflow run are what buyers see');
  assert.ok(!JSON.stringify(local.runs.map(r => r.input)).includes(houseToken(SECRET, 'agent_house_atelier')), 'credentials never appear in task arguments');
  const forged = await fetch(`${f.apiOrigin}/internal/house-progress`,
    { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer pba_not_a_house_agent' }, body: JSON.stringify({ competition_id: c.id, label: 'x' }) });
  assert.equal(forged.status, 404, 'the progress route only accepts house-agent credentials');
});

test('an evaluation in flight survives an API restart: the idempotency key re-attaches to the same task run', async t => {
  let release!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  const evaluator = heuristicEvaluator();
  const slowJudge = { version: evaluator.version, async qualify(input: any) { await gate; return evaluator.qualify(input); } };
  const local = localWorkflows(defineTasks({ renderer: null, evaluator: slowJudge, houseSecret: SECRET, houseAgent: () => null, log: () => {} }), { workflow: 'wf', timeScale: 0.001 });
  // The first API process dies while waiting on the run: its client never hears back.
  const dying: WorkflowsClient = { async startTask(...a) { const r = await local.client.startTask(...a); return { taskRunId: r.taskRunId, get: () => new Promise(() => {}) }; } };
  const dir = mkdtempSync(join(tmpdir(), 'provable-wf-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const db = join(dir, 'api.db');

  const first = await boot({ client: dying, workflow: 'wf', port: await freePort(), dbPath: db });
  t.after(() => first.api.app.close());
  const { buyer, c } = await first.open();
  // An outside agent enters.
  const start = await first.call('GET', '/v1/operators/connect', null);
  const state = new URL(String(start.data)).searchParams.get('state')!;
  const back = await first.call('GET', `/v1/operators/connect/callback?code=${encodeURIComponent('fake:PAYER0002:Ops')}&state=${state}`, null);
  const operator = new URLSearchParams(String(back.data).split('#')[1]).get('operator_token')!;
  const agent = (await first.call('POST', '/v1/operators/me/agents', operator, { name: 'Outside', description: 'Builds pages.', style: 'Clean.' })).data.token;
  const asset = (await first.call('POST', '/v1/assets', agent, { competition_id: c.id, type: 'html', mime_type: 'text/html', content_base64: Buffer.from(page()).toString('base64') })).data;
  const s = (await first.call('POST', `/v1/competitions/${c.id}/submissions`, agent, { title: 'Crumb', artifacts: [{ asset_id: asset.id }] })).data;
  await first.api.work();
  await until(() => local.runs.some(r => r.task === TASKS.judge), async () => {});
  await first.api.app.close(); // deploy: the old process stops mid-evaluation

  const second = await boot({ client: local.client, workflow: 'wf', port: await freePort(), dbPath: db });
  t.after(() => second.api.app.close());
  await second.api.work(); // the restarted worker finds the pending entry and asks for the same run again
  release();
  await until(async () => (await second.call('GET', `/v1/submissions/${s.id}`, agent)).data.qualification_status !== 'pending', () => second.api.work());
  assert.equal((await second.call('GET', `/v1/submissions/${s.id}`, agent)).data.qualification_status, 'qualified');
  assert.deepEqual([local.runs.filter(r => r.task === TASKS.evaluate).length, local.runs.filter(r => r.task === TASKS.judge).length], [1, 1], 'judged once, not twice');
  assert.ok(buyer);
});

test('the local Workflows fake keeps Render\'s limits: 4 MB arguments, retries per task, a failed run reported as failed', async () => {
  let n = 0;
  const local = localWorkflows([
    { name: 'flaky', options: { retry: { maxRetries: 2, waitDurationMs: 1 } }, async fn() { if (++n < 3) throw new Error('flake'); return { ok: n }; } },
    { name: 'broken', options: { retry: { maxRetries: 1, waitDurationMs: 1 } }, async fn() { throw new Error('always'); } },
    { name: 'echo', options: {}, async fn(_ctx, v: unknown) { return v; } },
  ]);
  assert.deepEqual((await (await local.client.startTask('local/flaky', [])).get()).results, [{ ok: 3 }]);
  const broken = await (await local.client.startTask('local/broken', [])).get();
  assert.deepEqual([broken.status, broken.error], ['failed', 'always']);
  assert.deepEqual((await (await local.client.startTask('local/echo', [{ at: new Date(0), b: Buffer.from('x') }])).get()).results,
    [{ at: '1970-01-01T00:00:00.000Z', b: { type: 'Buffer', data: [120] } }], 'only JSON crosses the boundary');
  await assert.rejects(local.client.startTask('local/echo', ['x'.repeat(4 * 1024 * 1024 + 1)]), /4 MB/);
});
