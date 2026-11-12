import Anthropic from '@anthropic-ai/sdk';
import { createApi } from './app.js';
import { kernelRenderer } from './browser.js';
import { claudeEvaluator, claudeHouseAgent, heuristicEvaluator } from './claude.js';
import { HOUSE_AGENTS } from './identity.js';
import { fakeProvider } from './provider/fake.js';
import { paypalProvider } from './provider/paypal.js';
import { workflowsEvaluation, workflowsHouseRunner, type EvaluationRunner, type HouseRunner } from './runners.js';
import { PgStore, Store, type DocStore } from './store.js';

// Configuration (all optional for local dev with the fake provider):
//   PAYMENTS=paypal|fake          real PayPal sandbox or the in-memory fake (default: paypal if keys are set)
//   PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_WEBHOOK_ID
//   ANTHROPIC_API_KEY             enables the AI judge and the house agents (Claude)
//   KERNEL_API_KEY                renders every entry in a KERNEL cloud browser: screenshot-only previews + measured checks
//   WEB_ORIGIN / API_ORIGIN       public URLs of the buyer web app and this API
//   HOUSE_OPERATOR_PAYER_ID       verified sandbox PayPal account that receives house-agent payouts
//   ADMIN_TOKEN                   service credential for refunds/reconcile
//   PAYPAL_TEST_CARD_CHECKOUT=1   sandbox only: pay with PayPal's test card instead of a PayPal login (scripted demos)
//   DATABASE_URL                  Postgres (Neon, pooled) for durable state; DATABASE_URL_UNPOOLED (direct) runs the schema.
//   DATABASE_PATH                 SQLite file when DATABASE_URL is unset (default ./data/api.db; ephemeral on Render free)
//   KEEP_ALIVE_URLS               comma-separated URLs pinged every 9 min (Render free plan sleeps after 15 min idle);
//                                 set to the web app's URL, while the web app pings this API's /health
//   RUNNER=workflows              house-agent builds and evaluations run as Render Workflows task runs
//                                 (apps/api/src/workflows) instead of in this process. Unset: in-process (rollback). Needs:
//     WORKFLOW_SLUG               the workflow service's slug (default provable-race-workflows)
//     WORKFLOWS_SECRET            same value on the workflow service; house-agent and evaluator credentials derive from it
//     RENDER_API_KEY              starts, reads and cancels task runs (or RENDER_USE_LOCAL_DEV=true for `render workflows dev`)
const env = process.env;
const port = Number(env.PORT ?? env.API_PORT ?? 4010);
const host = env.HOST ?? (env.RENDER ? '0.0.0.0' : '127.0.0.1');
const webOrigin = (env.WEB_ORIGIN ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const apiOrigin = (env.API_ORIGIN ?? env.RENDER_EXTERNAL_URL ?? `http://127.0.0.1:${port}`).replace(/\/$/, '');
const clientId = env.PAYPAL_CLIENT_ID ?? env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
const usePayPal = (env.PAYMENTS ?? (clientId && env.PAYPAL_CLIENT_SECRET ? 'paypal' : 'fake')) === 'paypal';

const provider = usePayPal
  ? paypalProvider({ clientId: clientId!, clientSecret: env.PAYPAL_CLIENT_SECRET!, webhookId: env.PAYPAL_WEBHOOK_ID ?? null, testCardCheckout: env.PAYPAL_TEST_CARD_CHECKOUT === '1' })
  : fakeProvider({ webOrigin, autoApprove: true }).provider;
const anthropic = env.ANTHROPIC_API_KEY ? new Anthropic() : null;
const aiLabel = anthropic ? 'claude' : 'off (heuristic judge, no house agents)';
const evaluator = anthropic ? claudeEvaluator(anthropic) : heuristicEvaluator();

let runners: { houseRunner: HouseRunner; evaluationRunner: EvaluationRunner } | null = null;
if (env.RUNNER === 'workflows') {
  // Fail at boot, not on the first brief: without these, every evaluation would wait forever.
  if (!env.WORKFLOWS_SECRET) throw new Error('RUNNER=workflows needs WORKFLOWS_SECRET (same value as on the workflow service)');
  if (!env.RENDER_API_KEY && !env.RENDER_USE_LOCAL_DEV && !env.RENDER_LOCAL_DEV_URL) throw new Error('RUNNER=workflows needs RENDER_API_KEY');
  const { Render } = await import('@renderinc/sdk'); // loaded only in this mode
  const client = new Render().workflows;
  const workflow = env.WORKFLOW_SLUG ?? 'provable-race-workflows';
  const log = (m: string, x?: unknown) => console.log(`[workflows] ${m}`, x ?? '');
  runners = {
    // House agents only with a model key on this API too (the same key must be on the workflow service).
    houseRunner: workflowsHouseRunner({ client, workflow, apiOrigin, log, agentIds: anthropic ? HOUSE_AGENTS.map(h => h.id) : [] }),
    evaluationRunner: workflowsEvaluation({ client, workflow, apiOrigin, version: evaluator.version }),
  };
}
const store: DocStore = env.DATABASE_URL
  ? await PgStore.open(env.DATABASE_URL, env.DATABASE_URL_UNPOOLED, {
      holder: `${env.RENDER_INSTANCE_ID ?? 'local'}:${process.pid}`,
      // A newer instance owns the data now (rolling deploy). Stop at once so this one can't act on stale state.
      onLost: (e) => { console.error(`[store] ${e.message}; exiting so the new instance is the only writer`); setTimeout(() => process.exit(1), 50); },
    })
  : new Store(env.DATABASE_PATH ?? 'data/api.db');

const api = await createApi({
  store, provider, webOrigin, apiOrigin,
  corsOrigins: (env.CORS_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean),
  adminToken: env.ADMIN_TOKEN ?? null,
  houseOperatorPayerId: env.HOUSE_OPERATOR_PAYER_ID ?? env.DEMO_OPERATOR_PAYER_ID ?? null,
  evaluator,
  renderer: env.KERNEL_API_KEY ? kernelRenderer(env.KERNEL_API_KEY) : null,
  houseAgents: anthropic ? Object.fromEntries(HOUSE_AGENTS.map(h => [h.id, claudeHouseAgent(anthropic, h)])) : null,
  strictResponses: env.NODE_ENV !== 'production',
  ...(runners ? { ...runners, workflowsSecret: env.WORKFLOWS_SECRET } : {}),
});

// Deadlines, evaluations and PayPal operations: every 2s while the process is awake.
const timer = setInterval(() => void api.work().catch(e => console.error('[worker]', e)), 2000);
const keepAlive = (env.KEEP_ALIVE_URLS ?? '').split(',').map(u => u.trim()).filter(Boolean);
const pinger = keepAlive.length
  ? setInterval(() => { for (const url of keepAlive) void fetch(url, { signal: AbortSignal.timeout(60_000) }).catch(() => {}); }, 9 * 60_000)
  : null;
pinger?.unref();
api.app.addHook('onClose', async () => { clearInterval(timer); if (pinger) clearInterval(pinger); await store.close(); });
await api.app.listen({ host, port });
console.log(`provable.bid API on ${apiOrigin} (listening ${host}:${port}) · payments: ${provider.mode} · AI: ${aiLabel} · browser: ${env.KERNEL_API_KEY ? 'kernel' : 'off (HTML previews)'} · store: ${env.DATABASE_URL ? 'postgres' : 'sqlite'} · runner: ${runners ? 'render-workflows' : 'in-process'} · web: ${webOrigin}`);
