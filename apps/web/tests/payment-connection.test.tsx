import assert from "node:assert/strict";
import { test } from "node:test";
import { act } from "react";
import { JSDOM } from "jsdom";

test("payment notice and stats follow the selected API and fail closed during changes and errors", async (t) => {
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: "http://127.0.0.1:3000/" });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const sandbox = "http://sandbox.test";
  const live = "http://live.test";
  const bad = "http://bad.test";
  const calls: string[] = [];
  let releaseLive: ((response: Response) => void) | undefined;
  const config = (mode: "paypal_sandbox" | "paypal_live") => ({
    mode, currency: "USD", terms_version: "race-v1",
    policy: { terms_version: "race-v1", commission_bps: 500, processing_fee_bps: 349, processing_fee_fixed_minor: 49, payout_fee_minor: 25, qualification_grace_seconds: 120 },
    capabilities: { authorization: true, additional_checkout: true, external_agents: true, payouts: mode, ai_evaluation: false, house_agents: false, operator_onboarding: "paypal_login", browser_previews: false, operator_assistant: false, studio_ai: false },
    server_time: "2026-11-12T20:00:00.000Z",
  });
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
  const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input instanceof Request ? input.clone() : input, init);
    const url = new URL(request.url); calls.push(request.url);
    if (url.pathname === "/v1/config") {
      if (url.origin === sandbox) return json(config("paypal_sandbox"));
      if (url.origin === live) return new Promise<Response>((resolve) => { releaseLive = resolve; });
      return json({ message: "unavailable" }, 503);
    }
    if (url.pathname === "/stats.json") return json({ mode: url.origin === sandbox ? "paypal_sandbox" : "paypal_live", generated_at: "2026-11-12T20:00:00Z", briefs_opened: url.origin === sandbox ? 7 : 2 });
    throw new Error(`unexpected request ${request.url}`);
  };
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true, fetch: fakeFetch })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  dom.window.sessionStorage.setItem("provable.connection", JSON.stringify({ baseUrl: sandbox, token: "buyer" }));
  const [{ createRoot }, { ApiProvider, useApi }, { PaymentEnvironmentNotice }, { ConnectedLiveStats }] = await Promise.all([
    import("react-dom/client"), import("../src/components/api-provider.js"), import("../src/components/payment-environment-notice.js"), import("../src/components/live-stats.js"),
  ]);
  function Switcher() {
    const { updateSettings, error } = useApi();
    return <>{error && <span>config-error</span>}<button onClick={() => updateSettings({ baseUrl: live, token: "buyer" })}>Live</button><button onClick={() => updateSettings({ baseUrl: bad, token: "buyer" })}>Error</button></>;
  }
  const container = dom.window.document.getElementById("app")!;
  const root = createRoot(container);
  t.after(async () => {
    await act(async () => root.unmount());
    for (const [key, descriptor] of saved) descriptor ? Object.defineProperty(globalThis, key, descriptor) : Reflect.deleteProperty(globalThis, key);
    dom.window.close();
  });
  async function until(condition: () => boolean) {
    const deadline = Date.now() + 5000;
    while (!condition()) {
      if (Date.now() > deadline) assert.fail(`timed out: ${container.textContent}`);
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    }
  }
  async function click(label: string) {
    const button = [...container.querySelectorAll("button")].find((b) => b.textContent === label);
    assert.ok(button); await act(async () => button.click());
  }
  await act(async () => root.render(<ApiProvider><Switcher /><PaymentEnvironmentNotice /><ConnectedLiveStats /></ApiProvider>));
  await until(() => Boolean(container.textContent?.includes("PayPal sandbox uses test accounts") && container.textContent?.includes("briefs opened")));
  assert.ok(calls.includes(`${sandbox}/stats.json`));
  await click("Live");
  await until(() => Boolean(releaseLive));
  assert.match(container.textContent!, /Payment environment is currently unavailable/);
  assert.doesNotMatch(container.textContent!, /no real charges|test money|briefs opened/);
  await act(async () => releaseLive!(json(config("paypal_live"))));
  await until(() => Boolean(container.textContent?.includes("PayPal live uses real money") && container.textContent?.includes("briefs opened")));
  assert.match(container.textContent!, /PayPal live · real money/);
  assert.ok(calls.includes(`${live}/stats.json`));
  await click("Error");
  await until(() => Boolean(container.textContent?.includes("config-error") && container.textContent?.includes("Payment environment is currently unavailable")));
  assert.doesNotMatch(container.textContent!, /test money|no real charges|briefs opened|real payments/);
});
