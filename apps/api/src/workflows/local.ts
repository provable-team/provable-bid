import type { RunDetails, WorkflowsClient } from '../runners.js';
import type { TaskSpec } from './tasks.js';

/** One task run as the fake records it (mirrors the fields of the SDK's TaskRunDetails that matter here). */
export type LocalRun = {
  id: string; task: string; parent: string | null; status: 'running' | 'succeeded' | 'failed' | 'canceled';
  attempts: number; error?: string; results: unknown[] | null; input: unknown[];
};

/**
 * An in-process stand-in for Render Workflows, faithful to the behaviour the API relies on: arguments and results
 * cross a JSON boundary (no Buffers, Dates or functions survive), arguments are capped at 4 MB, each task retries per
 * its own `retry` options with exponential backoff, chained runs (`ctx.run`) are runs of their own, an idempotency key
 * returns the original run instead of starting another, and runs can be read (`getTaskRun`) and canceled
 * (`cancelTaskRun`; on Render that stops the instance, here the run is reported canceled and its result is dropped).
 * For the real thing locally, use `render workflows dev`.
 */
export function localWorkflows(specs: TaskSpec[], opts: { workflow?: string; timeScale?: number } = {}) {
  const workflow = opts.workflow ?? 'local';
  const byName = new Map(specs.map(s => [s.name, s]));
  const runs: LocalRun[] = [];
  const handles = new Map<string, { run: LocalRun; done: Promise<LocalRun>; cancel: () => void }>();
  const byKey = new Map<string, string>();
  let seq = 0;
  const wire = <T>(v: T): T => (v === undefined ? null : JSON.parse(JSON.stringify(v))) as T;
  const details = (r: LocalRun): RunDetails =>
    ({ id: r.id, status: r.status, results: wire(r.results), ...(r.error && r.status === 'failed' ? { error: r.error } : {}) });

  function start(taskName: string, input: unknown[], parent: string | null) {
    const spec = byName.get(taskName);
    if (!spec) throw new Error(`Task not found: ${taskName}`);
    const size = Buffer.byteLength(JSON.stringify(input));
    if (size > 4 * 1024 * 1024) throw new Error(`arguments are ${size} bytes; Render's limit is 4 MB`);
    const run: LocalRun = { id: `trn-local${++seq}`, task: taskName, parent, status: 'running', attempts: 0, results: null, input: wire(input) };
    runs.push(run);
    let cancel!: () => void;
    const canceled = new Promise<LocalRun>(resolve => { cancel = () => { if (run.status === 'running') { run.status = 'canceled'; resolve(run); } }; });
    const work = (async () => {
      const retry = spec.options.retry ?? { maxRetries: 3, waitDurationMs: 1000, backoffScaling: 2 }; // Render's defaults
      let wait = retry.waitDurationMs;
      for (;;) {
        run.attempts++;
        try {
          const ctx = { run: async <T>(name: string, ...args: unknown[]) => {
            const child = await start(name, args, run.id).done;
            if (child.status !== 'succeeded') throw new Error(child.error ?? `chained run ${child.status}`);
            return child.results![0] as T;
          } };
          const result = await spec.fn(ctx, ...wire(input));
          if (run.status === 'running') { run.results = [wire(result)]; run.status = 'succeeded'; }
          return run;
        } catch (e) {
          if (run.status !== 'running') return run;
          run.error = (e as Error).message;
          if (run.attempts > retry.maxRetries) { run.status = 'failed'; return run; }
          await new Promise(r => setTimeout(r, wait * (opts.timeScale ?? 1)));
          wait *= retry.backoffScaling ?? 2;
        }
      }
    })();
    const handle = { run, done: Promise.race([work, canceled]), cancel };
    handles.set(run.id, handle);
    return handle;
  }

  const client: WorkflowsClient = {
    async startTask(slug, input, options) {
      const [wf, taskName] = slug.split('/');
      if (wf !== workflow) throw new Error(`Workflow not found: ${wf}`);
      const key = options?.idempotencyKey;
      const existing = key ? byKey.get(key) : undefined;
      const handle = existing ? handles.get(existing)! : start(taskName, input, null);
      if (key) byKey.set(key, handle.run.id);
      return { taskRunId: handle.run.id, get: async () => details(await handle.done) };
    },
    async getTaskRun(id) {
      const h = handles.get(id);
      if (!h) throw new Error(`task run ${id} not found`);
      return details(h.run);
    },
    async cancelTaskRun(id) {
      const h = handles.get(id);
      if (!h) throw new Error(`task run ${id} not found`);
      h.cancel();
      for (const child of runs) if (child.parent === id) handles.get(child.id)!.cancel(); // and its chained runs
    },
  };
  return { client, runs, workflow };
}
