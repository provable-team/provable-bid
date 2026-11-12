import { createHmac } from 'node:crypto';
import type { AgentAdapter, AgentContext, EvaluatorAdapter } from '../../../packages/agent-interface/src/index.js';
import type { components } from '../../../packages/api-client/src/schema.js';
import type { PageRenderer, RenderResult } from './browser.js';
import { gateHtml } from './html.js';

type S = components['schemas'];

/**
 * Where the slow, model-heavy work runs: the house agents' builds and each submission's evaluation (gates, KERNEL
 * render, Claude judge). The default runs in the API process, exactly as before. `RUNNER=workflows` sends the same work
 * to Render Workflows tasks (see workflows/tasks.ts) so it runs on its own instances, with retries and a run history in
 * Render's dashboard, and keeps going while the API redeploys.
 */

// ---------------------------------------------------------------- evaluation

/** Everything an evaluation needs, as plain JSON (it may cross a process boundary). */
export type EvaluationJob = {
  submission_id: string;
  title: string;
  brief: string;
  requirements: S['Requirement'][];
  artifact: S['Artifact'];
  /** The private original (base64). Supplied to the trusted evaluator only. */
  original_base64: string;
  /** The watermarked preview markup, which is what the browser renders. */
  preview_html: string;
};
/** A real-browser render as plain JSON: JPEGs in base64. */
export type RenderedPage = {
  renderer: string;
  desktop_base64: string; phone_base64: string; desktopHeight: number; phoneHeight: number;
  phoneOverflowPx: number; consoleErrors: string[]; blockedRequests: string[]; focus?: RenderResult['focus'];
};
/** The qualification result without artifact_hashes: the API binds those to its own digests, never the runner's. */
export type Verdict = Omit<S['QualificationResult'], 'artifact_hashes'>;
export type EvaluationOutcome = { rendered: RenderedPage | null; result: Verdict };

export interface EvaluationRunner {
  readonly name: string;
  /** The evaluator's version label, used when the runner itself could not finish. */
  readonly version: string;
  /** Never rejects for an evaluator failure (that is an 'error' result); rejects only if the runner itself failed. */
  evaluate(job: EvaluationJob, hooks?: { onRendered?: (page: RenderedPage) => Promise<void> }): Promise<EvaluationOutcome>;
}

export const toRendered = (renderer: string, r: RenderResult): RenderedPage => ({
  renderer, desktop_base64: r.desktop.toString('base64'), phone_base64: r.phone.toString('base64'), desktopHeight: r.desktopHeight, phoneHeight: r.phoneHeight,
  phoneOverflowPx: r.phoneOverflowPx, consoleErrors: r.consoleErrors, blockedRequests: r.blockedRequests, ...(r.focus ? { focus: r.focus } : {}),
});

/** Gates, then (with a renderer) a real-browser render, else null. Never throws for a render failure. */
export async function renderEntry(job: EvaluationJob, renderer: PageRenderer | null, log: (m: string, x?: unknown) => void): Promise<RenderedPage | null> {
  if (!renderer) return null;
  // The watermarked preview: same layout as the original (the watermark is a fixed overlay).
  try { return toRendered(renderer.name, await renderer.render(job.preview_html, AbortSignal.timeout(75_000))); }
  catch (e) { log(`browser render failed on ${job.submission_id}`, (e as Error).message); return null; }
}

/** The judge's verdict. Throws when the evaluator could not finish (the caller turns that into an 'error' result). */
export async function judgeEntry(job: EvaluationJob, rendered: RenderedPage | null, evaluator: EvaluatorAdapter): Promise<Verdict> {
  const { artifact_hashes: _ignored, ...verdict } = await evaluator.qualify({
    title: job.title, brief: job.brief, requirements: job.requirements, signal: AbortSignal.timeout(90_000),
    artifacts: [{ metadata: job.artifact, bytes: new Uint8Array(Buffer.from(job.original_base64, 'base64')) }],
    ...(rendered ? {
      screenshots: { desktop: new Uint8Array(Buffer.from(rendered.desktop_base64, 'base64')), phone: new Uint8Array(Buffer.from(rendered.phone_base64, 'base64')) },
      browser: { phoneOverflowPx: rendered.phoneOverflowPx, consoleErrors: rendered.consoleErrors, blockedRequests: rendered.blockedRequests, focus: rendered.focus },
    } : {}),
  });
  return verdict;
}

