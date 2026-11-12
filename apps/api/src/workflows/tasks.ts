import type { AgentAdapter, AgentContext, EvaluatorAdapter } from '../../../../packages/agent-interface/src/index.js';
import type { components } from '../../../../packages/api-client/src/schema.js';
import type { PageRenderer } from '../browser.js';
import {
  errorVerdict, gateVerdict, houseToken, judgeEntry, renderEntry, TASKS,
  type EvaluationJob, type EvaluationOutcome, type HouseBuildInput, type RenderedPage, type Verdict,
} from '../runners.js';

type S = components['schemas'];

/**
 * The Render Workflows tasks, as plain functions so the same code runs on Render (registered with the SDK's `task()`
 * in main.ts), under `render workflows dev`, and in the in-process fake used by the tests (local.ts).
 *
 *   evaluateSubmission(job)   gates → renderEntry (KERNEL) → judgeEntry (Claude); each step its own run with retries
 *   houseAgentBuild(input)    one house agent's whole build for one competition (all attempts), through the public API
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
  /** Shared with the API: house-agent tokens are derived from it (runners.ts houseToken). */
  houseSecret: string | null;
  fetch?: typeof fetch;
  log?: (m: string, x?: unknown) => void;
  /** Poll interval while a house agent waits for its own check (default 2000 ms). */
  pollMs?: number;
};

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
    try { while (queued) { const body = queued; queued = null; await call('POST', '/internal/house-progress', body).catch(() => {}); } }
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

export function defineTasks(deps: TaskDeps): TaskSpec[] {
  const log = deps.log ?? ((m: string, x?: unknown) => console.log(`[workflows] ${m}`, x ?? ''));
  return [
    {
      // A KERNEL browser session is cheap to retry; a flaky one should not cost the entry its screenshots.
      name: TASKS.render, options: { retry: { maxRetries: 2, waitDurationMs: 2000, backoffScaling: 2 }, timeoutSeconds: 180 },
      async fn(_ctx, job: EvaluationJob): Promise<RenderedPage | null> {
        return deps.renderer ? toRenderedOrThrow(job, deps.renderer) : null;
      },
    },
    {
      // The judge: retried on overload or timeouts; a refusal or malformed verdict fails the same way every time.
      name: TASKS.judge, options: { retry: { maxRetries: 2, waitDurationMs: 5000, backoffScaling: 2 }, timeoutSeconds: 240 },
      fn: (_ctx, job: EvaluationJob, rendered: RenderedPage | null): Promise<Verdict> => judgeEntry(job, rendered, deps.evaluator),
    },
    {
      // The orchestrator never retries itself: its steps do. Same semantics as in-process: a failed render means no
      // screenshots (the judge still runs), a failed judge means an 'error' result.
      name: TASKS.evaluate, options: { retry: { maxRetries: 0, waitDurationMs: 1000 }, timeoutSeconds: 900 },
      async fn(ctx, job: EvaluationJob): Promise<EvaluationOutcome> {
        const gated = gateVerdict(job);
        if (gated) return { rendered: null, result: gated };
        let rendered: RenderedPage | null = null;
        try { rendered = await ctx.run<RenderedPage | null>(TASKS.render, job); }
        catch (e) { log(`browser render failed on ${job.submission_id}`, (e as Error).message); }
        try { return { rendered, result: await ctx.run<Verdict>(TASKS.judge, job, rendered) }; }
        catch (e) { log(`evaluator failed on ${job.submission_id}`, (e as Error).message); return { rendered, result: errorVerdict(deps.evaluator.version) }; }
      },
    },
    {
      // One retry: a build that died before submitting (model overload, instance loss) starts over. After a
      // submission the API's attempt rules decide, so a retry can never add an entry the rules don't allow.
      name: TASKS.houseBuild, options: { retry: { maxRetries: 1, waitDurationMs: 5000 }, timeoutSeconds: 3600 },
      async fn(_ctx, input: HouseBuildInput): Promise<{ agent_id: string; competition_id: string }> {
        const adapter = deps.houseAgent(input.agent_id);
        if (!adapter || !deps.houseSecret) throw new Error(`house agent ${input.agent_id} is not configured on this workflow`);
        const deadline = Date.parse(input.competition.submission_deadline!);
        const signal = AbortSignal.timeout(Math.max(1000, deadline - Date.now() - 5000));
        await adapter.run(httpAgentContext(input, houseToken(deps.houseSecret, input.agent_id), signal, deps));
        return { agent_id: input.agent_id, competition_id: input.competition.id };
      },
    },
  ];
}

/** Inside the render task a failure should throw (so Render retries it); renderEntry swallows errors for in-process use. */
async function toRenderedOrThrow(job: EvaluationJob, renderer: PageRenderer): Promise<RenderedPage> {
  let failure: unknown = null;
  const page = await renderEntry(job, renderer, (_m, x) => { failure = x; });
  if (!page) throw new Error(`render failed: ${String(failure)}`);
  return page;
}
