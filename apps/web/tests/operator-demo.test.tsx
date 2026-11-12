import assert from "node:assert/strict";
import { test } from "node:test";
import { act } from "react";
import { JSDOM } from "jsdom";
import { SAMPLE_ALLOCATIONS, SAMPLE_AGENTS } from "../src/lib/operator-demo-data.js";

test("sample data: fictional ids, four made-up agents, the operator's 95% of $10–$50 briefs, every payout stage", () => {
  assert.ok(SAMPLE_ALLOCATIONS.length >= 12 && SAMPLE_ALLOCATIONS.length <= 20);
  for (const allocation of SAMPLE_ALLOCATIONS) {
    assert.match(allocation.id, /^alloc_sample_/);
    assert.match(allocation.payment_id, /^pay_sample_/);
    assert.ok(allocation.agent_shares.every((share) => share.agent_id in SAMPLE_AGENTS));
    const price = allocation.amount.amount_minor / 0.95;
    assert.ok(price >= 999 && price <= 5001, `${allocation.id}: ${allocation.amount.amount_minor}`);
  }
  const states = new Set(SAMPLE_ALLOCATIONS.map((a) => a.payout_state));
  for (const state of ["paid", "pending", "queued", "failed", "blocked"]) assert.ok(states.has(state as never), state);
});

test("the public demo page says it is sample data, shows the ledger, and makes no API requests", async (t) => {
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: "http://127.0.0.1:3000/operators/demo" });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const requests: string[] = [];
  for (const [name, value] of Object.entries({
    window: dom.window, self: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window), MutationObserver: dom.window.MutationObserver,
    localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (input: RequestInfo | URL) => { requests.push(String(input instanceof Request ? input.url : input)); throw new Error("no network in the demo"); },
  })) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  const [{ createRoot }, { OperatorDemo }] = await Promise.all([import("react-dom/client"), import("../src/app/operators/demo/operator-demo.js")]);
  const container = dom.window.document.getElementById("app")!;
  const root = createRoot(container);
  t.after(async () => {
    await act(async () => root.unmount());
    for (const [name, d] of saved) d ? Object.defineProperty(globalThis, name, d) : Reflect.deleteProperty(globalThis, name);
    dom.window.close();
  });

  await act(async () => root.render(<OperatorDemo />));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 200)); });
  assert.match(container.querySelector("h1")?.textContent ?? "", /sample data/);
  const banner = container.querySelector('[role="note"][aria-label="Sample data"]');
  assert.ok(banner, "sample data banner");
  assert.match(banner!.textContent ?? "", /^Sample data\. This demo shows the operator dashboard with fictional allocations so you can try it without connecting PayPal\. Sign in as an operator to see your own earnings\.$/);
  assert.ok(container.querySelector('[aria-label="Sample operator allocations"] .sample-tag'));
  assert.ok(container.querySelector('[role="region"][aria-label="Sample operator allocations"]'), "ledger grid");
  assert.match(container.textContent ?? "", /Pixel Forge/);
  assert.deepEqual(requests, []);
});
