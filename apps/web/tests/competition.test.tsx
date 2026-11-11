import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { act, Suspense } from "react";
import { JSDOM } from "jsdom";
import { bakeryBrief, bakeryPage, startApi } from "./live-api.js";

test(
  "buyer picks a finished site: checked gallery, capture, fingerprint-verified download, agent payout, extra purchase",
  { timeout: 60000 },
  async (t) => {
    const nativeFetch = globalThis.fetch;
    const live = await startApi();
    const { baseUrl, json } = live;
    const buyerToken = await live.buyer();
    const alpha = await live.operatorAgent("PAYERALPHA01", "Alpha Studio");
    const beta = await live.operatorAgent("PAYERBETA002", "Beta Works");
    const config = (await json("GET", "/v1/config", null)).data;
    const competition = (await json("POST", "/v1/competitions", buyerToken, bakeryBrief(config.terms_version))).data;
    await json("POST", `/v1/competitions/${competition.id}/checkout`, buyerToken);
    assert.equal((await json("POST", `/v1/competitions/${competition.id}/authorize`, buyerToken)).status, 202);
    const entries: Record<string, string> = {};
    for (const [token, who] of [[alpha, "Alpha"], [beta, "Beta"]] as const) {
      const html = bakeryPage(who);
      const asset = (await json("POST", "/v1/assets", token, { competition_id: competition.id, type: "html", mime_type: "text/html", content_base64: Buffer.from(html).toString("base64") })).data;
      const sub = (await json("POST", `/v1/competitions/${competition.id}/submissions`, token, { title: `Crumb & Co. — ${who}`, artifacts: [{ asset_id: asset.id }] })).data;
      entries[sub.id] = html;
    }

    const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: "http://127.0.0.1:3000" });
    const previousGlobals = new Map<string, PropertyDescriptor | undefined>();
    function global(name: string, value: unknown) {
      previousGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    }
    for (const [name, value] of Object.entries({
      window: dom.window, self: dom.window, document: dom.window.document, navigator: dom.window.navigator,
      HTMLElement: dom.window.HTMLElement, HTMLDialogElement: dom.window.HTMLDialogElement, Element: dom.window.Element,
      Node: dom.window.Node, sessionStorage: dom.window.sessionStorage, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true,
    })) global(name, value);
    dom.window.sessionStorage.setItem("provable.connection", JSON.stringify({ baseUrl, token: buyerToken }));
    dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new dom.window.Event("close")); };
    const requests: { method: string; url: string; authorization: string | null }[] = [];
    globalThis.fetch = async (input, init) => {
      const request = new Request(input instanceof Request ? input.clone() : input, init);
      assert.equal(new URL(request.url).origin, baseUrl, "the buyer UI only talks to the configured API");
      requests.push({ method: request.method, url: request.url, authorization: request.headers.get("Authorization") });
      return nativeFetch(input, init);
    };
    const downloads: { filename: string; bytes: Promise<ArrayBuffer> }[] = [];
    const nativeClick = dom.window.HTMLAnchorElement.prototype.click;
    dom.window.HTMLAnchorElement.prototype.click = function () {
      if (this.download) {
        assert.ok(this.href.startsWith("blob:"), "originals download through a temporary blob URL");
        downloads.push({ filename: this.download, bytes: nativeFetch(this.href).then((r) => r.arrayBuffer()) });
      } else nativeClick.call(this);
    };
    const [{ createRoot }, { ApiProvider }, { default: CompetitionPage }] = await Promise.all([
      import("react-dom/client"), import("../src/components/api-provider.js"), import("../src/app/competitions/[id]/page.js"),
    ]);
    const container = dom.window.document.getElementById("app")!;
    const root = createRoot(container);
    const params = Promise.resolve({ id: competition.id });
    t.after(async () => {
      await act(async () => root.unmount());
      await live.close();
      globalThis.fetch = nativeFetch;
      for (const [name, descriptor] of previousGlobals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
      dom.window.close();
    });
    async function eventually(check: () => boolean, label: string, timeout = 12000) {
      const end = Date.now() + timeout;
      while (!check()) {
        if (Date.now() >= end) assert.fail(`${label}\nRendered text: ${container.textContent}`);
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 60)); });
      }
    }
    const button = (text: string, within: ParentNode = container) =>
      [...within.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.includes(text));
    async function click(target: HTMLButtonElement | undefined, label: string) {
      assert.ok(target, `${label} is rendered`);
      assert.equal(target.disabled, false, `${label} is enabled`);
      await act(async () => target.click());
    }
    const cards = () => [...container.querySelectorAll<HTMLElement>(".submission-card")];

    await act(async () => root.render(
      <ApiProvider><Suspense fallback={<p>Loading…</p>}><CompetitionPage params={params} /></Suspense></ApiProvider>,
    ));
    await eventually(() => cards().length === 2 && container.querySelectorAll(".site-preview iframe").length === 2, "both qualified sites render as sandboxed previews");
    for (const frame of container.querySelectorAll("iframe")) {
      assert.equal(frame.getAttribute("sandbox"), "allow-scripts", "previews never get allow-same-origin");
      assert.ok(frame.getAttribute("src")?.startsWith("blob:"));
    }
    const previews = requests.filter((r) => r.url.includes("/preview"));
    assert.ok(previews.length >= 2 && previews.every((r) => r.authorization === `Bearer ${buyerToken}` && !new URL(r.url).search));
    assert.ok(container.textContent?.includes("Meets all 3 requirements"));
    assert.ok(container.textContent?.includes("How it was checked"));
    assert.ok(container.textContent?.includes("$1.23 PayPal processing"), "the processing fee is disclosed");

    await click(button("Choose this entry", cards()[0]), "Choose this entry");
    assert.ok(container.querySelector("dialog[open]"));
    await click(button("Pick it · pay $21.23"), "Pick it · pay $21.23");
    await eventually(() => Boolean(button("Get originals")), "PayPal capture confirmed and originals unlocked");
    const winnerCard = cards().find((c) => c.querySelector(".winner-badge"))!;
    await click(button("Get originals", winnerCard), "Get originals");
    await eventually(() => winnerCard.querySelectorAll(".delivery-artifact").length === 1, "one original website file is offered");
    await click(winnerCard.querySelector<HTMLButtonElement>(".delivery-artifact")!, "download");
    await eventually(() => downloads.length === 1, "the original downloads");
    const bought = (await json("GET", `/v1/competitions/${competition.id}/purchases`, buyerToken)).data.items[0];
    const bytes = Buffer.from(await downloads[0].bytes);
    assert.equal(bytes.toString("utf8"), entries[bought.submission_id], "the buyer gets exactly what the agent submitted");
    const submission = (await json("GET", `/v1/submissions/${bought.submission_id}`, buyerToken)).data;
    assert.equal(createHash("sha256").update(bytes).digest("hex"), submission.artifacts[0].sha256);
    assert.ok(downloads[0].filename.endsWith(".html"));
    await eventually(() => Boolean(container.textContent?.match(/was paid \$19\.00 by PayPal Payouts/)), "the winning agent's payout is shown once PayPal confirms it");

    const otherCard = cards().find((c) => !c.querySelector(".winner-badge"))!;
    await click(button("Buy this entry", otherCard), "Buy this entry");
    await click(button("Continue to checkout"), "Continue to checkout");
    await eventually(() => Boolean(button("I approved it · complete purchase")), "extra entry shows its own PayPal checkout");
    await click(button("I approved it · complete purchase"), "complete purchase");
    await eventually(() => Boolean(button("Get originals", otherCard)) && Boolean(otherCard.textContent?.includes("Beta Works was paid $19.00")), "second purchase captured, unlocked and its agent paid");
    assert.equal(requests.filter((r) => r.method === "POST" && r.url.endsWith("/selection")).length, 1, "one selection command");
    assert.ok(requests.every((r) => r.authorization === `Bearer ${buyerToken}` || r.url.endsWith("/v1/config") || r.url.endsWith("/v1/agents?limit=100")));
  },
);
