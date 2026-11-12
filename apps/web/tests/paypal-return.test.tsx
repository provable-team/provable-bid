import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { act, Suspense } from "react";
import { JSDOM } from "jsdom";
import { bakeryBrief, bakeryPage, startApi } from "./live-api.js";

type Live = Awaited<ReturnType<typeof startApi>>;

/** Approve controls the buyer must never see again once back from PayPal (until a verification fails). */
const approveControl = (el: Element) =>
  /Hold \$|I approved it|Approve \(simulated\)|Continue to PayPal|Preparing checkout/.test(el.textContent ?? "");

/** Mount the buyer page as PayPal's redirect lands on it, recording every approve control and status ever rendered. */
async function mountReturn(t: TestContext, live: Live, buyerToken: string, competitionId: string, search: string, setup?: (storage: Storage) => void) {
  const nativeFetch = globalThis.fetch;
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    url: `http://127.0.0.1:3000/competitions/${competitionId}${search}`,
  });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window, self: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, HTMLDialogElement: dom.window.HTMLDialogElement, Element: dom.window.Element,
    Node: dom.window.Node, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    MutationObserver: dom.window.MutationObserver, sessionStorage: dom.window.sessionStorage,
    localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  dom.window.sessionStorage.setItem("provable.connection", JSON.stringify({ baseUrl: live.baseUrl, token: buyerToken }));
  setup?.(dom.window.localStorage);
  const requests: { method: string; path: string; at: number }[] = [];
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests.push({ method: request.method, path: new URL(request.url).pathname, at: Date.now() });
    return nativeFetch(input, init);
  };
  const [{ createRoot }, { ApiProvider }, { default: CompetitionPage }] = await Promise.all([
    import("react-dom/client"), import("../src/components/api-provider.js"), import("../src/app/competitions/[id]/page.js"),
  ]);
  const container = dom.window.document.getElementById("app")!;
  const seen = { approve: [] as string[], confirming: [] as string[], snapshotWithApprove: false };
  const record = () => {
    for (const el of container.querySelectorAll("button, a"))
      if (approveControl(el)) seen.approve.push(el.textContent ?? "");
    for (const el of container.querySelectorAll('[role="status"]'))
      if (el.textContent?.includes("Confirming your PayPal")) seen.confirming.push(el.textContent);
  };
  const observer = new dom.window.MutationObserver(record);
  observer.observe(container, { childList: true, subtree: true, characterData: true });
  const root = createRoot(container);
  t.after(async () => {
    observer.disconnect();
    await act(async () => root.unmount());
    globalThis.fetch = nativeFetch;
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  });
  await act(async () =>
    root.render(
      <ApiProvider>
        <Suspense fallback={<p>Loading</p>}>
          <CompetitionPage params={Promise.resolve({ id: competitionId })} />
        </Suspense>
      </ApiProvider>,
    ),
  );
  record();
  async function eventually(check: () => boolean, label: string, timeout = 12000) {
    const deadline = Date.now() + timeout;
    while (!check()) {
      assert.ok(Date.now() < deadline, `${label}: ${container.textContent}`);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      record();
    }
  }
  const button = (text: string, within: ParentNode = container) =>
    [...within.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.includes(text));
  return { dom, container, requests, seen, eventually, button };
}

async function briefAwaitingApproval(live: Live, buyerToken: string) {
  const config = (await live.json("GET", "/v1/config", null)).data;
  const competition = (await live.json("POST", "/v1/competitions", buyerToken, bakeryBrief(config.terms_version))).data;
  const checkout = await live.json("POST", `/v1/competitions/${competition.id}/checkout`, buyerToken);
  assert.equal(checkout.status, 201);
  return { competition, checkout: checkout.data };
}

test("back from PayPal: confirming status at once, never the approve panel, then the hold", { timeout: 30000 }, async (t) => {
  const live = await startApi();
  t.after(() => live.close());
  const buyerToken = await live.buyer();
  const { competition, checkout } = await briefAwaitingApproval(live, buyerToken);
  const view = await mountReturn(t, live, buyerToken, competition.id,
    `?paypal=return&kind=authorize&payment_id=${checkout.payment_id}`);
  // The URL is tidied before anything loads, but the confirming state lives on in React state.
  assert.equal(view.dom.window.location.search, "");
  const status = view.container.querySelector('[role="status"][aria-live="polite"]');
  assert.ok(status?.textContent?.includes("Confirming your PayPal approval…"), `confirming from the first render: ${view.container.textContent}`);
  await view.eventually(() => Boolean(view.container.textContent?.includes("$21.23 on hold")), "the hold is confirmed");
  assert.ok(view.seen.confirming.length > 0);
  assert.deepEqual(view.seen.approve, [], "no approve or hold control is shown after the return");
  assert.equal(view.container.querySelector('[role="alert"]'), null, "no error");
  // The verification starts with the first load, not after it.
  const authorize = view.requests.filter((r) => r.method === "POST" && r.path.endsWith("/authorize"));
  assert.equal(authorize.length, 1, "one authorize command");
  const settlement = view.requests.find((r) => r.path.endsWith("/settlement"));
  assert.ok(!settlement || authorize[0].at <= settlement.at, "authorize is sent before the first snapshot finishes loading");
  const state = (await live.json("GET", `/v1/competitions/${competition.id}`, buyerToken)).data.state;
  assert.equal(state, "open");
});

