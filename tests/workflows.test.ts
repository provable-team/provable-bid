import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import pg from 'pg';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentAdapter, EvaluatorAdapter } from '../packages/agent-interface/src/index.js';
import { createApi } from '../apps/api/src/app.js';
import type { PageRenderer } from '../apps/api/src/browser.js';
import { heuristicEvaluator, streamingHouseAgent, type PageGenerator } from '../apps/api/src/claude.js';
import { fakeProvider } from '../apps/api/src/provider/fake.js';
import { houseToken, TASKS, workflowsEvaluation, workflowsHouseRunner, type WorkflowsClient } from '../apps/api/src/runners.js';
import { PgStore, Store, type DocStore } from '../apps/api/src/store.js';
import { localWorkflows } from '../apps/api/src/workflows/local.js';
import { defineTasks, type TaskDeps } from '../apps/api/src/workflows/tasks.js';

// RUNNER=workflows against the in-process stand-in for Render Workflows (local.ts): the same task code as on Render,
// with JSON boundaries, retries, chained runs, idempotency keys, getTaskRun and cancelTaskRun. Real clock, real HTTP.
// The restart tests use a durable store: SQLite by default, or Postgres (PgStore, as on Neon) when PG_TEST_URL is set,
// e.g. PG_TEST_URL=postgres://postgres@127.0.0.1:54999/postgres npx tsx --test tests/workflows.test.ts
const PG = process.env.PG_TEST_URL;
/** A durable store that two API "processes" can open in turn (each open is a fresh process reading what was committed). */
async function durable(t: any): Promise<() => Promise<DocStore>> {
  const opened: DocStore[] = [];
  t.after(async () => { for (const st of opened) await st.close(); });
  if (PG) {
    const name = `wf_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const admin = new pg.Client({ connectionString: PG });
    await admin.connect(); await admin.query(`CREATE DATABASE ${name}`); await admin.end();
    const url = new URL(PG); url.pathname = `/${name}`;
    return async () => { const st = await PgStore.open(url.toString(), undefined, { holder: `test-${opened.length}` }); opened.push(st); return st; };
  }
  const dir = mkdtempSync(join(tmpdir(), 'provable-wf-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return async () => { const st = new Store(join(dir, 'api.db')); opened.push(st); return st; };
}

const WEB = 'http://web.test';
const SECRET = 'workflows_secret_for_tests_0001';
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
const ATELIER = { id: 'agent_house_atelier', name: 'Atelier', style: '.', description: '.' };
const freePort = () => new Promise<number>(resolve => { const s = createServer().listen(0, '127.0.0.1', () => { const p = (s.address() as any).port; s.close(() => resolve(p)); }); });
async function until(cond: () => boolean | Promise<boolean>, work: () => Promise<unknown> = async () => {}, ms = 8000) {
  const end = Date.now() + ms;
  while (!(await cond())) { if (Date.now() > end) throw new Error('timed out'); await work(); await new Promise(r => setTimeout(r, 20)); }
}
const deps = (o: Partial<TaskDeps>): TaskDeps => ({ renderer: null, evaluator: heuristicEvaluator(), secret: SECRET, houseAgent: () => null, pollMs: 20, log: () => {}, ...o });
/** A house agent whose first page misses the opening hours (and fails), then fixes it when revising. */
const reviser = (calls: boolean[], gate?: Promise<void>): PageGenerator => async (_ctx, _p, onText, revision) => {
  if (gate) await gate;
  calls.push(!!revision);
  const html = page(!!revision);
  onText(html.slice(0, 200)); onText(html);
  return { text: html, stopReason: 'end_turn' };
};

async function boot(o: { client: WorkflowsClient; workflow: string; port: number; store?: DocStore; houseAgents?: string[]; now?: () => number }) {
  const fake = fakeProvider({ webOrigin: WEB });
  const apiOrigin = `http://127.0.0.1:${o.port}`;
  const evaluator = heuristicEvaluator();
  const api = await createApi({
    store: o.store ?? new Store(':memory:'), provider: fake.provider, evaluator, webOrigin: WEB, apiOrigin, adminToken: null, houseOperatorPayerId: 'HOUSEPAYER0001',
    renderer: { name: 'fake-kernel', render: async () => { throw new Error('the API must not render in workflows mode'); } },
    houseRunner: workflowsHouseRunner({ client: o.client, workflow: o.workflow, apiOrigin, agentIds: o.houseAgents ?? [], pollMs: 20 }),
    evaluationRunner: workflowsEvaluation({ client: o.client, workflow: o.workflow, version: evaluator.version, apiOrigin }),
    workflowsSecret: SECRET, progressIntervalMs: 0, runnerRetryMs: 10, strictResponses: true, simulatePayouts: true, log: () => {}, ...(o.now ? { now: o.now } : {}),
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
  async function outsideAgent() {
    const start = await call('GET', '/v1/operators/connect', null);
    const state = new URL(String(start.data)).searchParams.get('state')!;
    const back = await call('GET', `/v1/operators/connect/callback?code=${encodeURIComponent('fake:PAYER0002:Ops')}&state=${state}`, null);
    const operator = new URLSearchParams(String(back.data).split('#')[1]).get('operator_token')!;
    return (await call('POST', '/v1/operators/me/agents', operator, { name: 'Outside', description: 'Builds pages.', style: 'Clean.' })).data.token as string;
  }
  async function enter(agent: string, competitionId: string, html = page()) {
    const asset = (await call('POST', '/v1/assets', agent, { competition_id: competitionId, type: 'html', mime_type: 'text/html', content_base64: Buffer.from(html).toString('base64') })).data;
    return (await call('POST', `/v1/competitions/${competitionId}/submissions`, agent, { title: 'Crumb', artifacts: [{ asset_id: asset.id }] })).data;
  }
  const progress = async (buyer: string, competitionId: string) => (await call('GET', `/v1/competitions/${competitionId}`, buyer)).data.build_progress?.[0];
  return { api, call, open, outsideAgent, enter, progress, apiOrigin };
}
/** An API process that dies while waiting on runs: its client starts runs but never hears back. */
const dying = (client: WorkflowsClient): WorkflowsClient => ({
  async startTask(...a) { const r = await client.startTask(...a); return { taskRunId: r.taskRunId, get: () => new Promise(() => {}) }; },
  getTaskRun: () => new Promise(() => {}),
  cancelTaskRun: () => new Promise(() => {}),
});

test('Render Workflows runner: house agents build on task runs over HTTP; render and judge are chained runs with retries', async t => {
  const calls: boolean[] = [];
  let renders = 0;
  const renderer: PageRenderer = { name: 'fake-kernel', async render() {
    if (++renders === 1) throw new Error('KERNEL session dropped'); // the render task retries this
    return { desktop: jpeg, phone: jpeg, desktopHeight: 900, phoneHeight: 1800, phoneOverflowPx: 0, consoleErrors: [], blockedRequests: [] };
  } };
  const atelier = streamingHouseAgent(ATELIER, reviser(calls));
  const local = localWorkflows(defineTasks(deps({ renderer, houseAgent: id => id === ATELIER.id ? atelier : null })), { workflow: 'provable-race-workflows', timeScale: 0.001 });
  const f = await boot({ client: local.client, workflow: local.workflow, port: await freePort(), houseAgents: [ATELIER.id] });
  t.after(() => f.api.app.close());

  const agents = (await f.call('GET', '/v1/agents', null)).data.items;
  assert.deepEqual(agents.filter((a: any) => a.internal).map((a: any) => [a.name, a.status]), [['Atelier', 'available'], ['Meadow', 'unavailable'], ['Voltage', 'unavailable']]);
  const { buyer, c } = await f.open();
  await until(async () => (await f.progress(buyer, c.id))?.state === 'qualified', () => f.api.work());

  const p = await f.progress(buyer, c.id);
  assert.deepEqual([p.state, p.attempt, p.missed_requirement_ids], ['qualified', 2, ['req_hours']], 'progress reached the buyer from another instance, through the revision');
  assert.deepEqual(calls, [false, true]);
  const builds = local.runs.filter(r => r.task === TASKS.houseBuild);
  await until(() => builds[0].status !== 'running');
  assert.deepEqual(builds.map(r => [r.status, r.attempts]), [['succeeded', 1]], 'one build run per agent per competition');
  const count = (name: string) => local.runs.filter(r => r.task === name).length;
  assert.deepEqual([count(TASKS.evaluate), count(TASKS.render), count(TASKS.judge)], [2, 2, 2], 'each attempt: one evaluation, chaining one render and one judge');
  const firstRender = local.runs.find(r => r.task === TASKS.render)!;
  assert.deepEqual([firstRender.status, firstRender.attempts], ['succeeded', 2], 'the dropped KERNEL session was retried by the render task');

  const [entry] = (await f.call('GET', `/v1/competitions/${c.id}/submissions`, buyer)).data.items;
  assert.equal(entry.artifacts[0].preview.mime_type, 'image/jpeg', 'screenshots from the workflow run are what buyers see');
  const inputs = JSON.stringify(local.runs.map(r => r.input));
  assert.ok(!inputs.includes(houseToken(SECRET, ATELIER.id)), 'credentials never appear in task arguments');
  assert.ok(!inputs.includes(Buffer.from(page()).toString('base64').slice(0, 40)) && !inputs.includes('Opening hours'), 'nor the private original: runs get a reference');
  const forged = await fetch(`${f.apiOrigin}/internal/house-progress`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer pba_not_a_house_agent' }, body: JSON.stringify({ competition_id: c.id, label: 'x' }) });
  assert.equal(forged.status, 404, 'the progress route only accepts house-agent credentials');
  const job = await fetch(`${f.apiOrigin}/internal/evaluation-jobs/${entry.id}`, { headers: { authorization: 'Bearer nope' } });
  assert.equal(job.status, 404, 'the job route only answers the evaluator credential');
});

test('an evaluation in flight survives an API restart: the idempotency key re-attaches to the same task run', async t => {
  let release!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  const evaluator = heuristicEvaluator();
  const slowJudge: EvaluatorAdapter = { version: evaluator.version, async qualify(input) { await gate; return evaluator.qualify(input); } };
  const local = localWorkflows(defineTasks(deps({ evaluator: slowJudge })), { workflow: 'wf', timeScale: 0.001 });
  const open = await durable(t);
  const port = await freePort();

  const first = await boot({ client: dying(local.client), workflow: 'wf', port, store: await open() });
  const { c } = await first.open();
  const agent = await first.outsideAgent();
  const s = await first.enter(agent, c.id);
  await first.api.work();
  await until(() => local.runs.some(r => r.task === TASKS.judge));
  await first.api.app.close(); // deploy: the old process stops mid-evaluation

  const second = await boot({ client: local.client, workflow: 'wf', port, store: await open() });
  t.after(() => second.api.app.close());
  await second.api.work(); // the restarted worker finds the pending entry and asks for the same run again
  release();
  await until(async () => (await second.call('GET', `/v1/submissions/${s.id}`, agent)).data.qualification_status !== 'pending', () => second.api.work());
  assert.equal((await second.call('GET', `/v1/submissions/${s.id}`, agent)).data.qualification_status, 'qualified');
  assert.deepEqual([local.runs.filter(r => r.task === TASKS.evaluate).length, local.runs.filter(r => r.task === TASKS.judge).length], [1, 1], 'judged once, not twice');
  await second.api.idle();
});

test('a house build still running when the API restarts is re-attached by its persisted run ID: "building", never "didn\'t qualify"', async t => {
  const calls: boolean[] = [];
  let release!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  const atelier = streamingHouseAgent(ATELIER, reviser(calls, gate));
  const local = localWorkflows(defineTasks(deps({ houseAgent: id => id === ATELIER.id ? atelier : null })), { workflow: 'wf', timeScale: 0.001 });
  const open = await durable(t);
  const port = await freePort();

  const first = await boot({ client: dying(local.client), workflow: 'wf', port, store: await open(), houseAgents: [ATELIER.id] });
  const { buyer, c } = await first.open();
  await until(() => local.runs.some(r => r.task === TASKS.houseBuild));
  const build = local.runs.find(r => r.task === TASKS.houseBuild)!;
  await first.api.app.close(); // deploy while the agent is still building

  const second = await boot({ client: local.client, workflow: 'wf', port, store: await open(), houseAgents: [ATELIER.id] });
  t.after(() => second.api.app.close());
  assert.equal((await second.progress(buyer, c.id))?.state, 'building', 'the buyer sees the build that is still running');
  const seen = new Set<string>();
  release();
  await until(async () => { const p = await second.progress(buyer, c.id); if (p) seen.add(p.state); return p?.state === 'qualified'; }, () => second.api.work());
  assert.ok(!seen.has('not_qualified'), `states seen after the restart: ${[...seen].join(', ')}`);
  assert.ok(seen.has('revising') || seen.has('submitted'), 'the failed first attempt was followed by a revision');
  assert.deepEqual(calls, [false, true]);
  await until(() => build.status === 'succeeded');
  assert.equal(local.runs.filter(r => r.task === TASKS.houseBuild).length, 1, 'the same run, not a new one');
  await second.api.idle(); // the re-attached waiter settles (and flushes) before the stores close
});

test('at the submission deadline the API cancels remote builds; the task also stops itself just before it', async t => {
  let skew = 0;
  const hang: AgentAdapter = { id: ATELIER.id, run: ctx => new Promise((_, reject) => ctx.signal.addEventListener('abort', () => reject(new Error('aborted')))) };
  const canceled: string[] = [];
  const local = localWorkflows(defineTasks(deps({ houseAgent: () => hang })), { workflow: 'wf', timeScale: 0.001 });
  const client: WorkflowsClient = { ...local.client, cancelTaskRun: async id => { canceled.push(id); return local.client.cancelTaskRun(id); } };
  const f = await boot({ client, workflow: 'wf', port: await freePort(), houseAgents: [ATELIER.id], now: () => Date.now() + skew });
  t.after(() => f.api.app.close());
  const { buyer, c } = await f.open();
  await until(() => local.runs.some(r => r.task === TASKS.houseBuild));
  const build = local.runs.find(r => r.task === TASKS.houseBuild)!;
  await f.api.work();
  assert.deepEqual(canceled, [], 'nothing is canceled before the deadline');

  skew = 301_000; // the submission window (300 s) has closed
  await f.api.work();
  assert.deepEqual(canceled, [build.id]);
  assert.equal(build.status, 'canceled');
  await until(async () => (await f.progress(buyer, c.id)) === undefined, () => f.api.work());
  await f.api.work();
  assert.deepEqual(canceled, [build.id], 'canceled once');

  // The task's own guard: it stops DEADLINE_MARGIN_MS (5 s) before the deadline, returns normally, and never retries.
  const [houseBuild] = defineTasks(deps({ houseAgent: () => hang })).filter(x => x.name === TASKS.houseBuild);
  const input = (ms: number) => ({ agent_id: ATELIER.id, api_origin: f.apiOrigin, competition: { ...c, submission_deadline: new Date(Date.now() + ms).toISOString() } });
  const t0 = Date.now();
  assert.deepEqual(await houseBuild.fn({ run: async () => { throw new Error('no'); } } as any, input(5_300)), { agent_id: ATELIER.id, competition_id: c.id, stopped: 'deadline' });
  assert.ok(Date.now() - t0 < 2000, 'stopped at the margin, not at the deadline');
  let started = false;
  const late = defineTasks(deps({ houseAgent: () => ({ id: ATELIER.id, run: async () => { started = true; } }) })).find(x => x.name === TASKS.houseBuild)!;
  assert.equal((await late.fn({} as any, input(1_000)) as any).stopped, 'deadline');
  assert.equal(started, false, 'a run (or retry) that starts inside the margin does nothing');
});

test('Render unreachable: the entry stays pending and is retried (re-attaching by idempotency key), never marked as an error', async t => {
  const local = localWorkflows(defineTasks(deps({})), { workflow: 'wf', timeScale: 0.001 });
  let failures = 2;
  const flaky: WorkflowsClient = { ...local.client, async startTask(...a) { if (failures-- > 0) throw new Error('429 Too Many Requests'); return local.client.startTask(...a); } };
  const f = await boot({ client: flaky, workflow: 'wf', port: await freePort() });
  t.after(() => f.api.app.close());
  const { c } = await f.open();
  const agent = await f.outsideAgent();
  const s = await f.enter(agent, c.id);
  await f.api.work(); await f.api.idle();
  assert.equal((await f.call('GET', `/v1/submissions/${s.id}`, agent)).data.qualification_status, 'pending', 'not "error" after a failed start');
  await until(async () => (await f.call('GET', `/v1/submissions/${s.id}`, agent)).data.qualification_status !== 'pending', () => f.api.work());
  assert.equal((await f.call('GET', `/v1/submissions/${s.id}`, agent)).data.qualification_status, 'qualified');
  assert.equal(local.runs.filter(r => r.task === TASKS.evaluate).length, 1);
});

test('the local Workflows stand-in keeps Render\'s limits: 4 MB arguments, retries per task, failed and canceled runs', async () => {
  let n = 0;
  const local = localWorkflows([
    { name: 'flaky', options: { retry: { maxRetries: 2, waitDurationMs: 1 } }, async fn() { if (++n < 3) throw new Error('flake'); return { ok: n }; } },
    { name: 'broken', options: { retry: { maxRetries: 1, waitDurationMs: 1 } }, async fn() { throw new Error('always'); } },
    { name: 'echo', options: {}, async fn(_ctx, v: unknown) { return v; } },
    { name: 'forever', options: {}, fn: () => new Promise(() => {}) },
  ]);
  assert.deepEqual((await (await local.client.startTask('local/flaky', [])).get()).results, [{ ok: 3 }]);
  const broken = await (await local.client.startTask('local/broken', [])).get();
  assert.deepEqual([broken.status, broken.error], ['failed', 'always']);
  assert.deepEqual((await (await local.client.startTask('local/echo', [{ at: new Date(0), b: Buffer.from('x') }])).get()).results,
    [{ at: '1970-01-01T00:00:00.000Z', b: { type: 'Buffer', data: [120] } }], 'only JSON crosses the boundary');
  await assert.rejects(local.client.startTask('local/echo', ['x'.repeat(4 * 1024 * 1024 + 1)]), /4 MB/);
  const forever = await local.client.startTask('local/forever', []);
  assert.equal((await local.client.getTaskRun(forever.taskRunId)).status, 'running');
  await local.client.cancelTaskRun(forever.taskRunId);
  assert.equal((await forever.get()).status, 'canceled');
});
