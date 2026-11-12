import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToStaticMarkup } from "react-dom/server";
import type { components } from "@provable/api-client";
import { CheckoutActions, PaymentStatus } from "../src/components/payment-status.js";

test("approval links are restricted to the configured PayPal environment", () => {
  const dom = new JSDOM("", { url: "http://127.0.0.1:3000/competitions/a" });
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: dom.window });
  try {
    const base: components["schemas"]["Checkout"] = {
      payment_id: "pay-one", provider_order_id: "order-one", intent: "AUTHORIZE",
      approval_url: "", expires_at: "2030-01-01T00:00:00Z", server_time: "2026-01-01T00:00:00Z",
    };
    const check = (mode: components["schemas"]["Config"]["mode"], url: string, allowed: boolean) => {
      const html = renderToStaticMarkup(<CheckoutActions checkout={{ ...base, approval_url: url }} mode={mode} busy={false} expired={false} verify={() => {}} />);
      const page = new JSDOM(html).window.document;
      assert.equal(Boolean(page.querySelector("a")), allowed, `${mode}: ${url}`);
      assert.equal(page.querySelector("button")?.disabled, !allowed, `${mode}: ${url} verification`);
    };
    for (const host of ["www.paypal.com", "paypal.com"]) {
      check("paypal_live", `https://${host}/checkoutnow?token=abc`, true);
      check("paypal_sandbox", `https://${host}/checkoutnow?token=abc`, false);
      check("mock", `https://${host}/checkoutnow?token=abc`, false);
    }
    for (const host of ["www.sandbox.paypal.com", "sandbox.paypal.com"]) {
      check("paypal_sandbox", `https://${host}/checkoutnow?token=abc`, true);
      check("paypal_live", `https://${host}/checkoutnow?token=abc`, false);
      check("mock", `https://${host}/checkoutnow?token=abc`, false);
    }
    for (const url of ["http://www.paypal.com/checkout", "https://www.paypal.com:444/checkout", "https://x@www.paypal.com/checkout", "https://www.paypal.com.evil.example/checkout", "https://www.paypal.com/checkout#fragment", "javascript:alert(1)", "/checkout/fake"]) check("paypal_live", url, false);
    check("paypal_sandbox", "https://www.sandbox.paypal.com/checkout#fragment", false);
    check("mock", "/checkout/fake?payment=one#fragment", false);
    check("mock", "/checkout/fake?payment=one", true);
    check("paypal_sandbox", "/checkout/fake?payment=one", false);
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original); else Reflect.deleteProperty(globalThis, "window");
    dom.window.close();
  }
});

test("confirmed payments identify simulated, sandbox and live modes", () => {
  const payment = { amount: { amount_minor: 1900 }, capture_state: "completed", captured_minor: 1900, authorization_state: "captured", operation_state: "idle", refund_state: "none", refunded_minor: 0, dispute_state: "none", reversal_state: "none", reversed_minor: 0 } as components["schemas"]["Payment"];
  for (const [mode, label] of [["mock", "Simulated payment"], ["paypal_sandbox", "Test payment"], ["paypal_live", "Payment"]] as const) {
    const html = renderToStaticMarkup(<PaymentStatus payment={payment} mode={mode} />);
    assert.ok(html.includes(`${label} confirmed`), mode);
  }
});
