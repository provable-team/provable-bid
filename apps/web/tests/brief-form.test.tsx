import assert from "node:assert/strict";
import { test } from "node:test";
import { act } from "react";
import { JSDOM } from "jsdom";
import { registerHooks } from "node:module";
import { startApi } from "./live-api.js";

// CSS modules are a Next build feature; under tsx they load as an object of class names.
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".module.css")) {
      return { format: "module", shortCircuit: true, source: "export default new Proxy({}, { get: (_, key) => String(key) });" };
    }
    return nextLoad(url, context);
  },
});

test("brief form explains what is missing inline: aria-invalid fields, described errors, focus on the first problem", { timeout: 30000 }, async (t) => {
  const live = await startApi();
  t.after(() => live.close());
  const buyer = await live.buyer();
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: "http://127.0.0.1:3000/briefs/new" });
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
  const [{ createRoot }, { ApiProvider }, { default: NewBriefPage }, { AppRouterContext }] = await Promise.all([
    import("react-dom/client"), import("../src/components/api-provider.js"), import("../src/app/briefs/new/page.js"),
    import("next/dist/shared/lib/app-router-context.shared-runtime.js"),
  ]);
  const pushed: string[] = [];
  const router = {
    push: (href: string) => { pushed.push(href); }, replace: () => {}, refresh: () => {}, back: () => {}, forward: () => {}, prefetch: () => {},
  };
  const container = dom.window.document.getElementById("app")!;
  const root = createRoot(container);
  t.after(async () => {
    await act(async () => root.unmount());
    for (const [name, descriptor] of saved) descriptor ? Object.defineProperty(globalThis, name, descriptor) : Reflect.deleteProperty(globalThis, name);
    dom.window.close();
  });
  async function eventually(check: () => boolean, label: string) {
    const end = Date.now() + 8000;
    while (!check()) {
      if (Date.now() > end) assert.fail(`${label}\n${container.textContent}`);
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    }
  }
  const byId = <T extends HTMLElement>(id: string) => dom.window.document.getElementById(id) as T | null;
  const submitButton = () => container.querySelector<HTMLButtonElement>("button[type=submit]")!;
  async function type(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const proto = input instanceof dom.window.HTMLTextAreaElement ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
    const setValue = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
    await act(async () => { setValue.call(input, value); input.dispatchEvent(new dom.window.Event("input", { bubbles: true })); });
  }
  async function submit() {
    await act(async () => { submitButton().form!.requestSubmit(submitButton()); });
  }

  await act(async () => root.render(
    <AppRouterContext.Provider value={router as never}><ApiProvider><NewBriefPage /></ApiProvider></AppRouterContext.Provider>,
  ));
  await eventually(() => Boolean(byId("accept-terms")) && !submitButton().disabled && !byId<HTMLInputElement>("accept-terms")!.disabled, "the form and policy load");
  assert.equal(submitButton().disabled, false, "submit is not silently disabled before the terms are ticked");
  assert.equal(byId("brief-title")!.getAttribute("aria-invalid"), "false", "no errors before the first attempt");

  await submit();
  const title = byId<HTMLInputElement>("brief-title")!;
  assert.equal(title.getAttribute("aria-invalid"), "true");
  assert.equal(byId(title.getAttribute("aria-describedby")!)?.textContent, "Give your brief a title.");
  const brief = byId<HTMLTextAreaElement>("creative-brief")!;
  assert.equal(brief.getAttribute("aria-invalid"), "true");
  assert.ok(brief.getAttribute("aria-describedby")!.split(" ").includes("creative-brief-help"), "the hint stays described");
  const requirement = container.querySelector<HTMLInputElement>("input[id^=requirement-]")!;
  assert.equal(requirement.getAttribute("aria-invalid"), "true");
  assert.equal(byId("accept-terms")!.getAttribute("aria-invalid"), "true");
  assert.equal(dom.window.document.activeElement, title, "focus moves to the first field that needs attention");
  assert.match(container.querySelector("[role=alert]")?.textContent ?? "", /4 fields need attention/);
  assert.equal(pushed.length, 0);

  await type(title, "Landing page for a neighborhood bakery");
  assert.equal(title.getAttribute("aria-invalid"), "false", "an error clears as soon as the field is fixed");
  assert.equal(title.getAttribute("aria-describedby"), null);
  await type(brief, "One page for Crumb & Co.: hero, opening hours, pre-order button.");
  await type(requirement, "Shows the opening hours.");
  await submit();
  assert.equal(dom.window.document.activeElement, byId("accept-terms"), "only the terms remain; focus goes to the checkbox");
  assert.match(container.querySelector("[role=alert]")?.textContent ?? "", /Accept the terms/);

  await act(async () => byId<HTMLInputElement>("accept-terms")!.click());
  assert.equal(byId("accept-terms")!.getAttribute("aria-invalid"), "false");
  assert.doesNotMatch(container.querySelector("[role=alert]")?.textContent ?? "", /Accept the terms|need attention/,
    "the summary clears as soon as the last field is fixed, without another submit");
  await submit();
  await eventually(() => pushed.length === 1, "a complete brief is created");
  assert.match(pushed[0], /^\/competitions\/cmp_/);
});
