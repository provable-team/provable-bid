import type { AgentAdapter, AgentContext, EvaluatorAdapter } from '../../../../packages/agent-interface/src/index.js';
import type { components } from '../../../../packages/api-client/src/schema.js';
import type { PageRenderer } from '../browser.js';
import {
  errorVerdict, evaluatorToken, gateVerdict, houseToken, judgeEntry, renderEntry, TASKS,
  type EvaluationJob, type EvaluationOutcome, type EvaluationRef, type HouseBuildInput, type RenderedPage, type Verdict,
} from '../runners.js';

type S = components['schemas'];

/**
 * The Render Workflows tasks, as plain functions so the same code runs on Render (registered with the SDK's `task()`
 * in main.ts), under `render workflows dev`, and in the in-process fake used by the tests (local.ts).
 *
 *   evaluateSubmission(ref)          gates → renderEntry (KERNEL) → judgeEntry (Claude); each step its own run with retries
 *   houseAgentBuild(input)           one house agent's whole build for one competition (all attempts), via the public API
 *
 * Evaluation runs get a reference ({ submission_id, api_origin }) and fetch the job from the API themselves, so the
 * private original never sits in Render's retained run arguments, and arguments stay far below the 4 MB limit.
 */
export interface TaskCtx {
  /** Chain a run of another task on its own instance (SDK: ctx.run). */
  run<T>(taskName: string, ...args: unknown[]): Promise<T>;
}
export type TaskSpec = {
  name: string;
  options: { retry?: { maxRetries: number; waitDurationMs: number; backoffScaling?: number }; timeoutSeconds?: number; plan?: string };
  fn: (ctx: TaskCtx, ...args: any[]) => Promise<unknown>;
};
export type TaskDeps = {
  renderer: PageRenderer | null;
  evaluator: EvaluatorAdapter;
  /** A house agent by ID (null when the workflow has no model key). */
  houseAgent: (agentId: string) => AgentAdapter | null;
  /** WORKFLOWS_SECRET, shared with the API: house-agent and evaluator credentials are derived from it (runners.ts). */
  secret: string | null;
  fetch?: typeof fetch;
  log?: (m: string, x?: unknown) => void;
  /** Poll interval while a house agent waits for its own check (default 2000 ms). */
  pollMs?: number;
};
/** A house agent stops this long before the submission deadline (the API cancels the run at the deadline itself). */
export const DEADLINE_MARGIN_MS = 5000;

