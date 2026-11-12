import { createServer } from "node:net";
import { createApi } from "../../api/src/app.js";
import { heuristicEvaluator } from "../../api/src/claude.js";
import { fakeProvider } from "../../api/src/provider/fake.js";
import { Store } from "../../api/src/store.js";

/** The real API (contract-validated, SQLite in memory) with the fake PayPal provider, on a free local port. */
export async function startApi(options: { simulatePayouts?: boolean } = {}) {
  const port = await new Promise<number>((resolve) => {
    const probe = createServer().listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => resolve(typeof address === "object" && address ? address.port : 0));
    });
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  const fake = fakeProvider({ webOrigin: "http://127.0.0.1:3000", autoApprove: true });
  const api = await createApi({
    store: new Store(":memory:"), provider: fake.provider, evaluator: heuristicEvaluator(),
    webOrigin: "http://127.0.0.1:3000", apiOrigin: baseUrl, adminToken: "admin_token_for_web_tests",
    houseOperatorPayerId: "HOUSEPAYER0001", simulatePayouts: options.simulatePayouts ?? false,
    strictResponses: true, log: () => {},
  });
  await api.app.listen({ host: "127.0.0.1", port });
  const timer = setInterval(() => void api.work(), 300);
  async function json(method: string, path: string, token: string | null, body?: unknown) {
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (method === "POST") headers["idempotency-key"] = crypto.randomUUID();
    if (body !== undefined) headers["content-type"] = "application/json";
    const r = await fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
    return { status: r.status, headers: r.headers, data: r.headers.get("content-type")?.includes("json") ? await r.json() : await r.text() };
  }
  async function buyer() {
    return (await json("POST", "/v1/buyer-sessions", null)).data.token as string;
  }
  async function operatorAgent(payerId: string, name: string, operatorName = name) {
    const start = await json("GET", "/v1/operators/connect", null);
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const back = await json("GET", `/v1/operators/connect/callback?code=${encodeURIComponent(`fake:${payerId}:${operatorName}`)}&state=${state}`, null);
    const operatorToken = new URLSearchParams(back.headers.get("location")!.split("#")[1]).get("operator_token")!;
    const agent = await json("POST", "/v1/operators/me/agents", operatorToken, { name, description: `${name} builds pages.`, style: "Clean and warm." });
    return agent.data.token as string;
  }
  return {
    baseUrl, api, fake, json, buyer, operatorAgent,
    async close() { clearInterval(timer); await api.idle(); await api.app.close(); },
  };
}

export const bakeryPage = (who: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Crumb &amp; Co. by ${who}</title></head><body><h1>Crumb &amp; Co. bakery (${who})</h1><p>Sourdough, cardamom buns and croissants baked every morning since 1987 by our family.</p><h2>Opening hours</h2><p>Tuesday to Sunday, 7am to 3pm.</p><a href="#">Pre-order now</a></body></html>`;

export const bakeryBrief = (terms: string) => ({
  title: "Landing page for a neighborhood bakery",
  brief: "One page for Crumb & Co.: hero, opening hours, pre-order button, mobile first.",
  bid: { currency: "USD" as const, amount_minor: 2000 },
  submission_window_seconds: 300 as const,
  decision_window_seconds: 3600,
  requirements: [
    { id: "req_hours", description: "Shows opening hours." },
    { id: "req_preorder", description: "Has a pre-order button." },
    { id: "req_mobile", description: "Works on a phone." },
  ],
  accepted_terms_version: terms,
});
