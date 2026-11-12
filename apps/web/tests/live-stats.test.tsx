import assert from "node:assert/strict";
import { test } from "node:test";
import { act } from "react";
import { JSDOM } from "jsdom";

const stats = {
  mode: "paypal_sandbox", generated_at: "2026-11-12T10:00:00.000Z",
  briefs_opened: 12, entries_submitted: 40, entries_checked: 38, entries_qualified: 19, qualified_rate: 0.5,
  competitions_captured: 7, competitions_voided: 4, purchases_completed: 8, paid_to_operators_usd: 133, payouts_paid_count: 7,
  outside_agents_registered: 3, outside_entries: 9, house_entries: 31,
};

test("live stats strip: loading, then the sandbox numbers in a polite live region; an error state; omitted figures are skipped", async (t) => {
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>');
  const saved = new Map<string, PropertyDescriptor | undefined>();
  let reply: () => Promise<Response> = async () => new Response(JSON.stringify(stats), { headers: { "content-type": "application/json" } });
  const urls: string[] = [];
  const fakeFetch = async (url: string) => { urls.push(url); return reply(); };
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true, fetch: fakeFetch })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const [{ createRoot }, { LiveStats, statItems }] = await Promise.all([import("react-dom/client"), import("../src/components/live-stats.js")]);
  const container = dom.window.document.getElementById("app")!;
  const root = createRoot(container);
  t.after(async () => {
    await act(async () => root.unmount());
    for (const [key, d] of saved) {
      if (d) Object.defineProperty(globalThis, key, d);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  });

  await act(async () => root.render(<LiveStats apiBase="http://api.test/" refreshMs={0} />));
  assert.deepEqual(urls, ["http://api.test/stats.json"]);
  const region = container.querySelector('[role="status"]')!;
  assert.equal(region.getAttribute("aria-live"), "polite");
  assert.equal(container.querySelector("h2")?.textContent, "Live sandbox numbers");
  assert.match(container.textContent ?? "", /PayPal sandbox · test money/);
  const shown = [...container.querySelectorAll("dl > div")].map((d) => [d.querySelector("dt")?.textContent, d.querySelector("dd")?.textContent]);
  assert.deepEqual(shown, [
    ["briefs opened", "12"], ["entries submitted", "40"], ["passed the checks", "50%"], ["paid for (captured)", "7"],
    ["voided, buyer paid nothing", "4"], ["paid to operators", "$133.00"], ["outside agents", "3"],
  ]);
  assert.equal(container.querySelector("section")?.getAttribute("aria-labelledby"), container.querySelector("h2")?.id);

  await act(async () => root.unmount());
  reply = async () => new Response(JSON.stringify({ ...stats, mode: "paypal_live" }), { headers: { "content-type": "application/json" } });
  const live = createRoot(container);
  await act(async () => live.render(<LiveStats apiBase="http://api.test" refreshMs={0} />));
  assert.match(container.textContent ?? "", /PayPal live · real money/);
  assert.doesNotMatch(container.textContent ?? "", /fake payments|sandbox · test money/);
  await act(async () => live.unmount());
  reply = async () => new Response("no", { status: 503 });
  const again = createRoot(container);
  await act(async () => again.render(<LiveStats apiBase="http://api.test" refreshMs={0} />));
  assert.match(container.textContent ?? "", /Live numbers are unavailable right now/);
  await act(async () => again.unmount());

  const partial = statItems({ mode: "mock", generated_at: "x", briefs_opened: 1, qualified_rate: null });
  assert.deepEqual(partial, [{ label: "briefs opened", value: "1" }], "figures the API omits (or cannot compute) are not shown");
});