test("back from PayPal on an already open brief: no error, straight to the hold", { timeout: 30000 }, async (t) => {
  const live = await startApi();
  t.after(() => live.close());
  const buyerToken = await live.buyer();
  const { competition, checkout } = await briefAwaitingApproval(live, buyerToken);
  assert.equal((await live.json("POST", `/v1/competitions/${competition.id}/authorize`, buyerToken)).status, 202);
  const view = await mountReturn(t, live, buyerToken, competition.id,
    `?paypal=return&kind=authorize&payment_id=${checkout.payment_id}`);
  await view.eventually(() => Boolean(view.container.textContent?.includes("$21.23 on hold")), "the hold is shown");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 200)); });
  assert.equal(view.container.querySelector('[role="alert"]'), null, "an already open brief is not an error");
  assert.deepEqual(view.seen.approve, []);
});

test("back from PayPal when authorization fails: the error and the approve panel return for a retry", { timeout: 30000 }, async (t) => {
  const live = await startApi();
  t.after(() => live.close());
  const buyerToken = await live.buyer();
  live.fake.controls.payerCountry = "GB"; // the API refuses non-US payers before any money is held
  const { competition, checkout } = await briefAwaitingApproval(live, buyerToken);
  const view = await mountReturn(t, live, buyerToken, competition.id,
    `?paypal=return&kind=authorize&payment_id=${checkout.payment_id}`,
    // The buyer's own checkout receipt, as the page saved it before leaving for PayPal.
    (storage) => storage.setItem(`provable.checkout.${live.baseUrl}.${competition.id}`, JSON.stringify(checkout)));
  assert.ok(view.container.textContent?.includes("Confirming your PayPal approval…"));
  await view.eventually(
    () => Boolean(view.container.querySelector('[role="alert"]')?.textContent?.includes("Only US PayPal accounts")),
    "the refusal is shown",
  );
  await view.eventually(() => Boolean(view.button("Hold $21.23 with PayPal") || view.button("I approved it")), "the approve panel is back");
  assert.equal(view.container.textContent?.includes("Confirming your PayPal approval…"), false);
  // Fixed on PayPal's side: retrying from the error opens the brief.
  for (const order of live.fake.orders.values()) order.payerCountry = "US";
  const retry = view.button("Try again");
  assert.ok(retry);
  await act(async () => retry.click());
  await view.eventually(() => Boolean(view.container.textContent?.includes("$21.23 on hold")), "retry confirms the hold");
});

test("back from PayPal for an extra entry: confirming that purchase, never its approve controls, then unlocked", { timeout: 60000 }, async (t) => {
  const live = await startApi();
  t.after(() => live.close());
  const buyerToken = await live.buyer();
  const alpha = await live.operatorAgent("PAYERALPHA01", "Alpha Studio");
  const beta = await live.operatorAgent("PAYERBETA002", "Beta Works");
  const { competition } = await briefAwaitingApproval(live, buyerToken);
  assert.equal((await live.json("POST", `/v1/competitions/${competition.id}/authorize`, buyerToken)).status, 202);
  const submissions: string[] = [];
  for (const [token, who] of [[alpha, "Alpha"], [beta, "Beta"]] as const) {
    const asset = (await live.json("POST", "/v1/assets", token, { competition_id: competition.id, type: "html", mime_type: "text/html", content_base64: Buffer.from(bakeryPage(who)).toString("base64") })).data;
    submissions.push((await live.json("POST", `/v1/competitions/${competition.id}/submissions`, token, { title: `Crumb & Co. — ${who}`, artifacts: [{ asset_id: asset.id }] })).data.id);
  }
  const deadline = Date.now() + 15000;
  while ((await live.json("GET", `/v1/submissions/${submissions[1]}`, buyerToken)).data.qualification_status !== "qualified") {
    assert.ok(Date.now() < deadline, "entries qualify");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const first = (await live.json("POST", `/v1/competitions/${competition.id}/selection`, buyerToken, { submission_id: submissions[0] })).data;
  while (!(await live.json("GET", `/v1/purchases/${first.id}`, buyerToken)).data.delivery_unlocked) {
    assert.ok(Date.now() < deadline, "first purchase completes");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const extra = await live.json("POST", `/v1/competitions/${competition.id}/additional-purchases`, buyerToken, { submission_id: submissions[1] });
  assert.equal(extra.data.status, "awaiting_approval");
  const view = await mountReturn(t, live, buyerToken, competition.id,
    `?paypal=return&kind=purchase&payment_id=${extra.data.payment_id}`);
  assert.ok(view.container.textContent?.includes("Confirming your PayPal payment…"));
  const cards = () => [...view.container.querySelectorAll<HTMLElement>(".submission-card")];
  await view.eventually(() => cards().length === 2 && cards().every((card) => Boolean(view.button("Get originals", card))), "both purchases unlocked");
  assert.ok(view.seen.confirming.some((text) => text.includes("Confirming your PayPal payment…")));
  assert.deepEqual(view.seen.approve, [], "the extra entry's approve controls never show after the return");
  assert.equal(view.container.querySelector('[role="alert"]'), null);
  assert.equal(view.requests.filter((r) => r.method === "POST" && r.path.endsWith("/capture")).length, 1, "one capture command");
});
