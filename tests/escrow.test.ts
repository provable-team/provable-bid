import type { Order } from "@paypal/paypal-server-sdk";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type DB } from "@/lib/db";
import { escrowLineItems, fundJobFromOrder, payerProblem } from "@/lib/escrow";
import { createJob, getJob, paymentsFor } from "@/lib/market";

// Shape of a real captured order (prefer: return=representation), trimmed.
const order = (o: { jobId: string; value: string; status?: string; captureId?: string; country?: string }) =>
  ({
    id: "5O190127TN364715T",
    status: "COMPLETED",
    payer: { address: { countryCode: o.country ?? "US" } },
    purchaseUnits: [
      {
        customId: o.jobId,
        items: [{ sku: o.jobId, name: "Escrow", quantity: "1", unitAmount: { currencyCode: "USD", value: o.value } }],
        payments: { captures: [{ id: o.captureId ?? "3C679366HH908993F", status: o.status ?? "COMPLETED", amount: { currencyCode: "USD", value: o.value },
          sellerReceivableBreakdown: { grossAmount: { currencyCode: "USD", value: o.value }, paypalFee: { currencyCode: "USD", value: "11.36" } } }] },
      },
    ],
  }) as Order;

let db: DB;
let jobId: string;
beforeEach(() => {
  db = openDb(":memory:");
  const r = createJob(db, { title: "Bakery page", brief: "x".repeat(40), budgetCents: 300_00, buyerName: "Bea", buyerEmail: "bea@example.com", biddingHours: 72 });
  if (!r.ok) throw new Error(r.error);
  jobId = r.data.jobId;
});

describe("fundJobFromOrder", () => {
  it("opens the job from a completed capture of the budget", () => {
    expect(fundJobFromOrder(db, jobId, order({ jobId, value: "311.36" }))).toEqual({ ok: true, data: { captureId: "3C679366HH908993F" } });
    expect(getJob(db, jobId)).toMatchObject({ status: "open", captureId: "3C679366HH908993F", paypalOrderId: "5O190127TN364715T" });
    expect(paymentsFor(db, jobId)).toMatchObject([
      { kind: "escrow_capture", amountCents: 300_00, paypalFeeCents: 11_36 },
      { kind: "processing_fee", amountCents: 11_36 },
    ]);
  });

  it("rejects a payment for another job, a pending capture, or the wrong amount", () => {
    expect(fundJobFromOrder(db, jobId, order({ jobId: "j_other00000", value: "311.36" }))).toMatchObject({ ok: false, error: /different job/ });
    expect(fundJobFromOrder(db, jobId, order({ jobId, value: "311.36", status: "PENDING" }))).toMatchObject({ ok: false, error: /PENDING/ });
    expect(fundJobFromOrder(db, jobId, order({ jobId, value: "300.00" }))).toMatchObject({ ok: false, error: /total is/ });
    expect(getJob(db, jobId)!.status).toBe("awaiting_payment");
  });

  it("itemizes escrow and processing separately on the PayPal order", () => {
    expect(escrowLineItems(getJob(db, jobId)!)).toMatchObject([
      { sku: jobId, unitPriceCents: 300_00, quantity: 1 },
      { sku: `${jobId}-processing`, unitPriceCents: 11_36, name: /non-refundable/ },
    ]);
  });

  it("declines non-US payers before capture (PayPal's cross-border fee isn't in the quote)", () => {
    expect(payerProblem(order({ jobId, value: "311.36" }))).toBeNull();
    expect(payerProblem(order({ jobId, value: "311.36", country: "IN" }))).toMatch(/US PayPal accounts.*haven't been charged/);
  });
});
