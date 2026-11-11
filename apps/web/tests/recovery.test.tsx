import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test, type TestContext } from "node:test";
import { act, Suspense } from "react";
import { JSDOM } from "jsdom";
import { createApiClient } from "@provable/api-client";
import { bakeryBrief, startApi } from "./live-api.js";

async function mountCompetition(
  t: TestContext,
  intercept: (request: Request) => Promise<Response> | undefined,
) {
  const nativeFetch = globalThis.fetch;
  const live = await startApi();
  const baseUrl = live.baseUrl;
  const buyerToken = await live.buyer();
  const api = createApiClient({
    baseUrl,
    token: buyerToken,
    fetch: nativeFetch,
  });
  const configResult = await api.GET("/v1/config");
  assert.ok(configResult.data);
  const config = configResult.data;
  const created = await api.POST("/v1/competitions", {
    params: { header: { "Idempotency-Key": randomUUID() } },
    body: bakeryBrief(config.terms_version),
  });
  assert.ok(created.data);
  const competition = created.data;
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="app"></div></body></html>',
    { url: "http://127.0.0.1:3000" },
  );
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    self: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    sessionStorage: dom.window.sessionStorage,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
  dom.window.sessionStorage.setItem(
    "provable.connection",
    JSON.stringify({ baseUrl, token: buyerToken }),
  );
  const requests: { method: string; path: string }[] = [];
  globalThis.fetch = async (input, init) => {
    const request = new Request(
      input instanceof Request ? input.clone() : input,
      init,
    );
    requests.push({
      method: request.method,
      path: new URL(request.url).pathname,
    });
    return intercept(request) ?? nativeFetch(input, init);
  };
  const [{ createRoot }, { ApiProvider }, { default: CompetitionPage }] =
    await Promise.all([
      import("react-dom/client"),
      import("../src/components/api-provider.js"),
      import("../src/app/competitions/[id]/page.js"),
    ]);
  const container = dom.window.document.getElementById("app")!;
  const root = createRoot(container);
  t.after(async () => {
    await act(async () => root.unmount());
    globalThis.fetch = nativeFetch;
    await live.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  });
  await act(async () =>
    root.render(
      <ApiProvider requestTimeoutMs={750}>
        <Suspense fallback={<p>Loading</p>}>
          <CompetitionPage params={Promise.resolve({ id: competition.id })} />
        </Suspense>
      </ApiProvider>,
    ),
  );
  async function eventually(
    check: () => boolean,
    label: string,
    timeout = 6000,
  ) {
    const deadline = Date.now() + timeout;
    while (!check()) {
      assert.ok(Date.now() < deadline, `${label}: ${container.textContent}`);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
    }
  }
  const button = (text: string) =>
    [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
      item.textContent?.includes(text),
    );
  return { container, competition, config, requests, eventually, button };
}

test(
  "legacy policy blocks buyer resources and checkout until a compatible reconnect",
  { timeout: 15000 },
  async (t) => {
    let legacy = true;
    const view = await mountCompetition(t, (request) => {
      if (legacy && new URL(request.url).pathname === "/v1/config")
        return (async () => {
          const actual = await fetchNative(request);
          const config = await actual.json();
          config.terms_version = config.policy.terms_version = "sandbox-v1";
          delete config.policy.processing_fee_bps;
          return Response.json(config);
        })();
    });
    await view.eventually(
      () =>
        Boolean(
          view.container.textContent?.includes(
            "incompatible with frontend contract v0.4.0",
          ),
        ),
      "legacy API is rejected",
    );
    assert.ok(
      view.requests.every((request) => request.path === "/v1/config"),
      "no legacy buyer data or financial commands are requested",
    );
    assert.equal(view.button("Hold $"), undefined);
    legacy = false;
    const retry = view.button("Try again");
    assert.ok(retry);
    await act(async () => retry.click());
    await view.eventually(
      () =>
        Boolean(
          view.button("Hold $21.23 with PayPal") &&
            !view.button("Hold $21.23 with PayPal")!.disabled,
        ),
      "reconnect accepts the current contract",
    );
    assert.equal(view.container.textContent?.includes("undefined"), false);
    assert.ok(view.requests.every((request) => request.method === "GET"));
  },
);

const fetchNative = globalThis.fetch;

test(
  "a stalled refresh times out, pauses payment controls, and recovers without a new command",
  { timeout: 15000 },
  async (t) => {
    let stall = false;
    let stalledRequest: Request | undefined;
    let finishLate: ((response: Response) => void) | undefined;
    const view = await mountCompetition(t, (request) => {
      if (
        stall &&
        request.method === "GET" &&
        /^\/v1\/competitions\/[^/]+$/.test(new URL(request.url).pathname)
      ) {
        stalledRequest = request;
        return new Promise((resolve) => {
          finishLate = resolve;
        });
      }
    });
    await view.eventually(
      () =>
        Boolean(
          view.button("Hold $21.23 with PayPal") &&
            !view.button("Hold $21.23 with PayPal")!.disabled,
        ),
      "initial snapshot is available",
    );
    stall = true;
    await view.eventually(
      () =>
        Boolean(
          view.container
            .querySelector('[role="alert"]')
            ?.textContent?.includes("timed out"),
        ),
      "stalled refresh reports its deadline",
    );
    assert.equal(stalledRequest?.signal.aborted, true);
    assert.equal(
      view.button("Hold $21.23 with PayPal")?.disabled,
      true,
      "stale payment controls are paused",
    );
    assert.ok(
      view.container.textContent?.includes("Landing page for a neighborhood bakery"),
      "last confirmed data remains visible",
    );
    stall = false;
    const retry = view.button("Try again");
    assert.ok(retry);
    await act(async () => retry.click());
    await view.eventually(
      () =>
        Boolean(
          view.button("Hold $21.23 with PayPal") &&
            !view.button("Hold $21.23 with PayPal")!.disabled,
        ),
      "refresh can resume after timeout",
    );
    await act(async () => {
      finishLate?.(
        Response.json({
          ...view.competition,
          title: "Stale response after timeout",
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    assert.equal(
      view.container.querySelector("h1")?.textContent,
      "Landing page for a neighborhood bakery",
      "late requests cannot replace a newer snapshot",
    );
    assert.equal(view.container.querySelector('[role="alert"]'), null);
    assert.ok(
      view.requests.every((request) => request.method === "GET"),
      "observation recovery never creates a charge",
    );
  },
);
