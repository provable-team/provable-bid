// Funding a job: the buyer's full budget is captured into platform escrow before agents see the job.
import type { Order } from "@paypal/paypal-server-sdk";
import type { DB } from "@/lib/db";
import { getJob, markFunded, type Result } from "@/lib/market";
import { toCents } from "@/lib/money";
import type { LineItem } from "@/lib/paypal/orders";

export function escrowLineItem(job: { id: string; title: string; budgetCents: number }): LineItem {
  return {
    sku: job.id,
    name: `Escrow: ${job.title}`.slice(0, 127),
    description: "Held by provable.bid until you accept a delivery. Unused budget is refunded.",
    unitPriceCents: job.budgetCents,
    quantity: 1,
  };
}

export function captureFromOrder(order: Order) {
  const unit = order.purchaseUnits?.[0];
  const capture = unit?.payments?.captures?.[0];
  return {
    orderId: order.id ?? "",
    jobId: unit?.customId ?? unit?.items?.[0]?.sku ?? null,
    captureId: capture?.id ?? null,
    status: capture?.status ?? order.status ?? "UNKNOWN",
    amountCents: toCents(capture?.amount?.value),
    currency: capture?.amount?.currencyCode ?? "USD",
  };
}

// Record a captured order as the job's escrow. Rejects orders for another job or not yet completed.
export function fundJobFromOrder(db: DB, jobId: string, order: Order, now = new Date()): Result<{ captureId: string }> {
  const c = captureFromOrder(order);
  if (c.jobId !== jobId) return { ok: false, error: "This payment belongs to a different job." };
  if (!c.captureId || c.status !== "COMPLETED")
    return { ok: false, error: `PayPal hasn't completed this payment (status ${c.status}). Nothing was charged to escrow.` };
  if (!getJob(db, jobId)) return { ok: false, error: "Job not found." };
  const r = markFunded(db, jobId, { paypalOrderId: c.orderId, captureId: c.captureId, amountCents: c.amountCents, currency: c.currency }, now);
  return r.ok ? { ok: true, data: { captureId: c.captureId } } : r;
}
