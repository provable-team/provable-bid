import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, t, type DB } from "@/lib/db";
import {
  acceptDelivery, agentByToken, awardBid, buyerOwns, cancelJob, createJob, createOperatorSession, endOperatorSession, executePayment,
  markFunded, operatorBySession, paymentsFor, placeBid, registerAgent, requestRevision, rotateAgentToken, submitDelivery, syncPayment,
  upsertOperator, withdrawBid, type PaymentRail,
} from "@/lib/market";
import { escrowBalance, processingFeeFor } from "@/lib/rules";

// A fake PayPal that records calls. Real refunds/payouts are verified against the sandbox separately.
function fakeRail() {
  const calls: { op: string; key: string; amountCents?: number; to?: string }[] = [];
  const state = { failNext: false, payoutItemStatus: "PENDING" as string | null };
  const rail: PaymentRail = {
    async refund(o) {
      if (state.failNext) { state.failNext = false; throw new Error("PayPal 500: INTERNAL_SERVER_ERROR"); }
      calls.push({ op: "refund", key: o.idempotencyKey, amountCents: o.amountCents });
      return { refundId: `R-${o.idempotencyKey}`, status: "COMPLETED" };
    },
    async refundStatus() { return "COMPLETED"; },
    async payout(o) {
      if (state.failNext) { state.failNext = false; throw new Error("PayPal 422: INSUFFICIENT_FUNDS"); }
      calls.push({ op: "payout", key: o.batchId, amountCents: o.amountCents, to: o.payerId });
      return { batchId: `PB-${o.batchId}`, status: "PENDING" };
    },
    async payoutStatus() { return { batchStatus: "SUCCESS", itemStatus: state.payoutItemStatus }; },
    describeError: (e) => (e instanceof Error ? e.message : String(e)),
  };
  return { rail, calls, state };
}

const T0 = new Date("2026-11-10T12:00:00Z");
const at = (hours: number) => new Date(T0.getTime() + hours * 3_600_000);
const sample = "<!doctype html><h1>Sample</h1>";

let db: DB;
let fake: ReturnType<typeof fakeRail>;
let jobId: string;
let buyerKey: string;
let alice: { agentId: string; token: string };
let bob: { agentId: string; token: string };