export const gateVerdict = (job: EvaluationJob): Verdict | null => {
  const gate = gateHtml(Buffer.from(job.original_base64, 'base64').toString('utf8'));
  return gate ? { status: 'failed', failure_code: gate.code, checks: [], reason: gate.reason, evaluator_version: 'gates-v1' } : null;
};
export const errorVerdict = (version: string): Verdict =>
  ({ status: 'error', failure_code: null, checks: [], reason: 'The evaluator could not finish.', evaluator_version: version });

/** The evaluation as it always ran: in this process, renderer and judge called directly. */
export function inProcessEvaluation(o: { renderer: PageRenderer | null; evaluator: EvaluatorAdapter; log: (m: string, x?: unknown) => void }): EvaluationRunner {
  return {
    name: 'in-process',
    version: o.evaluator.version,
    async evaluate(job, hooks) {
      const gated = gateVerdict(job);
      if (gated) return { rendered: null, result: gated };
      const rendered = await renderEntry(job, o.renderer, o.log);
      if (rendered) await hooks?.onRendered?.(rendered); // buyers' screenshots are stored before the judge runs
      try { return { rendered, result: await judgeEntry(job, rendered, o.evaluator) }; }
      catch (e) { o.log(`evaluator failed on ${job.submission_id}`, (e as Error).message); return { rendered, result: errorVerdict(o.evaluator.version) }; }
    },
  };
}

// ---------------------------------------------------------------- house agents

export interface HouseRunner {
  readonly name: string;
  /** True when the build runs outside this process and reaches the API over HTTP (submissions, progress). */
  readonly remote: boolean;
  has(agentId: string): boolean;
  /** Resolves when the agent's run (all its attempts) is over. `ctx` is the in-process context; a remote runner uses only its competition and signal. */
  run(agentId: string, ctx: AgentContext): Promise<void>;
}

export function inProcessHouseRunner(adapters: Record<string, AgentAdapter> | null | undefined): HouseRunner {
  return {
    name: 'in-process', remote: false,
    has: id => !!adapters?.[id],
    run: (id, ctx) => adapters![id].run(ctx),
  };
}

/**
 * A house agent's bearer token derived from a secret both the API and the workflow service hold, so a build running
 * on another instance can authenticate without the token ever appearing in task arguments (which Render retains and
 * shows in the dashboard), and keeps working across API restarts.
 */
export const houseToken = (secret: string, agentId: string) =>
  `pba_${createHmac('sha256', secret).update(`house-agent:${agentId}`).digest('base64url')}`;

// ---------------------------------------------------------------- Render Workflows

/** The subset of `new Render().workflows` (@renderinc/sdk) this API uses; the local fake implements the same shape. */
export interface WorkflowsClient {
  startTask(slug: string, input: unknown[], options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<{
    taskRunId: string;
    get(): Promise<{ id: string; status: string; results?: unknown[] | null; error?: string }>;
  }>;
}
export const TASKS = { evaluate: 'evaluateSubmission', render: 'renderEntry', judge: 'judgeEntry', houseBuild: 'houseAgentBuild' } as const;
export type HouseBuildInput = { agent_id: string; competition: S['Competition']; api_origin: string };

async function runToResult<T>(client: WorkflowsClient, slug: string, input: unknown[], idempotencyKey: string, signal?: AbortSignal): Promise<T> {
  const started = await client.startTask(slug, input, { idempotencyKey, ...(signal ? { signal } : {}) });
  const run = await started.get();
  if (run.status !== 'completed') throw new Error(`task run ${run.id} ${run.status}${run.error ? `: ${run.error}` : ''}`);
  return run.results?.[0] as T;
}

/**
 * Evaluation as a Render Workflows task run. The idempotency key is the submission ID, so after an API restart the
 * worker's retry re-attaches to the run already in flight (or finished) instead of rendering and judging twice.
 */
export function workflowsEvaluation(o: { client: WorkflowsClient; workflow: string; version: string }): EvaluationRunner {
  return {
    name: 'render-workflows', version: o.version,
    evaluate: job => runToResult<EvaluationOutcome>(o.client, `${o.workflow}/${TASKS.evaluate}`, [job], `evaluate:${job.submission_id}`),
  };
}

/** House-agent builds as Render Workflows task runs, one per agent per competition. */
export function workflowsHouseRunner(o: { client: WorkflowsClient; workflow: string; agentIds: string[]; apiOrigin: string }): HouseRunner {
  return {
    name: 'render-workflows', remote: true,
    has: id => o.agentIds.includes(id),
    async run(agentId, ctx) {
      const input: HouseBuildInput = { agent_id: agentId, competition: ctx.competition, api_origin: o.apiOrigin };
      await runToResult(o.client, `${o.workflow}/${TASKS.houseBuild}`, [input], `house:${ctx.competition.id}:${agentId}`, ctx.signal);
    },
  };
}
