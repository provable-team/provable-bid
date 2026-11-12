"use client";
import type { Payment, Purchase, components } from "@provable/api-client";
import { money } from "@/lib/api";
import { Icon } from "./ui";

export function PaymentStatus({
  payment,
  purchase,
  mode = null,
}: {
  payment: Payment;
  purchase?: Purchase;
  mode?: components["schemas"]["Config"]["mode"] | null;
}) {
  let title = "Awaiting authorization";
  let description =
    "The competition opens after the backend confirms the authorization.";
  let tone = "neutral";
  if (payment.authorization_state === "authorized") {
    title = `${money(payment.amount.amount_minor)} on hold`;
    description =
      "PayPal is holding your payment. Nothing is charged until you pick a winner; reject everything and the hold is released.";
  }
  if (payment.authorization_state === "voided") {
    title = "Hold released · you paid nothing";
    description = "PayPal confirmed the authorization was voided.";
  }
  if (payment.authorization_state === "void_pending") {
    title = "Releasing authorization";
    description = "Waiting for the provider to confirm release of the hold.";
  }
  if (purchase?.status === "awaiting_approval") {
    title = "Checkout awaiting approval";
    description =
      "Approve this separate full-price checkout, then verify it below.";
  }
  if (
    payment.capture_state === "pending" ||
    purchase?.status === "payment_pending"
  ) {
    title = "Payment pending";
    description =
      "The capture is committed. Waiting for confirmation; originals remain locked.";
    tone = "pending";
  }
  if (payment.capture_state === "completed") {
    title = `${mode === "mock" ? "Simulated payment" : mode === "paypal_sandbox" ? "Test payment" : mode === "paypal_live" ? "Payment" : "Capture"} confirmed · ${money(payment.captured_minor)}`;
    description = purchase?.delivery_unlocked
      ? "The backend confirms delivery access for this purchase."
      : "Capture is confirmed. Delivery depends on the current backend entitlement.";
    tone = "success";
  }
  if (payment.operation_state === "unknown") {
    title = "Payment outcome unknown";
    description =
      payment.last_error_code === "CAPTURE_OUTCOME_REQUIRES_RECONCILIATION"
        ? "PayPal has not confirmed the result. Contact the operator to reconcile this purchase; do not create another charge."
        : "The backend is reconciling with the provider. Keep this purchase; do not create another charge.";
    tone = "pending";
  }
  if (
    payment.capture_state === "failed" ||
    payment.authorization_state === "failed" ||
    payment.authorization_state === "expired"
  ) {
    title =
      payment.authorization_state === "expired"
        ? "Authorization expired"
        : "Payment failed";
    description =
      "Originals remain locked. This selection cannot switch to another winner. Contact the operator for recovery.";
    tone = "danger";
  }
  if (payment.refund_state !== "none" || payment.refunded_minor > 0) {
    title = `Refund ${payment.refund_state.replaceAll("_", " ")}`;
    description =
      "The current refund state prevents delivery. Previously downloaded work cannot be recalled.";
    tone = "danger";
  }
  if (payment.dispute_state !== "none") {
    title = `Dispute ${payment.dispute_state}`;
    description =
      "Delivery access is controlled by the backend while the dispute is resolved.";
    tone = "danger";
    if (payment.dispute_state === "won" && purchase?.delivery_unlocked) {
      description =
        "The backend reports a resolved dispute and currently permits delivery for this purchase.";
      tone = "success";
    }
  }
  if (payment.reversal_state !== "none" || payment.reversed_minor > 0) {
    title = `Payment reversal ${payment.reversal_state}`;
    description =
      "A provider reversal holds delivery. A historical completed capture does not override this hold.";
    tone = "danger";
  }
  return (
    <div className={`payment-status ${tone}`} role="status">
      <span className="payment-state-icon">
        <Icon
          name={
            tone === "success" ? "check" : tone === "pending" ? "clock" : "lock"
          }
          size={18}
        />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
        {payment.last_error_code && (
          <span className="field-help">
            Reference: {payment.last_error_code}
          </span>
        )}
      </div>
    </div>
  );
}

export function CheckoutActions({
  checkout,
  mode,
  busy,
  expired,
  verify,
  initial = false,
}: {
  checkout: components["schemas"]["Checkout"];
  mode: components["schemas"]["Config"]["mode"];
  busy: boolean;
  expired: boolean;
  verify: () => void;
  initial?: boolean;
}) {
  let approval: string | null = null;
  try {
    const url = new URL(checkout.approval_url, window.location.href);
    const paypal =
      (mode === "paypal_sandbox" && ["https://www.sandbox.paypal.com", "https://sandbox.paypal.com"].includes(url.origin)) ||
      (mode === "paypal_live" && ["https://www.paypal.com", "https://paypal.com"].includes(url.origin));
    // Fake-provider mode approves on this app's own clearly labelled simulator page, never elsewhere.
    const simulator = mode === "mock" && url.origin === window.location.origin && url.pathname === "/checkout/fake";
    if ((paypal || simulator) && !url.username && !url.password && !url.hash) approval = url.href;
  } catch {
    /* Invalid approval targets are never linked. */
  }
  return (
    <div className="checkout-actions">
      <p>
        {mode === "mock"
          ? "Demo mode: a simulated PayPal approval, no real payment."
          : mode === "paypal_sandbox"
            ? "PayPal sandbox uses test money. We verify approval with PayPal before anything changes."
            : "PayPal live uses real money. We verify approval with PayPal before anything changes."}
      </p>
      {approval && !expired && (
        <a href={approval} className="button primary">
          {mode === "mock" ? "Approve (simulated)" : "Continue to PayPal"}{" "}
          <Icon name="external" size={15} />
        </a>
      )}
      {!approval && (
        <div className="error-message">
          The API did not return a supported PayPal approval URL.
        </div>
      )}
      <button
        className="button secondary"
        disabled={busy || expired || !approval}
        onClick={verify}
      >
        {busy
          ? "Checking with PayPal…"
          : initial
            ? "I approved it · open my brief"
            : "I approved it · complete purchase"}
        <Icon name="arrow" size={16} />
      </button>
      {expired && (
        <p className="error-message">
          This checkout has expired. No new capture can be committed from this
          approval link.
        </p>
      )}
    </div>
  );
}
