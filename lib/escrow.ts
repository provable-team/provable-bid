// Funding a job: the buyer pays budget + processing fee before agents see the job.
// The budget is held in escrow; the processing fee covers PayPal's checkout fee and isn't refunded.
import type { Order } from "@paypal/paypal-server-sdk";
import type { DB } from "@/lib/db";
import { getJob, markFunded, type Result } from "@/lib/market";
import { toCents } from "@/lib/money";
import type { LineItem } from "@/lib/paypal/orders";
import { ACCEPTED_PAYER_COUNTRIES } from "@/lib/rules";

type FundableJob = { id: string; title: string; budgetCents: number; processingFeeCents: number };

// Two line items, so the buyer's PayPal receipt shows exactly what's refundable and what isn't.
export function escrowLineItems(job: FundableJob): LineItem[] {
  return [
    {
      sku: job.id,
      name: `Escrow: ${job.title}`.slice(0, 127),
      description: "Held by provable.bid. Whatever the winning bid doesn't use is refunded.",
      unitPriceCents: job.budgetCents,
      quantity: 1,
    },
    {
      sku: `${job.id}-processing`,
      name: "Payment processing (non-refundable)",
      description: "Covers PayPal's fee on this payment.",
      unitPriceCents: job.processingFeeCents,
      quantity: 1,
    },
  ];
}

export function captureFromOrder(order: Order) {
  const unit = order.purchaseUnits?.[0];
  const capture = unit?.payments?.captures?.[0];
  const fee = capture?.sellerReceivableBreakdown?.paypalFee?.value;
  return {
    orderId: order.id ?? "",
    jobId: unit?.customId ?? null,
    captureId: capture?.id ?? null,
    status: capture?.status ?? order.status ?? "UNKNOWN",
    amountCents: toCents(capture?.amount?.value),
    currency: capture?.amount?.currencyCode ?? "USD",
    paypalFeeCents: fee === undefined ? null : toCents(fee),
  };
}

// Checked after the buyer approves and BEFORE we capture: nothing has been charged yet.
export function payerProblem(order: Order): string | null {
  const country = order.payer?.address?.countryCode;
  if (country && !ACCEPTED_PAYER_COUNTRIES.includes(country))
    return `provable.bid accepts US PayPal accounts for now (yours is ${country}). You haven't been charged.`;
  return null;
}

// Record a captured order as the job's escrow. Rejects orders for another job or not yet completed.
export function fundJobFromOrder(db: DB, jobId: string, order: Order, now = new Date()): Result<{ captureId: string }> {
  const c = captureFromOrder(order);
  if (c.jobId !== jobId) return { ok: false, error: "This payment belongs to a different job." };
  if (!c.captureId || c.status !== "COMPLETED")
    return { ok: false, error: `PayPal hasn't completed this payment (status ${c.status}). Nothing was charged to escrow.` };
  if (!getJob(db, jobId)) return { ok: false, error: "Job not found." };
  const r = markFunded(db, jobId, { paypalOrderId: c.orderId, captureId: c.captureId, amountCents: c.amountCents, currency: c.currency, paypalFeeCents: c.paypalFeeCents }, now);
  return r.ok ? { ok: true, data: { captureId: c.captureId } } : r;
}
