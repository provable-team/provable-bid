import assert from "node:assert/strict";
import { test } from "node:test";
import { act, Suspense } from "react";
import { JSDOM } from "jsdom";
import { bakeryBrief, bakeryPage, startApi } from "./live-api.js";

test(
  "an outside agent shows as working once it reads the brief, by its own name (never its operator's), then becomes its entry",
  { timeout: 60000 },
  async (t) => {
    const live = await startApi();
    const { baseUrl, json } = live;
    const buyerToken = await live.buyer();
    const operatorName = "Jane Q Operator";
    const agentToken = await live.operatorAgent("PAYERKESTREL", "Kestrel Pages", operatorName);
    const config = (await json("GET", "/v1/config", null)).data;
    const competition = (await json("POST", "/v1/competitions", buyerToken, bakeryBrief(config.terms_version))).data;
    await json("POST", `/v1/competitions/${competition.id}/checkout`, buyerToken);
    assert.equal((await json("POST", `/v1/competitions/${competition.id}/authorize`, buyerToken)).status, 202);
    // The agent reads the brief with its own credential: the one real signal the API has.
    assert.equal((await json("GET", `/v1/competitions/${competition.id}`, agentToken)).status, 200);

    const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: "http://127.0.0.1:3000" });
    const previousGlobals = new Map<string, PropertyDescriptor | undefined>();
    for (const [name, value] of Object.entries({
      window: dom.window, self: dom.window, document: dom.window.document, navigator: dom.window.navigator,
      HTMLElement: dom.window.HTMLElement, HTMLDialogElement: dom.window.HTMLDialogElement, Element: dom.window.Element,
      Node: dom.window.Node, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
      MutationObserver: dom.window.MutationObserver, sessionStorage: dom.window.sessionStorage, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true,
    })) {
      previousGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    }
    dom.window.sessionStorage.setItem("provable.connection", JSON.stringify({ baseUrl, token: buyerToken }));
    const [{ createRoot }, { ApiProvider }, { default: CompetitionPage }] = await Promise.all([
      import("react-dom/client"), import("../src/components/api-provider.js"), import("../src/app/competitions/[id]/page.js"),
    ]);
    const container = dom.window.document.getElementById("app")!;
    const root = createRoot(container);
    t.after(async () => {
      await act(async () => root.unmount());
      await live.close();
      for (const [name, descriptor] of previousGlobals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
      dom.window.close();
    });
    async function eventually(check: () => boolean, label: string, timeout = 15000) {
      const end = Date.now() + timeout;
      while (!check()) {
        if (Date.now() >= end) assert.fail(`${label}\nRendered text: ${container.textContent}`);
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 60)); });
      }
    }
    const working = () => container.querySelector<HTMLElement>("[data-outside-id]");

    await act(async () => root.render(
      <ApiProvider><Suspense fallback={<p>Loading…</p>}><CompetitionPage params={Promise.resolve({ id: competition.id })} /></Suspense></ApiProvider>,
    ));
    await eventually(() => Boolean(working()), "the outside agent's working card renders");
    const card = working()!;
    assert.ok(card.textContent?.includes("Kestrel Pages"), "the agent's own name is its identity");
    assert.ok(card.textContent?.includes("Outside agent"));
    assert.ok(card.textContent?.includes("Read the brief"), "the step the API really observed");
    assert.ok(card.textContent?.includes("Building on its own machine"));
    assert.equal(card.querySelector(".card-spot"), null, "no cursor for an agent whose page we cannot see");
    assert.equal(container.querySelectorAll("[data-building-id]").length, 0, "not drawn as a house build");
    assert.ok(!container.textContent?.includes(operatorName), "the operator's PayPal name is never shown to the buyer");

    // The agent submits: its working card is replaced by its checked entry.
    const asset = (await json("POST", "/v1/assets", agentToken, { competition_id: competition.id, type: "html", mime_type: "text/html", content_base64: Buffer.from(bakeryPage("Kestrel")).toString("base64") })).data;
    assert.equal((await json("POST", `/v1/competitions/${competition.id}/submissions`, agentToken, { title: "Crumb & Co. — Kestrel", artifacts: [{ asset_id: asset.id }] })).status, 201);
    await eventually(() => !working() && container.querySelectorAll("[data-submission-id]").length === 1, "the working card becomes the qualified entry");
    const entry = container.querySelector<HTMLElement>("[data-submission-id] .submission-author")!;
    assert.ok(entry.textContent?.includes("Kestrel Pages") && entry.textContent?.includes("Outside agent"), entry.textContent ?? "");
    assert.ok(!container.textContent?.includes(operatorName));
    // The agents tab says "Outside agent", not the operator's name, too.
    const agentsTab = [...container.querySelectorAll<HTMLButtonElement>(".competition-tabs button")].find((b) => b.textContent?.startsWith("Agents"))!;
    await act(async () => agentsTab.click());
    await eventually(() => Boolean(container.querySelector(".agent-run")), "the agents tab renders");
    const run = [...container.querySelectorAll<HTMLElement>(".agent-run")].find((r) => r.textContent?.includes("Kestrel Pages"))!;
    assert.ok(run.textContent?.includes("Outside agent"));
    assert.ok(!container.textContent?.includes(operatorName));
  },
);

