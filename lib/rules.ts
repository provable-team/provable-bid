// Pure marketplace rules: no DB, no PayPal. Everything here is unit-tested.
import type { JobStatus, PaymentKind, PaymentStatus } from "@/lib/db/schema";

export const PLATFORM_FEE_BPS = 500; // 5% of the winning price, taken from the agent's payout
export const MIN_BUDGET_CENTS = 10_00;
export const MAX_BUDGET_CENTS = 5_000_00;
export const MIN_BID_CENTS = 10_00; // 5% of $10 = $0.50 > the $0.25 payout fee
export const MAX_REVISIONS = 1;
export const MAX_SAMPLE_BYTES = 200_000;
export const MAX_DELIVERY_BYTES = 1_000_000;
export const BIDDING_HOURS = [24, 72, 168] as const;

// PayPal's US pricing, measured in the sandbox on 2026-11-10 (see README):
//   PayPal-account checkout 3.49% + $0.49 · card 2.59% + $0.49 · payout $0.25 flat
//   Refunds return NONE of the capture fee, even a 100% refund.
// We price processing at the highest US checkout rate, so every US payment leaves at least the budget.
export const PAYPAL_CHECKOUT_FEE = { bps: 349, fixedCents: 49 };
export const PAYPAL_PAYOUT_FEE_CENTS = 25;
export const ACCEPTED_PAYER_COUNTRIES = ["US"]; // cross-border adds 1.5%, which the quote doesn't cover

// Percentage of an amount in cents, rounded half up.
const pct = (cents: number, bps: number) => Math.floor((cents * bps + 5_000) / 10_000);

export const feeFor = (priceCents: number) => pct(priceCents, PLATFORM_FEE_BPS);

export const paypalCheckoutFeeFor = (totalCents: number) => pct(totalCents, PAYPAL_CHECKOUT_FEE.bps) + PAYPAL_CHECKOUT_FEE.fixedCents;

// The smallest processing fee such that, after PayPal takes its checkout fee from the total, the full budget is left.
export function processingFeeFor(budgetCents: number): number {
  let fee = Math.floor((budgetCents * PAYPAL_CHECKOUT_FEE.bps) / (10_000 - PAYPAL_CHECKOUT_FEE.bps)) + PAYPAL_CHECKOUT_FEE.fixedCents - 2;
  while (budgetCents + fee - paypalCheckoutFeeFor(budgetCents + fee) < budgetCents) fee++;
  return fee;
}

// What the buyer sees before paying. Escrow is exactly the budget; processing is non-refundable.
export function quoteFor(budgetCents: number) {
  const processingFeeCents = processingFeeFor(budgetCents);
  return { budgetCents, processingFeeCents, totalCents: budgetCents + processingFeeCents };
}

// The platform's result on one job once everything has settled. Never negative under the rules above.
export function platformMargin(o: { processingFeeCents: number; captureFeeCents: number; priceCents: number | null; payoutFeeCents: number }) {
  const platformFee = o.priceCents === null ? 0 : feeFor(o.priceCents);
  return o.processingFeeCents - o.captureFeeCents + platformFee - o.payoutFeeCents;
}

// How the escrowed budget splits once a bid is chosen. Always sums to the budget.
export function settlementFor(budgetCents: number, priceCents: number) {
  if (!Number.isInteger(budgetCents) || !Number.isInteger(priceCents)) throw new Error("Amounts must be integer cents");
  if (priceCents > budgetCents) throw new Error("Price exceeds budget");
  const feeCents = feeFor(priceCents);
  return {
    refundToBuyerCents: budgetCents - priceCents, // returned at award time
    payoutToAgentCents: priceCents - feeCents, // paid when the buyer accepts the delivery
    feeCents, // stays with the platform
  };
}

export function checkBidPrice(budgetCents: number, priceCents: number): string | null {
  if (!Number.isInteger(priceCents)) return "Price must be whole cents.";
  if (priceCents < MIN_BID_CENTS) return `Minimum bid is $${MIN_BID_CENTS / 100}.`;
  if (priceCents > budgetCents) return "Price can't be above the buyer's budget.";
  return null;
}

export type Action = "fund" | "bid" | "award" | "deliver" | "request_revision" | "accept" | "cancel";

export type JobSnapshot = {
  status: JobStatus;
  biddingClosesAt: Date;
  deliveryDueAt: Date | null;
  revisionsUsed: number;
};

// Why an action isn't allowed right now, or null if it is.
export function blockedReason(job: JobSnapshot, action: Action, now = new Date()): string | null {
  const s = job.status;
  switch (action) {
    case "fund":
      return s === "awaiting_payment" ? null : "This job is already funded.";
    case "bid":
      if (s !== "open") return "This job isn't taking bids.";
      return now < job.biddingClosesAt ? null : "Bidding has closed for this job.";
    case "award":
      return s === "open" ? null : "This job isn't open for awarding.";
    case "deliver":
      return s === "awarded" ? null : "This job isn't waiting for a delivery.";
    case "request_revision":
      if (s !== "delivered") return "There's no delivery to revise.";
      return job.revisionsUsed < MAX_REVISIONS ? null : "The revision for this job has already been used.";
    case "accept":
      return s === "delivered" ? null : "There's no delivery to accept.";
    case "cancel":
      if (s === "awaiting_payment" || s === "open") return null;
      if (s === "awarded")
        return job.deliveryDueAt && now > job.deliveryDueAt
          ? null
          : "The agent is still within its delivery window. You can cancel if it misses the deadline.";
      return "This job can't be cancelled anymore.";
  }
}

// Buyer money held in escrow right now: the budget captured minus what has left (or is leaving).
// Failed movements don't count; pending ones do, because they will be retried, not abandoned.
// The processing fee is the platform's, not escrow.
export function escrowBalance(rows: { kind: PaymentKind; status: PaymentStatus; amountCents: number }[]): number {
  let balance = 0;
  for (const r of rows) {
    if (r.status === "failed" || r.kind === "processing_fee") continue;
    if (r.kind === "escrow_capture") {
      if (r.status === "succeeded") balance += r.amountCents;
    } else balance -= r.amountCents;
  }
  return balance;
}

// Map PayPal's money-movement status onto our ledger status.
export function statusForRefund(paypalStatus: string): PaymentStatus {
  if (paypalStatus === "COMPLETED") return "succeeded";
  if (paypalStatus === "PENDING") return "in_flight";
  return "failed";
}

export function statusForPayout(itemStatus: string | null, batchStatus: string): PaymentStatus {
  switch (itemStatus ?? batchStatus) {
    case "SUCCESS":
      return "succeeded";
    case "UNCLAIMED": // recipient has no PayPal account yet; claimable for 30 days
    case "PENDING":
    case "PROCESSING":
    case "ONHOLD":
      return "in_flight";
    default: // RETURNED, FAILED, BLOCKED, DENIED, REFUNDED, REVERSED…
      return "failed";
  }
}
