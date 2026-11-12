import assert from "node:assert/strict";
import { test } from "node:test";
import { act } from "react";
import { JSDOM } from "jsdom";
import { createApiClient } from "@provable/api-client";

test("operator assistant panel: labelled input, answer in a live region, and every PayPal lookup listed", { timeout: 20000 }, async (t) => {
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: "http://127.0.0.1:3000/operators" });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [name, value] of Object.entries({
    window: dom.window, self: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  const asked: { question: string; authorization: string | null; idempotency: string | null }[] = [];
  let status = 200;
  const fetchStub: typeof fetch = async (input, init) => {
    const req = new Request(input instanceof Request ? input.clone() : input, init);
    assert.equal(new URL(req.url).pathname, "/v1/operators/me/assistant");
    asked.push({ question: (await req.json()).question, authorization: req.headers.get("Authorization"), idempotency: req.headers.get("Idempotency-Key") });
    const body = status === 429
      ? { type: "urn:provable:problem:rate_limited", title: "rate limited", status: 429, code: "RATE_LIMITED", detail: "At most 10 questions a minute.", request_id: "req_1", retryable: true }
      : { answer: "Your $19.00 payout for the bakery brief was paid on Nov 12.", server_time: "2026-11-12T12:00:00Z", lookups: [
        { tool: "my_allocations", source: "ledger", ref: null, status: "ok", summary: "1 allocation, 19.00 USD earned" },
        { tool: "get_order", source: "paypal_agent_toolkit", ref: "5O190127TN364715T", status: "ok", summary: "Order COMPLETED · hold CAPTURED · capture COMPLETED 10.87 USD" },
        { tool: "get_order", source: "paypal_agent_toolkit", ref: "9XX00000000000000", status: "refused", summary: "Not one of your PayPal orders, so it was not looked up." },
        { tool: "get_payout", source: "paypal_payouts", ref: "BATCH123", status: "ok", summary: "Payout SUCCESS (batch SUCCESS) · 9.50 USD" },
      ] };
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": status === 200 ? "application/json" : "application/problem+json" } });
  };
  const client = createApiClient({ baseUrl: "http://127.0.0.1:4999", token: "pbo_operator", fetch: fetchStub });
  const [{ createRoot }, { OperatorAssistant }] = await Promise.all([import("react-dom/client"), import("../src/components/operator-assistant.js")]);
  const container = dom.window.document.getElementById("app")!;
  const root = createRoot(container);
  t.after(async () => {
    await act(async () => root.unmount());
    for (const [name, descriptor] of saved) descriptor ? Object.defineProperty(globalThis, name, descriptor) : Reflect.deleteProperty(globalThis, name);
    dom.window.close();
  });
  await act(async () => root.render(<OperatorAssistant client={client} />));

  const input = container.querySelector<HTMLInputElement>("input#assistant-question")!;
  assert.ok(container.querySelector('label[for="assistant-question"]')?.textContent?.includes("Your question"), "the input is labelled");
  const output = container.querySelector('[data-testid="assistant-answer"]')!;
  assert.equal(output.getAttribute("aria-live"), "polite");

  const suggestion = [...container.querySelectorAll("button")].find((b) => b.textContent === "Where's my latest payout?")!;
  await act(async () => { suggestion.click(); await new Promise((r) => setTimeout(r, 50)); });
  assert.deepEqual(asked, [{ question: "Where's my latest payout?", authorization: "Bearer pbo_operator", idempotency: null }]);
  assert.match(output.textContent!, /payout for the bakery brief was paid/);
  const lines = [...output.querySelectorAll("li")].map((li) => li.textContent);
  assert.equal(lines.length, 4);
  assert.match(lines[0]!, /^Checked your ledger: 1 allocation/);
  assert.match(lines[1]!, /^Checked PayPal \(Agent Toolkit get_order\) · 5O190127TN364715T: Order COMPLETED/);
  assert.match(lines[2]!, /^Not looked up · 9XX00000000000000/);
  assert.match(lines[3]!, /^Checked PayPal Payouts · BATCH123: Payout SUCCESS/);
  assert.equal(input.value, "", "the input clears after an answer");

  status = 429;
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
    setValue.call(input, "What did I earn today?");
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
  await act(async () => { container.querySelector("form")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 50)); });
  assert.match(output.querySelector('[role="alert"]')!.textContent!, /10 questions this minute/);
});
