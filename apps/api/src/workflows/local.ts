import type { WorkflowsClient } from '../runners.js';
import type { TaskSpec } from './tasks.js';

/** One task run as the fake records it (mirrors the fields of the SDK's TaskRunDetails that matter here). */
export type LocalRun = { id: string; task: string; parent: string | null; status: 'running' | 'completed' | 'failed'; attempts: number; error?: string; results: unknown[] | null; input: unknown[] };

/**
 * An in-process stand-in for Render Workflows, faithful to the behaviour the API relies on: arguments and results
 * cross a JSON boundary (no Buffers, Dates or functions survive), arguments are capped at 4 MB, each task retries per
 * its own `retry` options with exponential backoff, chained runs (`ctx.run`) are runs of their own, and an idempotency
 * key returns the original run instead of starting another. For the real thing locally, use `render workflows dev`.
 */
export function localWorkflows(specs: TaskSpec[], opts: { workflow?: string; timeScale?: number } = {}) {
  const workflow = opts.workflow ?? 'local';
  const byName = new Map(specs.map(s => [s.name, s]));
  const runs: LocalRun[] = [];
  const byKey = new Map<string, { run: LocalRun; done: Promise<LocalRun> }>();
  let seq = 0;
  const wire = <T>(v: T): T => (v === undefined ? null : JSON.parse(JSON.stringify(v))) as T;

  function start(taskName: string, input: unknown[], parent: string | null): { run: LocalRun; done: Promise<LocalRun> } {
    const spec = byName.get(taskName);
    if (!spec) throw new Error(`Task not found: ${taskName}`);
    const size = Buffer.byteLength(JSON.stringify(input));
    if (size > 4 * 1024 * 1024) throw new Error(`arguments are ${size} bytes; Render's limit is 4 MB`);
    const run: LocalRun = { id: `trn-local${++seq}`, task: taskName, parent, status: 'running', attempts: 0, results: null, input: wire(input) };
    runs.push(run);
    const done = (async () => {
      const retry = spec.options.retry ?? { maxRetries: 3, waitDurationMs: 1000, backoffScaling: 2 }; // Render's defaults
      let wait = retry.waitDurationMs;
      for (;;) {
        run.attempts++;
        try {
          const ctx = { run: async <T>(name: string, ...args: unknown[]) => {
            const child = await start(name, args, run.id).done;
            if (child.status !== 'completed') throw new Error(child.error ?? 'chained run failed');
            return child.results![0] as T;
          } };
          const result = await spec.fn(ctx, ...wire(input));
          run.results = [wire(result)]; run.status = 'completed'; return run;
        } catch (e) {
          run.error = (e as Error).message;
          if (run.attempts > retry.maxRetries) { run.status = 'failed'; return run; }
          await new Promise(r => setTimeout(r, wait * (opts.timeScale ?? 1)));
          wait *= retry.backoffScaling ?? 2;
        }
      }
    })();
    return { run, done };
  }

  const client: WorkflowsClient = {
    async startTask(slug, input, options) {
      const [wf, taskName] = slug.split('/');
      if (wf !== workflow) throw new Error(`Workflow not found: ${wf}`);
      const key = options?.idempotencyKey;
      const started = (key && byKey.get(key)) || start(taskName, input, null);
      if (key) byKey.set(key, started);
      return { taskRunId: started.run.id, get: async () => {
        const r = await started.done;
        return { id: r.id, status: r.status, results: wire(r.results), ...(r.error && r.status === 'failed' ? { error: r.error } : {}) };
      } };
    },
  };
  return { client, runs, workflow };
}
