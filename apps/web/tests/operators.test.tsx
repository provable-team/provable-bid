import assert from "node:assert/strict";
import { test } from "node:test";
import { act } from "react";
import { JSDOM } from "jsdom";
import { startApi } from "./live-api.js";

test("operator ledger paginates with its own credential and discards stale account responses", { timeout: 30000 }, async (t) => {
  const nativeFetch = globalThis.fetch;
  const live = await startApi();
  const buyer = await live.buyer();
  const start = await live.json("GET", "/v1/operators/connect", null);
  const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
  const back = await live.json("GET", `/v1/operators/connect/callback?code=${encodeURIComponent("fake:PAYEROP00001:Operator")}&state=${state}`, null);
  const operatorToken = new URLSearchParams(back.headers.get("location")!.split("#")[1]).get("operator_token")!;
  const agent = (await live.json("POST", "/v1/operators/me/agents", operatorToken, { name: "Studio One", description: "Builds", style: "Clean" })).data.agent;
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: "http://127.0.0.1:3000/operators" });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [name, value] of Object.entries({
    window: dom.window, self: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window), MutationObserver: dom.window.MutationObserver,
    localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  dom.window.sessionStorage.setItem("provable.connection", JSON.stringify({ baseUrl: live.baseUrl, token: buyer }));
  dom.window.localStorage.setItem(`provable.operator.${live.baseUrl}`, operatorToken);
  const secondBase = "http://127.0.0.1:49999";
  const secondToken = "pbo_second_operator";
  dom.window.localStorage.setItem(`provable.operator.${secondBase}`, secondToken);
  const baseAllocation = { id: "alloc-one", competition_id: "cmp-one", payment_id: "pay-one", kind: "winner", amount: { currency: "USD", amount_minor: 1900 }, ledger_state: "held", payout_state: "blocked", provider_payout_id: null, created_at: "2026-01-01T00:00:00Z", operator_id: "op-one", recipient_id: "recipient-one", agent_shares: [{ agent_id: agent.id, amount_minor: 1900 }] };
  const secondAllocation = { ...baseAllocation, id: "alloc-two", payment_id: "pay-two", ledger_state: "allocated", payout_state: "simulated" };
  const ledgerRequests: { url: URL; authorization: string | null }[] = [];
  let mode: "pages" | "loop" | "hang" | "error" | "empty" | "wait" = "pages";
  let releaseOld: ((value: Response) => void) | undefined;
  let releaseSecond: ((value: Response) => void) | undefined;
  let secondWait = false;
  let releaseHung: ((value: Response) => void) | undefined;
  let releaseRotation: ((value: Response) => void) | undefined;
  const jsonResponse = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  const page = (items: unknown[], next_cursor: string | null) => ({ items, next_cursor, server_time: "2026-01-01T00:00:00Z" });
  globalThis.fetch = async (input, init) => {
    const req = new Request(input instanceof Request ? input.clone() : input, init);
    const url = new URL(req.url);
    if (url.pathname === "/v1/operators/me/allocations") {
      ledgerRequests.push({ url, authorization: req.headers.get("Authorization") });
      if (url.origin === secondBase) return secondWait ? new Promise<Response>((resolve) => { releaseSecond = resolve; }) : jsonResponse(page([{ ...secondAllocation, payout_state: "paid" }], null));
      if (mode === "wait") return new Promise<Response>((resolve) => { releaseOld = resolve; });
      if (mode === "hang") return url.searchParams.has("cursor") ? new Promise<Response>((resolve) => { releaseHung = resolve; }) : jsonResponse(page([baseAllocation], "hung-next"));
      if (mode === "loop") return jsonResponse(page([baseAllocation], "repeat"));
      if (mode === "error") return jsonResponse({ detail: "Ledger unavailable" }, 503);
      if (mode === "empty") return jsonResponse(page([], null));
      return jsonResponse(url.searchParams.has("cursor") ? page([baseAllocation, secondAllocation], null) : page([baseAllocation], "next-page"));
    }
    if (url.origin === live.baseUrl && url.pathname.endsWith("/credential") && req.method === "POST") return new Promise<Response>((resolve) => { releaseRotation = resolve; });
    if (url.origin === secondBase && url.pathname === "/v1/operators/me") return jsonResponse({ id: "op-two", name: "Second operator", paypal_account_verified: true, agents: [], server_time: "2026-01-01T00:00:00Z" });
    if (url.origin === secondBase && url.pathname === "/v1/config") {
      const config = await (await nativeFetch(`${live.baseUrl}/v1/config`)).json();
      config.mode = "paypal_live"; config.capabilities.payouts = "paypal_live";
      return jsonResponse(config);
    }
    return nativeFetch(input, init);
  };
  const [{ createRoot }, { ApiProvider, useApi }, { default: OperatorsPage }] = await Promise.all([
    import("react-dom/client"), import("../src/components/api-provider.js"), import("../src/app/operators/page.js"),
  ]);
  function SwitchAccount() {
    const { updateSettings } = useApi();
    return <button onClick={() => updateSettings({ baseUrl: secondBase, token: buyer })}>Switch API</button>;
  }
  const container = dom.window.document.getElementById("app")!;
  const root = createRoot(container);
  t.after(async () => {
    await act(async () => root.unmount());
    globalThis.fetch = nativeFetch;
    await live.close();
    for (const [name, descriptor] of saved) descriptor ? Object.defineProperty(globalThis, name, descriptor) : Reflect.deleteProperty(globalThis, name);
    dom.window.close();
  });
  async function eventually(check: () => boolean, label: string) {
    const end = Date.now() + 6000;
    while (!check()) {
      if (Date.now() > end) assert.fail(`${label}\n${container.textContent}`);
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    }
  }
  const button = (name: string) => [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(name));
  async function click(name: string) { const target = button(name); assert.ok(target, `${name} exists`); await act(async () => target.click()); }
  await act(async () => root.render(<ApiProvider requestTimeoutMs={600}><SwitchAccount /><OperatorsPage /></ApiProvider>));
  await eventually(() => Boolean(container.textContent?.includes("pay-two")), "all pages are displayed");
  assert.equal(ledgerRequests.length, 2);
  assert.equal(ledgerRequests[1].url.searchParams.get("cursor"), "next-page");
  assert.ok(ledgerRequests.every((request) => request.authorization === `Bearer ${operatorToken}`));
  assert.equal(container.querySelectorAll("[row-id]").length, 2, "duplicate allocation IDs are deduplicated");
  assert.match(container.textContent!, /Studio One/);
  assert.match(container.textContent!, /held/);
  assert.match(container.textContent!, /blocked/);
  assert.match(container.textContent!, /simulated/);
  assert.match(container.textContent!, /Mock payouts use no real money/);
  assert.doesNotMatch(container.textContent!, /\$19\.00 paid/);
  mode = "hang";
  await click("Refresh");
  await eventually(() => Boolean(releaseHung), "second page request begins");
  await eventually(() => Boolean(container.textContent?.includes("Loading allocations timed out")), "a hung page times out");
  assert.equal(button("Refresh")?.disabled, false, "refresh is enabled after a timeout");
  mode = "empty";
  await click("Try again");
  await eventually(() => Boolean(container.textContent?.includes("No allocations yet")), "retry after a timeout succeeds");
  await act(async () => releaseHung!(jsonResponse(page([baseAllocation], null))));
  assert.ok(!container.textContent?.includes("pay-one"), "late timed-out results cannot replace the retry");
  mode = "loop";
  await click("Refresh");
  await eventually(() => Boolean(container.textContent?.includes("Allocation pagination repeated a cursor")), "repeated cursors do not loop indefinitely");
  mode = "error";
  await click("Refresh");
  await eventually(() => Boolean(container.textContent?.includes("Ledger unavailable")), "ledger error is visible");
  mode = "empty";
  await click("Try again");
  await eventually(() => Boolean(container.textContent?.includes("No allocations yet")), "retry shows the empty state");
  mode = "wait";
  await click("Refresh");
  await eventually(() => Boolean(releaseOld) && Boolean(container.textContent?.includes("Loading allocations")), "refresh loads asynchronously");
  await click("New token");
  await eventually(() => Boolean(releaseRotation), "credential rotation remains pending");
  assert.equal(button("New token")?.disabled, true);
  await click("Switch API");
  await eventually(() => Boolean(container.textContent?.includes("Second operator")) && Boolean(container.textContent?.includes("PayPal live payouts transfer real money")), "new live account loads");
  await eventually(() => Boolean(container.textContent?.includes("pay-two")), "live payout row loads");
  assert.match(container.textContent!, /Live PayPal account connected/);
  assert.match(container.textContent!, /Paid/);
  assert.doesNotMatch(container.textContent!, /Paid \(test\)/);
  assert.equal(button("Register agent")?.disabled, false, "new account actions are not blocked by the old request");
  await act(async () => releaseRotation!(jsonResponse({ agent, token: "pba_old_credential", webhook_secret: null })));
  assert.ok(!container.textContent?.includes("pba_old_credential"), "late credentials stay with the original account");
  await act(async () => releaseOld!(jsonResponse(page([baseAllocation], "old-next"))));
  assert.ok(!container.textContent?.includes("pay-one"), "old account data cannot reappear after switching");
  assert.ok(ledgerRequests.filter((request) => request.url.origin === secondBase).every((request) => request.authorization === `Bearer ${secondToken}`));
  assert.equal(ledgerRequests.filter((request) => request.url.searchParams.get("cursor") === "old-next").length, 0);
  secondWait = true;
  await click("Refresh");
  await eventually(() => Boolean(releaseSecond), "new account refresh is pending");
  await click("Sign out");
  await act(async () => releaseSecond!(jsonResponse(page([secondAllocation], null))));
  assert.ok(!container.textContent?.includes("pay-two"), "late response cannot restore data after sign out");
  assert.ok(container.textContent?.includes("Connect with PayPal"));
});
