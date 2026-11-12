import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import {
  ApiError,
  assertCompatibleConfig,
  processingFeeFor,
  command,
  fetchProtected,
  protectedUrl,
  setCommandNamespace,
  unwrap,
  withRequestTimeout,
} from "../src/lib/api.js";
import type { components } from "@provable/api-client";

class MemoryStorage implements Storage {
  private readonly entries = new Map<string, string>();
  get length() {
    return this.entries.size;
  }
  clear() {
    this.entries.clear();
  }
  getItem(key: string) {
    return this.entries.get(key) ?? null;
  }
  key(index: number) {
    return [...this.entries.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.entries.delete(key);
  }
  setItem(key: string, value: string) {
    this.entries.set(key, value);
  }
}

function browser(t: TestContext, storage: Storage = new MemoryStorage()) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {},
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  setCommandNamespace("http://127.0.0.1:4010|buyer-demo");
  t.after(() => {
    if (previousWindow)
      Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (previousStorage)
      Object.defineProperty(globalThis, "localStorage", previousStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
    setCommandNamespace("unconfigured");
  });
  return storage;
}

const accepted = <T>(data: T) => ({
  data,
  response: new Response(null, { status: 202 }),
});

test("incompatible payment policies are rejected before buyer data is used", () => {
  const config: components["schemas"]["Config"] = {
    mode: "mock",
    currency: "USD",
    terms_version: "race-v1",
    policy: {
      terms_version: "race-v1",
      commission_bps: 500,
      processing_fee_bps: 349,
      processing_fee_fixed_minor: 49,
      payout_fee_minor: 25,
      qualification_grace_seconds: 120,
    },
    capabilities: {
      authorization: true,
      additional_checkout: true,
      external_agents: true,
      payouts: "simulated",
      ai_evaluation: false,
      house_agents: false,
      operator_onboarding: "paypal_login",
      browser_previews: false,
      operator_assistant: false,
    },
    server_time: "2026-11-10T18:00:00.000Z",
  };
  assert.doesNotThrow(() => assertCompatibleConfig(config));
  const legacy = structuredClone(config);
  Reflect.deleteProperty(legacy.policy, "processing_fee_bps");
  assert.throws(() => assertCompatibleConfig(legacy), /incompatible.*v0\.4\.0/);
  const mismatchedTerms = structuredClone(config);
  mismatchedTerms.policy.terms_version = "other-policy";
  assert.throws(() => assertCompatibleConfig(mismatchedTerms), /incompatible/);
  const invalidFees = structuredClone(config);
  invalidFees.policy.commission_bps = -1;
  assert.throws(() => assertCompatibleConfig(invalidFees), /incompatible/);
});

test("the displayed processing fee matches the API's: $20.00 → $1.23", () => {
  assert.equal(processingFeeFor(2000, { processing_fee_bps: 349, processing_fee_fixed_minor: 49 }), 123);
  assert.equal(processingFeeFor(1000, { processing_fee_bps: 349, processing_fee_fixed_minor: 49 }), 87);
});

test("request deadlines release an unresponsive transport and ignore late results", async () => {
  let signal: AbortSignal | undefined;
  let complete: ((value: string) => void) | undefined;
  const result = withRequestTimeout(
    (requestSignal) => {
      signal = requestSignal;
      return new Promise<string>((resolve) => {
        complete = resolve;
      });
    },
    { timeoutMs: 20 },
  );
  await assert.rejects(
    result,
    (error) =>
      error instanceof ApiError && error.status === 408 && error.retryable,
  );
  assert.equal(signal?.aborted, true);
  complete?.("stale response");
  await assert.rejects(result, /timed out/);
  assert.equal(await withRequestTimeout(async () => "recovered"), "recovered");
});

test("parent cancellation prevents a request from starting", async () => {
  const controller = new AbortController();
  controller.abort();
  let called = false;
  await assert.rejects(
    withRequestTimeout(
      async () => {
        called = true;
      },
      { signal: controller.signal },
    ),
    (error) => error instanceof DOMException && error.name === "AbortError",
  );
  assert.equal(called, false);
});

test("a command deadline keeps the original payment key for an explicit retry", async (t) => {
  const storage = browser(t);
  const keys: string[] = [];
  let requestSignal: AbortSignal | undefined;
  await assert.rejects(
    command(
      "selection.timeout",
      { submission_id: "sub_neon" },
      (key, signal) => {
        keys.push(key);
        requestSignal = signal;
        return new Promise<ReturnType<typeof accepted>>(() => {});
      },
      { timeoutMs: 20 },
    ),
    /timed out/,
  );
  assert.equal(requestSignal?.aborted, true);
  assert.equal(JSON.parse(storage.getItem(storage.key(0)!)!).confirmed, false);
  await command(
    "selection.timeout",
    { submission_id: "sub_neon" },
    async (key) => {
      keys.push(key);
      return accepted({ status: "payment_pending", delivery_unlocked: false });
    },
  );
  assert.equal(keys[0], keys[1]);
});

test("a lost payment response preserves one logical key through retry and page recovery", async (t) => {
  const storage = browser(t);
  const keys: string[] = [];
  const body = { submission_id: "sub_neon" };
  await assert.rejects(
    command("selection.cmp_mars", body, async (key) => {
      keys.push(key);
      throw new TypeError(
        "Connection lost after the server accepted selection.",
      );
    }),
    /Connection lost/,
  );

  assert.equal(storage.length, 1);
  const persisted = storage.getItem(storage.key(0)!)!;
  assert.equal(JSON.parse(persisted).key, keys[0]);
  assert.ok(
    !storage.key(0)!.includes("buyer-demo"),
    "storage namespace does not contain the bearer credential",
  );

  // A recovered page has the same browser storage and re-establishes its API account.
  setCommandNamespace("http://127.0.0.1:4010|buyer-demo");
  const purchase = {
    id: "pur_first",
    status: "payment_pending",
    delivery_unlocked: false,
  };
  assert.deepEqual(
    await command("selection.cmp_mars", body, async (key) => {
      keys.push(key);
      return accepted(purchase);
    }),
    purchase,
  );
  await command("selection.cmp_mars", body, async (key) => {
    keys.push(key);
    return accepted(purchase);
  });
  assert.equal(new Set(keys).size, 1);
  assert.equal(JSON.parse(storage.getItem(storage.key(0)!)!).confirmed, true);
});

test("an uncertain command cannot be silently replaced by a different purchase body", async (t) => {
  browser(t);
  await assert.rejects(
    command("selection.cmp_mars", { submission_id: "sub_neon" }, async () => {
      throw new TypeError("Network unavailable");
    }),
  );
  let submitted = false;
  await assert.rejects(
    command("selection.cmp_mars", { submission_id: "sub_paper" }, async () => {
      submitted = true;
      return accepted({});
    }),
    /saved request/,
  );
  assert.equal(submitted, false);
});

test("server validation permits correction, while provider failures preserve the original command", async (t) => {
  browser(t);
  const rejectedKeys: string[] = [];
  await assert.rejects(
    command("create.draft_mars", { title: "" }, async (key) => {
      rejectedKeys.push(key);
      return {
        error: {
          detail: "Title required.",
          code: "VALIDATION_ERROR",
          retryable: false,
        },
        response: new Response(null, { status: 400 }),
      };
    }),
    /Title required/,
  );
  await command(
    "create.draft_mars",
    { title: "Five Minute Scenes" },
    async (key) => {
      rejectedKeys.push(key);
      return accepted({ id: "cmp_mars" });
    },
  );
  assert.notEqual(rejectedKeys[0], rejectedKeys[1]);

  const paymentKeys: string[] = [];
  await assert.rejects(
    command("capture.pur_extra", null, async (key) => {
      paymentKeys.push(key);
      return {
        error: {
          detail: "Provider unavailable.",
          code: "PROVIDER_UNAVAILABLE",
          retryable: true,
        },
        response: new Response(null, { status: 503 }),
      };
    }),
    /Provider unavailable/,
  );
  await command("capture.pur_extra", null, async (key) => {
    paymentKeys.push(key);
    return accepted({ id: "pur_extra", status: "payment_pending" });
  });
  assert.equal(paymentKeys[0], paymentKeys[1]);
});

test("command identities are isolated across accounts and API origins", async (t) => {
  browser(t);
  const keys: string[] = [];
  for (const value of [
    "http://127.0.0.1:4010|buyer-demo",
    "http://127.0.0.1:4010|buyer-other",
    "http://127.0.0.1:4011|buyer-demo",
    "http://127.0.0.1:4010|buyer-demo",
  ]) {
    setCommandNamespace(value);
    await command(
      "selection.cmp_mars",
      { submission_id: "sub_neon" },
      async (key) => {
        keys.push(key);
        return accepted({ id: "pur_first" });
      },
    );
  }
  assert.equal(new Set(keys.slice(0, 3)).size, 3);
  assert.equal(keys[0], keys[3]);
});

test("blocked browser storage prevents a financial request before it starts", async (t) => {
  const storage = new MemoryStorage();
  storage.setItem = () => {
    throw new DOMException("Storage denied.", "SecurityError");
  };
  browser(t, storage);
  let requested = false;
  await assert.rejects(
    command("capture.pur_extra", null, async () => {
      requested = true;
      return accepted({});
    }),
    /Enable browser storage/,
  );
  assert.equal(requested, false);
});

test("problem responses preserve useful failure and trace information without treating 202 as paid", () => {
  const pending = { status: "payment_pending", delivery_unlocked: false };
  assert.deepEqual(unwrap(accepted(pending)), pending);
  assert.throws(
    () =>
      unwrap({
        error: {
          detail: "This work is locked.",
          code: "DELIVERY_LOCKED",
          retryable: false,
          request_id: "trace_delivery",
        },
        response: new Response(null, { status: 409 }),
      }),
    (error) =>
      error instanceof ApiError &&
      error.code === "DELIVERY_LOCKED" &&
      error.status === 409 &&
      error.retryable === false &&
      error.requestId === "trace_delivery",
  );
});

test("protected assets cannot send the bearer credential to another origin or an executable URL", () => {
  const base = "http://127.0.0.1:4010";
  assert.equal(
    protectedUrl("/v1/assets/asset_mars/preview", base),
    `${base}/v1/assets/asset_mars/preview`,
  );
  for (const unsafe of [
    "https://untrusted.example/art.png",
    "//untrusted.example/art.png",
    "http://127.0.0.1:4011/art.png",
    "http://buyer:secret@127.0.0.1:4010/art.png",
    "data:image/svg+xml,<svg/>",
    "javascript:alert(1)",
  ])
    assert.throws(() => protectedUrl(unsafe, base), /unsupported asset host/);
});

test("authenticated assets use headers, no-store and redirect refusal, and propagate revocation", async (t) => {
  const previousFetch = globalThis.fetch;
  let requestedUrl: string | URL | Request | undefined;
  let requestedOptions: RequestInit | undefined;
  globalThis.fetch = async (url, options) => {
    requestedUrl = url;
    requestedOptions = options;
    return new Response("preview bytes", {
      headers: { "Content-Type": "image/png" },
    });
  };
  t.after(() => {
    globalThis.fetch = previousFetch;
  });
  const controller = new AbortController();
  await fetchProtected(
    "/v1/assets/asset_mars/preview",
    { baseUrl: "http://127.0.0.1:4010", token: "buyer-demo" },
    controller.signal,
  );
  assert.equal(
    requestedUrl,
    "http://127.0.0.1:4010/v1/assets/asset_mars/preview",
  );
  assert.equal(
    new Headers(requestedOptions?.headers).get("Authorization"),
    "Bearer buyer-demo",
  );
  assert.equal(requestedOptions?.cache, "no-store");
  assert.equal(requestedOptions?.redirect, "error");
  assert.equal(requestedOptions?.signal, controller.signal);
  assert.ok(!String(requestedUrl).includes("buyer-demo"));

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        detail: "Delivery access was revoked.",
        code: "DELIVERY_LOCKED",
        retryable: false,
      }),
      { status: 409, headers: { "Content-Type": "application/problem+json" } },
    );
  await assert.rejects(
    fetchProtected("/__mock/deliveries/dl_mars", {
      baseUrl: "http://127.0.0.1:4010",
      token: "buyer-demo",
    }),
    (error) =>
      error instanceof ApiError &&
      error.code === "DELIVERY_LOCKED" &&
      error.status === 409,
  );
});