/** An AgentContext that reaches the API over HTTPS with the house agent's own credential, like an outside agent. */
export function httpAgentContext(input: HouseBuildInput, token: string, signal: AbortSignal, deps: Pick<TaskDeps, 'fetch' | 'pollMs'>): AgentContext {
  const f = deps.fetch ?? fetch;
  const api = input.api_origin.replace(/\/$/, '');
  const c = input.competition;
  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, key?: string): Promise<T> {
    const r = await f(`${api}${path}`, {
      method, signal,
      headers: { authorization: `Bearer ${token}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(key ? { 'idempotency-key': key } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await r.text();
    if (r.status >= 300) throw new Error(`${path} → ${r.status} ${text.slice(0, 200)}`);
    return JSON.parse(text) as T;
  }
  // Progress: latest step wins, at most one POST in flight; the API throttles and sanitizes again.
  let queued: object | null = null; let sending = false;
  const flush = async () => {
    if (sending) return;
    sending = true;
    try { while (queued && !signal.aborted) { const body = queued; queued = null; await call('POST', '/internal/house-progress', body).catch(() => {}); } }
    finally { sending = false; }
  };
  return {
    competition: c, signal,
    uploadAsset: (asset, key) => call('POST', '/v1/assets', asset, key),
    submit: (work, key) => call('POST', `/v1/competitions/${c.id}/submissions`, work, key),
    timeLeftMs: () => Date.parse(c.submission_deadline!) - Date.now(),
    progress: (label, opts) => { queued = { competition_id: c.id, label, immediate: !!opts?.immediate, colors: opts?.colors, structure: opts?.structure }; void flush(); },
    async waitForResult(submissionId) {
      for (;;) {
        if (signal.aborted) throw new Error('submission deadline');
        const s = await call<S['Submission']>('GET', `/v1/submissions/${submissionId}`);
        if (s.qualification_status !== 'pending') return s;
        await new Promise(r => setTimeout(r, deps.pollMs ?? 2000));
      }
    },
  };
}

/** The evaluation job for a submission, from the API (internal route, evaluator credential). */
async function fetchJob(ref: EvaluationRef, deps: TaskDeps): Promise<EvaluationJob> {
  if (!deps.secret) throw new Error('WORKFLOWS_SECRET is not set on the workflow service');
  const r = await (deps.fetch ?? fetch)(`${ref.api_origin.replace(/\/$/, '')}/internal/evaluation-jobs/${encodeURIComponent(ref.submission_id)}`,
    { headers: { authorization: `Bearer ${evaluatorToken(deps.secret)}` }, signal: AbortSignal.timeout(30_000) });
  if (r.status !== 200) throw new Error(`evaluation job ${ref.submission_id} → ${r.status}`);
  return await r.json() as EvaluationJob;
}

export function defineTasks(deps: TaskDeps): TaskSpec[] {
  const log = deps.log ?? ((m: string, x?: unknown) => console.log(`[workflows] ${m}`, x ?? ''));
  return [
    {
      // A KERNEL browser session is cheap to retry; a flaky one should not cost the entry its screenshots.
      name: TASKS.render, options: { retry: { maxRetries: 2, waitDurationMs: 2000, backoffScaling: 2 }, timeoutSeconds: 180 },
      async fn(_ctx, ref: EvaluationRef): Promise<RenderedPage | null> {
        if (!deps.renderer) return null;
        const job = await fetchJob(ref, deps);
        let failure: unknown = null;
        const page = await renderEntry(job, deps.renderer, (_m, x) => { failure = x; });
        if (!page) throw new Error(`render failed: ${String(failure)}`); // throw, so Render retries it
        return page;
      },
    },
    {
      // The judge: retried on overload or timeouts. Gets the screenshots as arguments (≤ ~2 MB), the page by reference.
      name: TASKS.judge, options: { retry: { maxRetries: 2, waitDurationMs: 5000, backoffScaling: 2 }, timeoutSeconds: 240 },
      fn: async (_ctx, ref: EvaluationRef, rendered: RenderedPage | null): Promise<Verdict> => judgeEntry(await fetchJob(ref, deps), rendered, deps.evaluator),
    },
    {
      // Same semantics as in-process: a failed render means no screenshots (the judge still runs), a failed judge
      // means an 'error' result. One retry covers a lost instance; finished chained runs aren't repeated by the API's
      // idempotency key, but a retried orchestrator does start fresh chained runs.
      name: TASKS.evaluate, options: { retry: { maxRetries: 1, waitDurationMs: 2000 }, timeoutSeconds: 900 },
      async fn(ctx, ref: EvaluationRef): Promise<EvaluationOutcome> {
        const job = await fetchJob(ref, deps);
        const gated = gateVerdict(job);
        if (gated) return { rendered: null, result: gated };
        let rendered: RenderedPage | null = null;
        try { rendered = await ctx.run<RenderedPage | null>(TASKS.render, ref); }
        catch (e) { log(`browser render failed on ${ref.submission_id}`, (e as Error).message); }
        // Arguments over 4 MB would be refused: judge here instead (same code, no retries of its own).
        const tooBig = Buffer.byteLength(JSON.stringify([ref, rendered])) > 3.5 * 1024 * 1024;
        try { return { rendered, result: tooBig ? await judgeEntry(job, rendered, deps.evaluator) : await ctx.run<Verdict>(TASKS.judge, ref, rendered) }; }
        catch (e) { log(`evaluator failed on ${ref.submission_id}`, (e as Error).message); return { rendered, result: errorVerdict(deps.evaluator.version) }; }
      },
    },
    {
      // One retry: a build that died before submitting (model overload, instance loss) starts over. After a submission
      // the API's attempt rules decide, so a retry can never add an entry the rules don't allow. The run stops itself
      // DEADLINE_MARGIN_MS before the submission deadline (and doesn't retry then); the API also cancels it at the deadline.
      name: TASKS.houseBuild, options: { retry: { maxRetries: 1, waitDurationMs: 5000 }, timeoutSeconds: 3600 },
      async fn(_ctx, input: HouseBuildInput): Promise<{ agent_id: string; competition_id: string; stopped: 'deadline' | null }> {
        const done = (stopped: 'deadline' | null) => ({ agent_id: input.agent_id, competition_id: input.competition.id, stopped });
        const stopAt = Date.parse(input.competition.submission_deadline!) - DEADLINE_MARGIN_MS;
        if (Date.now() >= stopAt) return done('deadline');
        const adapter = deps.houseAgent(input.agent_id);
        if (!adapter || !deps.secret) throw new Error(`house agent ${input.agent_id} is not configured on this workflow`);
        const signal = AbortSignal.timeout(stopAt - Date.now());
        try { await adapter.run(httpAgentContext(input, houseToken(deps.secret, input.agent_id), signal, deps)); }
        catch (e) { if (signal.aborted) return done('deadline'); throw e; }
        return done(signal.aborted ? 'deadline' : null);
      },
    },
  ];
}
