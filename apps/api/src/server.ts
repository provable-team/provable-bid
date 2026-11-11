import Anthropic from '@anthropic-ai/sdk';
import { createApi } from './app.js';
import { claudeEvaluator, claudeHouseAgent, heuristicEvaluator } from './claude.js';
import { HOUSE_AGENTS } from './identity.js';
import { fakeProvider } from './provider/fake.js';
import { paypalProvider } from './provider/paypal.js';
import { Store } from './store.js';

// Configuration (all optional for local dev with the fake provider):
//   PAYMENTS=paypal|fake          real PayPal sandbox or the in-memory fake (default: paypal if keys are set)
//   PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_WEBHOOK_ID
//   ANTHROPIC_API_KEY             enables the AI judge and the house agents
//   WEB_ORIGIN / API_ORIGIN       public URLs of the buyer web app and this API
//   HOUSE_OPERATOR_PAYER_ID       verified sandbox PayPal account that receives house-agent payouts
//   ADMIN_TOKEN                   service credential for refunds/reconcile
//   PAYPAL_TEST_CARD_CHECKOUT=1   sandbox only: pay with PayPal's test card instead of a PayPal login (scripted demos)
//   DATABASE_PATH                 SQLite file (default ./data/api.db)
const env = process.env;
const port = Number(env.PORT ?? env.API_PORT ?? 4010);
const host = env.HOST ?? (env.RENDER ? '0.0.0.0' : '127.0.0.1');
const webOrigin = (env.WEB_ORIGIN ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const apiOrigin = (env.API_ORIGIN ?? env.RENDER_EXTERNAL_URL ?? `http://127.0.0.1:${port}`).replace(/\/$/, '');
const clientId = env.PAYPAL_CLIENT_ID ?? env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
const usePayPal = (env.PAYMENTS ?? (clientId && env.PAYPAL_CLIENT_SECRET ? 'paypal' : 'fake')) === 'paypal';

const provider = usePayPal
  ? paypalProvider({ clientId: clientId!, clientSecret: env.PAYPAL_CLIENT_SECRET!, webhookId: env.PAYPAL_WEBHOOK_ID ?? null, testCardCheckout: env.PAYPAL_TEST_CARD_CHECKOUT === '1' })
  : fakeProvider({ webOrigin, autoApprove: false }).provider;
const anthropic = env.ANTHROPIC_API_KEY ? new Anthropic() : null;
const store = new Store(env.DATABASE_PATH ?? 'data/api.db');

const api = await createApi({
  store, provider, webOrigin, apiOrigin,
  corsOrigins: (env.CORS_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean),
  adminToken: env.ADMIN_TOKEN ?? null,
  houseOperatorPayerId: env.HOUSE_OPERATOR_PAYER_ID ?? env.DEMO_OPERATOR_PAYER_ID ?? null,
  evaluator: anthropic ? claudeEvaluator(anthropic) : heuristicEvaluator(),
  houseAgents: anthropic ? Object.fromEntries(HOUSE_AGENTS.map(h => [h.id, claudeHouseAgent(anthropic, h)])) : null,
  strictResponses: env.NODE_ENV !== 'production',
});

// Deadlines, evaluations and PayPal operations: every 2s while the process is awake.
const timer = setInterval(() => void api.work().catch(e => console.error('[worker]', e)), 2000);
api.app.addHook('onClose', async () => { clearInterval(timer); store.close(); });
await api.app.listen({ host, port });
console.log(`provable.bid API on ${apiOrigin} (listening ${host}:${port}) · payments: ${provider.mode} · AI: ${anthropic ? 'claude' : 'off (heuristic judge, no house agents)'} · web: ${webOrigin}`);