test(
  "house agents listed after the first page of the agent registry are still treated as house agents",
  { timeout: 120000 },
  async (t) => {
    const live = await startApi();
    const { baseUrl, json } = live;
    const buyerToken = await live.buyer();
    // 101 outside agents with UUID ids sort before every agent_house_* id, so the house profiles land on page 2.
    for (let i = 0; i < 101; i++) await live.operatorAgent(`PAYERPAGE${String(i).padStart(4, "0")}`, `Outside ${i}`);
    const firstPage = (await json("GET", "/v1/agents?limit=100", buyerToken)).data;
    assert.ok(firstPage.next_cursor, "the registry has a second page");
    assert.ok(!firstPage.items.some((a: { internal: boolean }) => a.internal), "no house agent is on the first page");
    const config = (await json("GET", "/v1/config", null)).data;
    const competition = (await json("POST", "/v1/competitions", buyerToken, bakeryBrief(config.terms_version))).data;
    await json("POST", `/v1/competitions/${competition.id}/checkout`, buyerToken);
    assert.equal((await json("POST", `/v1/competitions/${competition.id}/authorize`, buyerToken)).status, 202);

    const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: "http://127.0.0.1:3000" });
    const previousGlobals = new Map<string, PropertyDescriptor | undefined>();
    for (const [name, value] of Object.entries({
      window: dom.window, self: dom.window, document: dom.window.document, navigator: dom.window.navigator,
      HTMLElement: dom.window.HTMLElement, HTMLDialogElement: dom.window.HTMLDialogElement, Element: dom.window.Element,
      Node: dom.window.Node, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
      MutationObserver: dom.window.MutationObserver, sessionStorage: dom.window.sessionStorage, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true,
    })) {
      previousGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    }
    dom.window.sessionStorage.setItem("provable.connection", JSON.stringify({ baseUrl, token: buyerToken }));
    const [{ createRoot }, { ApiProvider }, { default: CompetitionPage }] = await Promise.all([
      import("react-dom/client"), import("../src/components/api-provider.js"), import("../src/app/competitions/[id]/page.js"),
    ]);
    const container = dom.window.document.getElementById("app")!;
    const root = createRoot(container);
    t.after(async () => {
      await act(async () => root.unmount());
      await live.close();
      for (const [name, descriptor] of previousGlobals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
      dom.window.close();
    });
    async function eventually(check: () => boolean, label: string, timeout = 20000) {
      const end = Date.now() + timeout;
      while (!check()) {
        if (Date.now() >= end) assert.fail(`${label}\nRendered text: ${container.textContent?.slice(0, 2000)}`);
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 60)); });
      }
    }
    await act(async () => root.render(
      <ApiProvider><Suspense fallback={<p>Loading…</p>}><CompetitionPage params={Promise.resolve({ id: competition.id })} /></Suspense></ApiProvider>,
    ));
    await eventually(() => Boolean(container.querySelector(".competition-tabs")), "the competition page renders");
    const agentsTab = [...container.querySelectorAll<HTMLButtonElement>(".competition-tabs button")].find((b) => b.textContent?.startsWith("Agents"))!;
    await act(async () => agentsTab.click());
    await eventually(() => container.querySelectorAll(".agent-run").length > 0, "the agents tab renders");
    const houseRuns = [...container.querySelectorAll<HTMLElement>(".agent-run")].filter((r) => r.textContent?.includes("House agent run by provable.bid"));
    assert.equal(houseRuns.length, 3, "all three house agents from page 2 are known and labelled as house agents");
  },
);
