"use client";
import type { Payment, Purchase, components } from "@provable/api-client";
import { money } from "@/lib/api";
import { Icon } from "./ui";

export function PaymentStatus({
  payment,
  purchase,
  mock = null,
}: {
  payment: Payment;
  purchase?: Purchase;
  mock?: boolean | null;
}) {
  let title = "Awaiting authorization";
  let description =
    "The competition opens after the backend confirms the authorization.";
  let tone = "neutral";
  if (payment.authorization_state === "authorized") {
    title = `${money(payment.amount.amount_minor)} authorized`;
    description =
      "Your bid is authorized. Choosing the first winner commits the full capture.";
  }
  if (payment.authorization_state === "voided") {
    title = "Authorization released";
    description = "The backend reports the authorization was voided.";
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
    title = `${mock === true ? "Simulated payment" : mock === false ? "Payment" : "Capture"} confirmed · ${money(payment.captured_minor)}`;
    if (payment.purpose === "participation_fee")
      title = `${mock ? "Simulated participation fee" : "Participation fee"} confirmed · ${money(payment.captured_minor)}`;
    description = purchase?.delivery_unlocked
      ? "The backend confirms delivery access for this purchase."
      : "Capture is confirmed. Delivery depends on the current backend entitlement.";
    tone = "success";
  }
  if (payment.operation_state === "unknown") {
    title = "Payment outcome unknown";
    description =
      "The backend is reconciling with the provider. Keep this purchase; do not create another charge.";
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
      "Originals remain locked. This selection cannot switch to another winner or a participation fee. Contact the operator for recovery.";
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
    const url = new URL(checkout.approval_url);
    if (
      url.protocol === "https:" &&
      ["www.sandbox.paypal.com", "sandbox.paypal.com"].includes(url.hostname) &&
      !url.username &&
      !url.password
    )
      approval = url.href;
  } catch {
    /* Invalid approval targets are never linked. */
  }
  return (
    <div className="checkout-actions">
      <p>
        {mode === "mock"
          ? "Simulated checkout. The fixture approval URL is informational; no PayPal payment page is involved."
          : "PayPal approval is followed by backend verification. Approval alone does not confirm payment."}
      </p>
      {mode === "paypal_sandbox" && approval && !expired && (
        <a
          href={approval}
          target="_blank"
          rel="noopener noreferrer"
          className="button primary"
        >
          Approve with PayPal <Icon name="external" size={15} />
        </a>
      )}
      {mode === "paypal_sandbox" && !approval && (
        <div className="error-message">
          The API did not return a supported PayPal sandbox approval URL.
        </div>
      )}
      <button
        className={`button ${mode === "mock" ? "primary" : "secondary"}`}
        disabled={busy || expired || (mode === "paypal_sandbox" && !approval)}
        onClick={verify}
      >
        {busy
          ? "Verifying…"
          : mode === "mock"
            ? initial
              ? "Simulate approval & authorize"
              : "Simulate approval & submit capture"
            : initial
              ? "Verify authorization after approval"
              : "Verify approval & submit capture"}
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