const TOTAL = 300_00 + processingFeeFor(300_00);
function fund(id = jobId, amountCents = TOTAL) {
  return markFunded(db, id, { paypalOrderId: `O-${id}`, captureId: `C-${id}`, amountCents, currency: "USD" }, T0);
}
const ok = <T,>(r: { ok: true; data: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

beforeEach(() => {
  db = openDb(":memory:");
  fake = fakeRail();
  const ann = upsertOperator(db, { paypalPayerId: "PAYERANN0001", paypalEmail: "ann@example.com", name: "Ann Operator" });
  const ben = upsertOperator(db, { paypalPayerId: "PAYERBEN0002", paypalEmail: "ben@example.com", name: "Ben Operator" });
  alice = ok(registerAgent(db, ann.id, { handle: "alice", name: "Alice Agent" }));
  bob = ok(registerAgent(db, ben.id, { handle: "bob", name: "Bob Bot" }));
  ({ jobId, buyerKey } = ok(createJob(db, { title: "Bakery landing page", brief: "Warm, handmade.", budgetCents: 300_00, buyerName: "Bea", buyerEmail: "bea@example.com", biddingHours: 72 }, T0)));
});

describe("agents and buyers", () => {
  it("authenticates agents by token and rejects duplicates", () => {
    expect(agentByToken(db, alice.token)?.handle).toBe("alice");
    expect(agentByToken(db, "pb_nope")).toBeUndefined();
    const opId = agentByToken(db, alice.token)!.operatorId;
    expect(registerAgent(db, opId, { handle: "alice", name: "x" })).toEqual({ ok: false, error: "The handle @alice is taken." });
  });

  it("identifies an operator by PayPal payer ID, not by email", () => {
    const again = upsertOperator(db, { paypalPayerId: "PAYERANN0001", paypalEmail: "ann.new@example.com", name: "Ann O." });
    expect(again.id).toBe(agentByToken(db, alice.token)!.operatorId);
    expect(db.select().from(t.operators).all()).toHaveLength(2);
  });

  it("rotates an agent token and only lets its own operator do it", () => {
    const opId = agentByToken(db, alice.token)!.operatorId;
    const other = agentByToken(db, bob.token)!.operatorId;
    expect(rotateAgentToken(db, other, alice.agentId)).toEqual({ ok: false, error: "Agent not found." });
    const { token } = ok(rotateAgentToken(db, opId, alice.agentId));
    expect(agentByToken(db, alice.token)).toBeUndefined();
    expect(agentByToken(db, token)?.handle).toBe("alice");
  });

  it("expires and ends operator sessions", () => {
    const opId = agentByToken(db, alice.token)!.operatorId;
    const s = createOperatorSession(db, opId, T0);
    expect(operatorBySession(db, s, at(24))?.id).toBe(opId);
    expect(operatorBySession(db, s, at(31 * 24))).toBeUndefined();
    endOperatorSession(db, s);
    expect(operatorBySession(db, s, at(1))).toBeUndefined();
  });

  it("checks the buyer key", () => {
    expect(buyerOwns(db, jobId, buyerKey)).toBe(true);
    expect(buyerOwns(db, jobId, "bk_wrong")).toBe(false);
    expect(buyerOwns(db, jobId, undefined)).toBe(false);
  });
});

describe("funding", () => {
  it("opens the job only after a capture of exactly the budget", () => {
    expect(placeBid(db, alice.agentId, jobId, { priceCents: 200_00, deliveryHours: 24, pitch: "hi", sampleHtml: sample }, T0)).toEqual({ ok: false, error: "This job isn't taking bids." });
    expect(fund(jobId, 300_00)).toMatchObject({ ok: false, error: /total is 31136/ }); // budget alone isn't enough
    expect(fund()).toEqual({ ok: true, data: { status: "open" } });
    expect(fund()).toEqual({ ok: true, data: { status: "open" } }); // idempotent on capture ID
    expect(paymentsFor(db, jobId).map((p) => [p.kind, p.amountCents])).toEqual([["escrow_capture", 300_00], ["processing_fee", 11_36]]);
    expect(escrowBalance(paymentsFor(db, jobId))).toBe(300_00); // processing is the platform's, not escrow
  });
});

describe("bidding", () => {
  beforeEach(() => void fund());

  it("keeps one bid per agent; re-bidding updates it", () => {
    const first = ok(placeBid(db, alice.agentId, jobId, { priceCents: 250_00, deliveryHours: 24, pitch: "v1", sampleHtml: sample }, T0));
    const second = ok(placeBid(db, alice.agentId, jobId, { priceCents: 220_00, deliveryHours: 24, pitch: "v2", sampleHtml: sample }, at(1)));
    expect(second).toEqual({ bidId: first.bidId, updated: true });
    expect(db.select().from(t.bids).all()).toMatchObject([{ priceCents: 220_00, pitch: "v2" }]);
  });

  it("rejects bids over budget or after bidding closes", () => {
    expect(placeBid(db, alice.agentId, jobId, { priceCents: 300_01, deliveryHours: 24, pitch: "x", sampleHtml: sample }, T0)).toMatchObject({ ok: false, error: /budget/ });
    expect(placeBid(db, alice.agentId, jobId, { priceCents: 100_00, deliveryHours: 24, pitch: "x", sampleHtml: sample }, at(73))).toMatchObject({ ok: false, error: /closed/ });
  });

  it("can't award a withdrawn bid", async () => {
    const { bidId } = ok(placeBid(db, alice.agentId, jobId, { priceCents: 100_00, deliveryHours: 24, pitch: "x", sampleHtml: sample }, T0));
    ok(withdrawBid(db, alice.agentId, jobId));
    expect(await awardBid(db, fake.rail, jobId, bidId, at(1))).toEqual({ ok: false, error: "That bid isn't available." });
  });
});

describe("happy path: award → deliver → revise → accept → payout", () => {
  it("moves every cent and ends with only the fee in escrow", async () => {
    fund();
    const a = ok(placeBid(db, alice.agentId, jobId, { priceCents: 240_00, deliveryHours: 48, pitch: "minimal", sampleHtml: sample }, T0));
    ok(placeBid(db, bob.agentId, jobId, { priceCents: 180_00, deliveryHours: 24, pitch: "bold", sampleHtml: sample }, T0));

    const award = ok(await awardBid(db, fake.rail, jobId, a.bidId, at(2)));
    expect(award.refundToBuyerCents).toBe(60_00);
    expect(award.refund).toMatchObject({ status: "succeeded", paypalId: `R-job-${jobId}-award-refund` });
    expect(db.select({ h: t.agents.handle, s: t.bids.status }).from(t.bids).innerJoin(t.agents, eq(t.agents.id, t.bids.agentId)).orderBy(t.agents.handle).all())
      .toEqual([{ h: "alice", s: "awarded" }, { h: "bob", s: "lost" }]);
    expect(await awardBid(db, fake.rail, jobId, a.bidId, at(2))).toMatchObject({ ok: false }); // no double award

    expect(submitDelivery(db, bob.agentId, jobId, { html: "<h1>nope</h1>" }, at(3))).toEqual({ ok: false, error: "Only the awarded agent can deliver this job." });
    ok(submitDelivery(db, alice.agentId, jobId, { html: "<h1>v1</h1>" }, at(10)));
    ok(requestRevision(db, jobId, "Bigger photos please", at(11)));
    expect(requestRevision(db, jobId, "again", at(11))).toMatchObject({ ok: false }); // not delivered yet
    ok(submitDelivery(db, alice.agentId, jobId, { html: "<h1>v2</h1>" }, at(20)));
    expect(requestRevision(db, jobId, "again", at(21))).toEqual({ ok: false, error: "The revision for this job has already been used." });

    const done = ok(await acceptDelivery(db, fake.rail, jobId, at(22)));
    expect(done).toMatchObject({ payoutToAgentCents: 228_00, feeCents: 12_00, payout: { status: "in_flight", recipient: "PAYERANN0001" } });
    expect(await acceptDelivery(db, fake.rail, jobId, at(22))).toMatchObject({ ok: false }); // no double payout

    const synced = await syncPayment(db, fake.rail, done.payout.id, at(23));
    expect(synced.status).toBe("in_flight"); // PENDING item
    fake.state.payoutItemStatus = "SUCCESS";
    expect((await syncPayment(db, fake.rail, done.payout.id, at(24))).status).toBe("succeeded");

    expect(fake.calls).toEqual([
      { op: "refund", key: `job-${jobId}-award-refund`, amountCents: 60_00 },
      { op: "payout", key: `job-${jobId}-payout`, amountCents: 228_00, to: "PAYERANN0001" },
    ]);
    expect(escrowBalance(paymentsFor(db, jobId))).toBe(12_00); // the platform's 5%
  });

  it("skips the refund when the winning price equals the budget", async () => {
    fund();
    const { bidId } = ok(placeBid(db, alice.agentId, jobId, { priceCents: 300_00, deliveryHours: 24, pitch: "x", sampleHtml: sample }, T0));
    expect(ok(await awardBid(db, fake.rail, jobId, bidId, at(1))).refund).toBeNull();
    expect(fake.calls).toEqual([]);
  });
});

describe("failures and cancellations", () => {
  it("keeps a failed PayPal call as a retryable pending row, and retries with the same key", async () => {
    fund();
    const { bidId } = ok(placeBid(db, alice.agentId, jobId, { priceCents: 200_00, deliveryHours: 24, pitch: "x", sampleHtml: sample }, T0));
    fake.state.failNext = true;
    const award = ok(await awardBid(db, fake.rail, jobId, bidId, at(1)));
    expect(award.refund).toMatchObject({ status: "pending", error: "PayPal 500: INTERNAL_SERVER_ERROR" });
    expect(escrowBalance(paymentsFor(db, jobId))).toBe(200_00); // pending refund still counts as leaving

    const retried = await executePayment(db, fake.rail, award.refund!.id, at(2));
    expect(retried).toMatchObject({ status: "succeeded", error: null });
    expect(fake.calls).toEqual([{ op: "refund", key: `job-${jobId}-award-refund`, amountCents: 100_00 }]);
  });

  it("refunds the full budget when cancelled before award", async () => {
    fund();
    ok(placeBid(db, alice.agentId, jobId, { priceCents: 200_00, deliveryHours: 24, pitch: "x", sampleHtml: sample }, T0));
    const c = ok(await cancelJob(db, fake.rail, jobId, at(1)));
    expect(c.refundCents).toBe(300_00);
    expect(escrowBalance(paymentsFor(db, jobId))).toBe(0);
    expect(db.select({ s: t.bids.status }).from(t.bids).all()).toEqual([{ s: "lost" }]);
  });

  it("cancels an unfunded job without touching PayPal", async () => {
    expect(ok(await cancelJob(db, fake.rail, jobId, T0))).toEqual({ refundCents: 0, refund: null });
    expect(fake.calls).toEqual([]);
  });

  it("refunds the rest of the escrow when the agent misses its delivery deadline", async () => {
    fund();
    const { bidId } = ok(placeBid(db, alice.agentId, jobId, { priceCents: 240_00, deliveryHours: 24, pitch: "x", sampleHtml: sample }, T0));
    ok(await awardBid(db, fake.rail, jobId, bidId, at(1)));
    expect(await cancelJob(db, fake.rail, jobId, at(24))).toMatchObject({ ok: false, error: /delivery window/ });
    const c = ok(await cancelJob(db, fake.rail, jobId, at(26)));
    expect(c.refundCents).toBe(240_00);
    expect(fake.calls.map((x) => x.amountCents)).toEqual([60_00, 240_00]);
    expect(escrowBalance(paymentsFor(db, jobId))).toBe(0);
  });
});
