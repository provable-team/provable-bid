import assert from "node:assert/strict";
import { test } from "node:test";
import { act } from "react";
import { JSDOM, VirtualConsole } from "jsdom";
import { startApi } from "./live-api.js";

test("operator approves an agent's code in the activation page; the agent then receives its credential", { timeout: 30000 }, async (t) => {
  const live = await startApi();
  t.after(() => live.close());
  const buyer = await live.buyer();
  const start = await live.json("GET", "/v1/operators/connect", null);
  const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
  const back = await live.json("GET", `/v1/operators/connect/callback?code=${encodeURIComponent("fake:PAYERACT0001:Activator")}&state=${state}`, null);
  const operatorToken = new URLSearchParams(back.headers.get("location")!.split("#")[1]).get("operator_token")!;
  const device = (await live.json("POST", "/v1/agent-device-codes", null, { client_name: "Crumb Studio", description: "Warm editorial bakery pages." })).data;

  // jsdom does not navigate; record attempts instead of printing "not implemented".
  const virtualConsole = new VirtualConsole();
  const consoleErrors: string[] = [];
  virtualConsole.on("jsdomError", (e) => { if (!/navigation/i.test(e.message)) consoleErrors.push(e.message); });
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    url: `http://127.0.0.1:3000/operators/activate?code=${device.user_code.toLowerCase().replace("-", "")}`, virtualConsole,
  });
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
  // Imported after the DOM globals exist: react-dom decides what the browser supports when it loads.
  const [{ createRoot }, { ApiProvider }, { default: ActivatePage }, { takeOperatorReturn }] = await Promise.all([
    import("react-dom/client"), import("../src/components/api-provider.js"), import("../src/app/operators/activate/page.js"), import("../src/lib/operator-return.js"),
  ]);
  let container = dom.window.document.getElementById("app")!;
  let root = createRoot(container);
  t.after(async () => {
    await act(async () => root.unmount());
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
  const text = () => container.textContent ?? "";
  const button = (name: string) => [...container.querySelectorAll<HTMLElement>("button, a")].find((b) => b.textContent?.includes(name));
  async function click(name: string) { const target = button(name); assert.ok(target, `${name} exists`); await act(async () => target.click()); }
  async function type(input: HTMLInputElement, value: string) {
    const setValue = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
    await act(async () => { setValue.call(input, value); input.dispatchEvent(new dom.window.Event("input", { bubbles: true })); });
  }

  // Signed in: the request is looked up from the link's code.
  dom.window.localStorage.setItem(`provable.operator.${live.baseUrl}`, operatorToken);
  await act(async () => root.render(<ApiProvider><ActivatePage /></ApiProvider>));
  await eventually(() => text().includes("Approve this agent?"), "the pending request is shown");
  assert.match(text(), /Crumb Studio/);
  assert.match(text(), /Warm editorial bakery pages\./);
  assert.equal(dom.window.location.search, `?code=${device.user_code}`);
  const nameInput = container.querySelector<HTMLInputElement>("form input")!;
  assert.equal(nameInput.value, "Crumb Studio");
  await type(nameInput, "Crumb Studio Prime");
  await click("Approve");
  await eventually(() => text().includes("Agent approved."), "approval is confirmed");
  assert.match(text(), /It will receive its credential automatically within a few seconds\./);
  assert.match(text(), /Crumb Studio Prime/);

  const issued = await live.json("POST", "/v1/agent-device-tokens", null, { device_code: device.device_code });
  assert.equal(issued.status, 200);
  assert.equal(issued.data.agent.name, "Crumb Studio Prime");
  assert.ok(!text().includes(issued.data.token), "the token never appears on the page");

  // A code that matches nothing shows the API's explanation in the page.
  await click("Approve another code");
  const codeInput = container.querySelector<HTMLInputElement>("input")!;
  await type(codeInput, "bcdfghjk");
  assert.equal(codeInput.value, "BCDF-GHJK");
  await click("Continue");
  await eventually(() => text().includes("No pending request has this code"), "unknown codes explain what to do");

  // Deny.
  const second = (await live.json("POST", "/v1/agent-device-codes", null, { client_name: "Unknown Bot" })).data;
  await type(container.querySelector<HTMLInputElement>("input")!, second.user_code);
  await click("Continue");
  await eventually(() => text().includes("Unknown Bot"), "second request is shown");
  await click("Deny");
  await eventually(() => text().includes("Request denied."), "denial is confirmed");
  const refused = await live.json("POST", "/v1/agent-device-tokens", null, { device_code: second.device_code });
  assert.equal(refused.data.code, "ACCESS_DENIED");
  // Signed out: the code is kept, and signing in will come back to this page with it.
  await act(async () => root.unmount());
  dom.window.localStorage.clear();
  dom.window.history.replaceState(null, "", `/operators/activate?code=${device.user_code}`);
  container.remove();
  container = dom.window.document.body.appendChild(dom.window.document.createElement("div"));
  root = createRoot(container);
  await act(async () => root.render(<ApiProvider><ActivatePage /></ApiProvider>));
  await eventually(() => text().includes("Sign in to approve") && text().includes("Connect (demo login)"), "signed-out operators are asked to connect PayPal");
  assert.match(text(), new RegExp(device.user_code));
  assert.equal(button("Connect (demo login)")?.getAttribute("href"), `${live.baseUrl}/v1/operators/connect`);
  await click("Connect (demo login)");
  assert.equal(takeOperatorReturn(), `/operators/activate?code=${device.user_code}`);
  assert.equal(takeOperatorReturn(), null, "the return note is used once");

  assert.deepEqual(consoleErrors, []);
});
