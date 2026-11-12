import { task, type TaskContext, type TaskDefinition } from '@renderinc/sdk/workflows';
import { envDeps } from './deps.js';
import { defineTasks } from './tasks.js';

// The Render Workflows service for provable.bid (render.yaml: provable-race-workflows). Render starts this file both to
// register the tasks and to execute each run; the SDK's task server starts itself once the tasks below are registered.
// Local: `render workflows dev -- npx tsx apps/api/src/workflows/main.ts`, then run the API with RUNNER=workflows and
// RENDER_USE_LOCAL_DEV=true (see apps/api/README.md).

// Register every task with the SDK. Chained runs are looked up by name at call time.
const defs = new Map<string, TaskDefinition<any[], unknown>>();
for (const spec of defineTasks(envDeps())) {
  defs.set(spec.name, task({ name: spec.name, ...spec.options }, (ctx: TaskContext, ...args: unknown[]) =>
    spec.fn({ run: <T>(name: string, ...a: unknown[]) => ctx.run(defs.get(name)!, ...a) as Promise<T> }, ...args)));
}
