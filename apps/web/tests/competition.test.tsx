import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import { act, Suspense } from "react";
import { JSDOM } from "jsdom";
import { createApiClient, type operations } from "@provable/api-client";
import { createMock } from "../../mock-api/src/app.js";

function unwrap<T>(result: {
  data?: T;
  error?: unknown;
  response: Response;
}): T {
  assert.ok(result.response.ok, JSON.stringify(result.error));
  assert.notEqual(result.data, undefined);
  return result.data!;
}

test(
  "the competition UI separates qualification, capture confirmation and protected delivery across first and additional purchases",
  { timeout: 45000 },
  async (t) => {
    const nativeFetch = globalThis.fetch;
    const { app } = await createMock();
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    // Administrative observations belong only to this Node fixture harness. The
    // rendered buyer components have neither this credential nor this transport.
    const buyer = createApiClient({
      baseUrl,
      token: "buyer-demo",
      fetch: nativeFetch,
    });
    const admin = createApiClient({
      baseUrl,
      token: "admin-demo",
      fetch: nativeFetch,
    });
    const header = () => ({ "Idempotency-Key": randomUUID() });
    const config = unwrap(await buyer.GET("/v1/config"));
    const competition = unwrap(
      await buyer.POST("/v1/competitions", {
        params: { header: header() },
        body: {
          title: "Five Minute Scenes",
          brief:
            "Create a scene and image in which two astronauts discover a garden on Mars.",
          bid: { currency: "USD", amount_minor: 500 },
          submission_window_seconds: 300,
          decision_window_seconds: 300,
          requirements: [
            {
              id: "req_mars",
              description: "Two astronauts discover a garden on Mars.",
            },
          ],
          accepted_terms_version: config.terms_version,
        },
      }),
    );
    const path = { competition_id: competition.id };
    unwrap(
      await buyer.POST("/v1/competitions/{competition_id}/checkout", {
        params: { path, header: header() },
      }),
    );
    unwrap(
      await buyer.POST("/v1/competitions/{competition_id}/authorize", {
        params: { path, header: header() },
      }),
    );
    const opened = unwrap(
      await buyer.GET("/v1/competitions/{competition_id}", {
        params: { path },
      }),
    );
    const agents = unwrap(await buyer.GET("/v1/agents"));
    const runs = unwrap(
      await buyer.POST("/v1/competitions/{competition_id}/agent-runs", {
        params: { path, header: header() },
        body: { agent_ids: agents.items.map((agent) => agent.id) },
      }),
    );
    assert.equal(runs.items.length, 3);
    assert.ok(runs.items.every((run) => run.status === "submitted"));

    const dom = new JSDOM(
      '<!doctype html><html><body><div id="app"></div></body></html>',
      { url: "http://127.0.0.1:3000" },
    );
    const previousGlobals = new Map<string, PropertyDescriptor | undefined>();
    function global(name: string, value: unknown) {
      previousGlobals.set(
        name,
        Object.getOwnPropertyDescriptor(globalThis, name),
      );
      Object.defineProperty(globalThis, name, {
        configurable: true,
        writable: true,
        value,
      });
    }
    global("window", dom.window);
    global("self", dom.window);
    global("document", dom.window.document);
    global("navigator", dom.window.navigator);
    global("HTMLElement", dom.window.HTMLElement);
    global("HTMLDialogElement", dom.window.HTMLDialogElement);
    global("Element", dom.window.Element);
    global("Node", dom.window.Node);
    global("sessionStorage", dom.window.sessionStorage);
    global("localStorage", dom.window.localStorage);
    global("IS_REACT_ACT_ENVIRONMENT", true);
    dom.window.sessionStorage.setItem(
      "provable.connection",
      JSON.stringify({ baseUrl, token: "buyer-demo" }),
    );
    dom.window.HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    dom.window.HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
      this.dispatchEvent(new dom.window.Event("close"));
    };

    const browserRequests: {
      method: string;
      url: string;
      authorization: string | null;
      key: string | null;
    }[] = [];
    globalThis.fetch = async (input, init) => {
      const request = new Request(
        input instanceof Request ? input.clone() : input,
        init,
      );
      assert.equal(
        new URL(request.url).origin,
        baseUrl,
        "buyer UI must stay on the configured API",
      );
      browserRequests.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.get("Authorization"),
        key: request.headers.get("Idempotency-Key"),
      });
      return nativeFetch(input, init);
    };
    const downloads: { filename: string; bytes: Promise<ArrayBuffer> }[] = [];
    const nativeAnchorClick = dom.window.HTMLAnchorElement.prototype.click;
    dom.window.HTMLAnchorElement.prototype.click = function () {
      if (this.download) {
        assert.ok(
          this.href.startsWith("blob:"),
          "originals download through a temporary blob URL",
        );
        downloads.push({
          filename: this.download,
          bytes: nativeFetch(this.href).then((response) =>
            response.arrayBuffer(),
          ),
        });
      } else nativeAnchorClick.call(this);
    };

    const previousApiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    process.env.NEXT_PUBLIC_API_BASE_URL = baseUrl;
    const [{ createRoot }, { ApiProvider }, { default: CompetitionPage }] =
      await Promise.all([
        import("react-dom/client"),
        import("../src/components/api-provider.js"),
        import("../src/app/competitions/[id]/page.js"),
      ]);
    const container = dom.window.document.getElementById("app")!;
    let root = createRoot(container);
    const params = Promise.resolve({ id: competition.id });
    const view = () => (
      <ApiProvider>
        <Suspense fallback={<p>Loading competition…</p>}>
          <CompetitionPage params={params} />
        </Suspense>
      </ApiProvider>
    );

    t.after(async () => {
      await act(async () => root.unmount());
      await app.close();
      globalThis.fetch = nativeFetch;
      if (previousApiUrl === undefined)
        delete process.env.NEXT_PUBLIC_API_BASE_URL;
      else process.env.NEXT_PUBLIC_API_BASE_URL = previousApiUrl;
      for (const [name, descriptor] of previousGlobals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
      dom.window.close();
    });

    async function eventually(
      check: () => boolean,
      label: string,
      timeout = 6500,
    ) {
      const end = Date.now() + timeout;
      while (!check()) {
        if (Date.now() >= end)
          assert.fail(`${label}\nRendered text: ${container.textContent}`);
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 40));
        });
      }
    }
    function button(text: string, within: ParentNode = container) {
      const found = [
        ...within.querySelectorAll<HTMLButtonElement>("button"),
      ].find((item) => item.textContent?.includes(text));
      assert.ok(found, `Button containing “${text}” is rendered`);
      return found;
    }
    async function click(target: HTMLButtonElement) {
      assert.equal(target.disabled, false, `${target.textContent} is enabled`);
      await act(async () => target.click());
    }
    const cards = () => [
      ...container.querySelectorAll<HTMLElement>(".submission-card"),
    ];
    const purchases = async () =>
      unwrap(
        await buyer.GET("/v1/competitions/{competition_id}/purchases", {
          params: { path },
        }),
      ).items;
    async function observe(
      paymentId: string,
      observation: operations["observeMockPayment"]["requestBody"]["content"]["application/json"]["observation"],
    ) {
      await act(async () => {
        unwrap(
          await admin.POST("/__mock/payments/{payment_id}/observation", {
            params: { path: { payment_id: paymentId }, header: header() },
            body: { observation },
          }),
        );
      });
    }

    await act(async () => root.render(view()));
    await eventually(
      () => Boolean(container.querySelector(".gallery-empty")),
      "opened competition is rendered",
    );
    assert.equal(
      cards().length,
      0,
      "submitted runs are not silently treated as qualified entries",
    );
    await click(button("Agent activity"));
    assert.equal(container.querySelectorAll(".run-status.submitted").length, 3);
    assert.ok(
      container.textContent?.includes("Submitted · awaiting qualification"),
    );
    await click(button("Qualified work"));

    await act(async () => {
      for (const run of runs.items) {
        assert.ok(run.submission_id);
        const submission = unwrap(
          await admin.GET("/v1/submissions/{submission_id}", {
            params: { path: { submission_id: run.submission_id } },
          }),
        );
        unwrap(
          await admin.POST(
            "/__mock/submissions/{submission_id}/qualification",
            {
              params: {
                path: { submission_id: run.submission_id },
                header: header(),
              },
              body: {
                status: "qualified",
                failure_code: null,
                reason: "Node fixture only.",
                evaluator_version: "dom-fixture-v1",
                checks: competition.requirements.map((requirement) => ({
                  requirement_id: requirement.id,
                  passed: true,
                  reason: "Fixture requirement satisfied.",
                })),
                artifact_hashes: submission.artifacts.map((artifact) => ({
                  asset_id: artifact.asset_id,
                  sha256: artifact.sha256,
                })),
              },
            },
          ),
        );
      }
    });
    await eventually(
      () =>
        cards().length === 3 &&
        container.querySelectorAll("img.asset-image").length === 3,
      "only qualified authenticated image previews appear",
    );
    const previewRequests = browserRequests.filter((request) =>
      request.url.includes("/preview"),
    );
    assert.ok(
      previewRequests.length >= 3,
      "qualified images are fetched; scene excerpts may also load",
    );
    assert.ok(
      previewRequests.every(
        (request) =>
          request.authorization === "Bearer buyer-demo" &&
          !new URL(request.url).search,
      ),
    );
    assert.equal(container.querySelectorAll(".purchase-delivery").length, 0);

    await click(button("Choose this entry", cards()[0]));
    assert.ok(container.querySelector("dialog[open]"));
    await click(button("Select & capture $5.00"));
    await eventually(
      () => Boolean(container.textContent?.includes("Payment pending")),
      "first capture remains pending",
    );
    let bought = await purchases();
    assert.equal(bought.length, 1);
    const first = bought[0];
    assert.equal(first.kind, "first");
    assert.equal(first.delivery_unlocked, false);
    assert.equal(container.querySelectorAll(".delivery-artifact").length, 0);
    assert.ok(
      [
        ...container.querySelectorAll<HTMLButtonElement>(".choose-button"),
      ].every((item) => item.disabled),
    );
    const selectedCompetition = unwrap(
      await buyer.GET("/v1/competitions/{competition_id}", {
        params: { path },
      }),
    );
    assert.equal(
      selectedCompetition.submission_deadline,
      opened.submission_deadline,
      "early selection preserves the advertised submission deadline",
    );

    await observe(first.payment_id, "unknown");
    await eventually(
      () => Boolean(container.textContent?.includes("Payment outcome unknown")),
      "unknown outcome is displayed without unlocking originals",
    );
    assert.equal(container.querySelectorAll(".delivery-artifact").length, 0);

    // Recover through GET resources and browser receipts, without issuing another
    // selection or capture command after the buyer reloads an unknown payment.
    await act(async () => {
      root.unmount();
    });
    root = createRoot(container);
    await act(async () => root.render(view()));
    await eventually(
      () => Boolean(container.textContent?.includes("Payment outcome unknown")),
      "page recovery restores the unknown purchase",
    );
    assert.equal(
      browserRequests.filter(
        (request) =>
          request.method === "POST" && request.url.endsWith("/selection"),
      ).length,
      1,
    );

    await observe(first.payment_id, "completed");
    await eventually(
      () =>
        Boolean(
          [...container.querySelectorAll("button")].find((item) =>
            item.textContent?.includes("Get originals"),
          ),
        ) &&
        [
          ...container.querySelectorAll<HTMLButtonElement>(".choose-button"),
        ].some((item) => !item.disabled),
      "confirmed entitlement unlocks originals and additional checkout",
    );
    const firstCard = cards().find((card) =>
      card.querySelector(".winner-badge"),
    )!;
    await click(button("Get originals", firstCard));
    await eventually(
      () => firstCard.querySelectorAll(".delivery-artifact").length === 2,
      "confirmed purchase gets both original artifact downloads",
    );
    await click(
      firstCard.querySelector<HTMLButtonElement>(".delivery-artifact")!,
    );
    await eventually(
      () => downloads.length === 1,
      "the image original downloads as a blob",
    );
    const firstSubmission = unwrap(
      await buyer.GET("/v1/submissions/{submission_id}", {
        params: { path: { submission_id: first.submission_id } },
      }),
    );
    const originalImage = firstSubmission.artifacts.find(
      (artifact) => artifact.type === "image",
    )!;
    const firstBytes = Buffer.from(await downloads[0].bytes);
    assert.equal(firstBytes.length, originalImage.size_bytes);
    assert.equal(
      createHash("sha256").update(firstBytes).digest("hex"),
      originalImage.sha256,
    );

    await click(
      [...container.querySelectorAll<HTMLButtonElement>(".choose-button")].find(
        (item) => !item.disabled,
      )!,
    );
    await click(button("Create additional checkout"));
    await eventually(
      () =>
        Boolean(container.textContent?.includes("Checkout awaiting approval")),
      "additional full-price checkout awaits its own approval",
    );
    bought = await purchases();
    assert.equal(bought.length, 2);
    const additional = bought.find((item) => item.kind === "additional")!;
    assert.equal(additional.price.amount_minor, 500);
    assert.equal(additional.checkout?.intent, "CAPTURE");
    assert.notEqual(additional.payment_id, first.payment_id);
    assert.equal(additional.delivery_unlocked, false);
    assert.equal(
      browserRequests.filter(
        (request) =>
          request.method === "POST" &&
          /\/(checkout|authorize)$/.test(request.url),
      ).length,
      0,
      "an additional purchase does not create a second authorization",
    );
    await click(button("Simulate approval & submit capture"));
    await eventually(
      () =>
        !container.textContent?.includes("Checkout awaiting approval") &&
        Boolean(container.textContent?.includes("Payment pending")),
      "additional capture remains pending after approval",
    );
    assert.equal(
      (await purchases()).find((item) => item.id === additional.id)
        ?.delivery_unlocked,
      false,
    );
    await observe(additional.payment_id, "completed");
    await eventually(
      () =>
        container.querySelectorAll(".purchase-panel .payment-status.success")
          .length === 2,
      "both independent captures are confirmed",
    );
    const additionalCard = cards().find(
      (card) =>
        card.classList.contains("selected-card") &&
        !card.querySelector(".winner-badge"),
    )!;
    await click(button("Get originals", additionalCard));
    await eventually(
      () => additionalCard.querySelectorAll(".delivery-artifact").length === 2,
      "additional purchase has its own delivery entitlement",
    );

    const accessPath = `/v1/purchases/${additional.id}/delivery-access`;
    const firstAccessKey = browserRequests.find(
      (request) =>
        new URL(request.url).pathname === accessPath &&
        request.method === "POST",
    )?.key;
    assert.ok(firstAccessKey);
    await act(async () => {
      unwrap(
        await admin.POST("/__mock/advance", {
          params: { header: header() },
          body: { seconds: 61 },
        }),
      );
    });
    await click(button("Written scene", additionalCard));
    await eventually(
      () => downloads.length === 2,
      "expired access renews without another payment",
    );
    const accessRequests = browserRequests.filter(
      (request) =>
        new URL(request.url).pathname === accessPath &&
        request.method === "POST",
    );
    assert.equal(accessRequests.length, 2);
    assert.notEqual(
      accessRequests[1].key,
      firstAccessKey,
      "known expiry uses a new nonfinancial access key",
    );
    assert.equal((await purchases()).length, 2);
    assert.equal(
      browserRequests.filter(
        (request) =>
          request.method === "POST" && request.url.endsWith("/capture"),
      ).length,
      1,
    );

    // Revocation must win even before the next resource poll updates the visible UI.
    await observe(first.payment_id, "disputed");
    const oldDownload = [
      ...firstCard.querySelectorAll<HTMLButtonElement>("button"),
    ].find((item) => item.textContent?.includes("Written scene"));
    if (oldDownload) await click(oldDownload);
    await eventually(
      () =>
        Boolean(
          firstCard.textContent?.includes("Originals are locked") ||
            firstCard.textContent?.includes("Originals stay locked"),
        ),
      "a fresh entitlement read or resource poll prevents delivery after a dispute",
    );
    assert.equal(downloads.length, 2);
    assert.ok(
      browserRequests.every(
        (request) => request.authorization === "Bearer buyer-demo",
      ),
      "the browser never uses an admin credential",
    );
    assert.ok(
      browserRequests
        .filter((request) => new URL(request.url).pathname.includes("/__mock/"))
        .every(
          (request) =>
            request.method === "GET" &&
            /^\/__mock\/deliveries\/[A-Za-z0-9_-]+$/.test(
              new URL(request.url).pathname,
            ),
        ),
      "only API-issued buyer-bound mock delivery routes are fetched",
    );
  },
);
