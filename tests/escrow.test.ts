import type { Order } from "@paypal/paypal-server-sdk";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type DB } from "@/lib/db";
import { escrowLineItem, fundJobFromOrder } from "@/lib/escrow";
import { createJob, getJob } from "@/lib/market";

// Shape of a real captured order (prefer: return=representation), trimmed.
const order = (o: { jobId: string; value: string; status?: string; captureId?: string }) =>
  ({
    id: "5O190127TN364715T",
    status: "COMPLETED",
    purchaseUnits: [
      {
        customId: o.jobId,
        items: [{ sku: o.jobId, name: "Escrow", quantity: "1", unitAmount: { currencyCode: "USD", value: o.value } }],
        payments: { captures: [{ id: o.captureId ?? "3C679366HH908993F", status: o.status ?? "COMPLETED", amount: { currencyCode: "USD", value: o.value } }] },
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
    expect(fundJobFromOrder(db, jobId, order({ jobId, value: "300.00" }))).toEqual({ ok: true, data: { captureId: "3C679366HH908993F" } });
    expect(getJob(db, jobId)).toMatchObject({ status: "open", captureId: "3C679366HH908993F", paypalOrderId: "5O190127TN364715T" });
  });

  it("rejects a payment for another job, a pending capture, or the wrong amount", () => {
    expect(fundJobFromOrder(db, jobId, order({ jobId: "j_other00000", value: "300.00" }))).toMatchObject({ ok: false, error: /different job/ });
    expect(fundJobFromOrder(db, jobId, order({ jobId, value: "300.00", status: "PENDING" }))).toMatchObject({ ok: false, error: /PENDING/ });
    expect(fundJobFromOrder(db, jobId, order({ jobId, value: "3.00" }))).toMatchObject({ ok: false, error: /budget/ });
    expect(getJob(db, jobId)!.status).toBe("awaiting_payment");
  });

  it("puts the job ID on the PayPal line item", () => {
    expect(escrowLineItem(getJob(db, jobId)!)).toMatchObject({ sku: jobId, unitPriceCents: 300_00, quantity: 1 });
  });
});
