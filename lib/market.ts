// Marketplace operations. Plain functions over `db`; PayPal is reached through a PaymentRail
// so the money flow is testable without the network. Server Actions and the agent API stay thin.
import { and, desc, eq, inArray, lte, ne, sql } from "drizzle-orm";
import { t, type DB } from "@/lib/db";
import type { PaymentKind } from "@/lib/db/schema";
import { hashSecret, newId, newSecret } from "@/lib/ids";
import {
  AUTO_RELEASE_HOURS,
  blockedReason,
  checkBidPrice,
  escrowBalance,
  MAX_BUDGET_CENTS,
  MIN_BUDGET_CENTS,
  quoteFor,
  settlementFor,
  statusForPayout,
  statusForRefund,
  type JobSnapshot,
} from "@/lib/rules";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

export interface PaymentRail {
  refund(o: { captureId: string; amountCents: number; currency: string; note: string; idempotencyKey: string }): Promise<{ refundId: string; status: string }>;
  refundStatus(refundId: string): Promise<string>;
  payout(o: { batchId: string; payerId: string; amountCents: number; currency: string; subject: string; note: string }): Promise<{ batchId: string; status: string }>;
  payoutStatus(batchId: string): Promise<{ batchStatus: string; itemStatus: string | null; error?: string; feeCents?: number }>;
  describeError(err: unknown): string;
}

const HOUR = 3_600_000;

function logEvent(db: DB, jobId: string, type: string, detail = "") {
  db.insert(t.jobEvents).values({ jobId, type, detail }).run();
}

export function getJob(db: DB, jobId: string) {
  return db.select().from(t.jobs).where(eq(t.jobs.id, jobId)).get();
}

const snapshot = (j: NonNullable<ReturnType<typeof getJob>>): JobSnapshot => ({
  status: j.status,
  biddingClosesAt: j.biddingClosesAt,
  deliveryDueAt: j.deliveryDueAt,
  revisionsUsed: j.revisionsUsed,
});

export function buyerOwns(db: DB, jobId: string, buyerKey: string | undefined): boolean {
  if (!buyerKey) return false;
  return getJob(db, jobId)?.buyerKeyHash === hashSecret(buyerKey);
}

// ---------------------------------------------------------------- operators and agents

const SESSION_DAYS = 30;

// Called after "Log in with PayPal". The payer ID is PayPal-verified, so it's the identity and the payout target.
export function upsertOperator(db: DB, o: { paypalPayerId: string; paypalEmail: string | null; name: string }) {
  const existing = db.select().from(t.operators).where(eq(t.operators.paypalPayerId, o.paypalPayerId)).get();
  if (existing) {
    db.update(t.operators).set({ paypalEmail: o.paypalEmail, name: o.name }).where(eq(t.operators.id, existing.id)).run();
    return { ...existing, ...o };
  }
  const row = { id: newId("o"), ...o };
  db.insert(t.operators).values(row).run();
  return row;
}

export function createOperatorSession(db: DB, operatorId: string, now = new Date()) {
  const token = newSecret("os");
  db.insert(t.operatorSessions).values({ tokenHash: hashSecret(token), operatorId, expiresAt: new Date(now.getTime() + SESSION_DAYS * 24 * HOUR) }).run();
  return token;
}

export function operatorBySession(db: DB, token: string | undefined, now = new Date()) {
  if (!token) return undefined;
  const row = db
    .select({ op: t.operators, expiresAt: t.operatorSessions.expiresAt })
    .from(t.operatorSessions)
    .innerJoin(t.operators, eq(t.operators.id, t.operatorSessions.operatorId))
    .where(eq(t.operatorSessions.tokenHash, hashSecret(token)))
    .get();
  return row && row.expiresAt > now ? row.op : undefined;
}

export function endOperatorSession(db: DB, token: string) {
  db.delete(t.operatorSessions).where(eq(t.operatorSessions.tokenHash, hashSecret(token))).run();
}

export function registerAgent(
  db: DB,
  operatorId: string,
  a: { handle: string; name: string; bio?: string; homepageUrl?: string | null },
  fixedToken?: string, // only for the seeded demo agent, whose DB is wiped on every Render restart
): Result<{ agentId: string; token: string }> {
  if (db.select({ id: t.agents.id }).from(t.agents).where(eq(t.agents.handle, a.handle)).get())
    return fail(`The handle @${a.handle} is taken.`);
  const token = fixedToken ?? newSecret("pb");
  const agentId = newId("a");
  db.insert(t.agents)
    .values({ id: agentId, operatorId, handle: a.handle, name: a.name, bio: a.bio ?? "", homepageUrl: a.homepageUrl ?? null, tokenHash: hashSecret(token) })
    .run();
  return { ok: true, data: { agentId, token } };
}

// New token for an agent; the old one stops working immediately.
export function rotateAgentToken(db: DB, operatorId: string, agentId: string): Result<{ token: string }> {
  const agent = db.select().from(t.agents).where(and(eq(t.agents.id, agentId), eq(t.agents.operatorId, operatorId))).get();
  if (!agent) return fail("Agent not found.");
  const token = newSecret("pb");
  db.update(t.agents).set({ tokenHash: hashSecret(token) }).where(eq(t.agents.id, agentId)).run();
  return { ok: true, data: { token } };
}

export function agentByToken(db: DB, token: string | null | undefined) {
  if (!token) return undefined;
  return db.select().from(t.agents).where(eq(t.agents.tokenHash, hashSecret(token))).get();
}

// ---------------------------------------------------------------- jobs

export function createJob(
  db: DB,
  j: { title: string; brief: string; budgetCents: number; buyerName: string; buyerEmail: string; biddingHours: number },
  now = new Date(),
): Result<{ jobId: string; buyerKey: string }> {
  if (!Number.isInteger(j.budgetCents) || j.budgetCents < MIN_BUDGET_CENTS || j.budgetCents > MAX_BUDGET_CENTS)
    return fail(`Budget must be between $${MIN_BUDGET_CENTS / 100} and $${MAX_BUDGET_CENTS / 100}.`);
  const jobId = newId("j");
  const buyerKey = newSecret("bk");
  db.insert(t.jobs)
    .values({
      id: jobId,
      title: j.title,
      brief: j.brief,
      budgetCents: j.budgetCents,
      processingFeeCents: quoteFor(j.budgetCents).processingFeeCents,
      buyerName: j.buyerName,
      buyerEmail: j.buyerEmail,
      buyerKeyHash: hashSecret(buyerKey),
      biddingClosesAt: new Date(now.getTime() + j.biddingHours * HOUR),
    })
    .run();
  logEvent(db, jobId, "posted", `budget ${j.budgetCents}`);
  return { ok: true, data: { jobId, buyerKey } };
}

export function attachOrder(db: DB, jobId: string, paypalOrderId: string) {
  db.update(t.jobs).set({ paypalOrderId }).where(eq(t.jobs.id, jobId)).run();
}

// Called with a COMPLETED PayPal capture of budget + processing fee. Idempotent on the capture ID.
// Records two ledger lines: the budget (escrow, buyer's money) and the processing fee (platform's).
export function markFunded(
  db: DB,
  jobId: string,
  c: { paypalOrderId: string; captureId: string; amountCents: number; currency: string; paypalFeeCents?: number | null },
  now = new Date(),
): Result<{ status: "open" }> {
  return db.transaction((tx) => {
    const job = getJob(tx as unknown as DB, jobId);
    if (!job) return fail("Job not found.");
    if (job.captureId === c.captureId) return { ok: true as const, data: { status: "open" as const } };
    const blocked = blockedReason(snapshot(job), "fund", now);
    if (blocked) return fail(blocked);
    const expected = job.budgetCents + job.processingFeeCents;
    if (c.amountCents !== expected || c.currency !== job.currency)
      return fail(`Captured ${c.amountCents} ${c.currency} but this job's total is ${expected} ${job.currency}.`);
    tx.update(t.jobs)
      .set({ status: "open", paypalOrderId: c.paypalOrderId, captureId: c.captureId, fundedAt: now })
      .where(eq(t.jobs.id, jobId))
      .run();
    const base = { jobId, currency: c.currency, status: "succeeded" as const, paypalId: c.captureId, paypalStatus: "COMPLETED", updatedAt: now };
    tx.insert(t.payments)
      .values([
        { ...base, kind: "escrow_capture", amountCents: job.budgetCents, idempotencyKey: `job-${jobId}-capture`, paypalFeeCents: c.paypalFeeCents ?? null },
        { ...base, kind: "processing_fee", amountCents: job.processingFeeCents, idempotencyKey: `job-${jobId}-processing` },
      ])
      .run();
    logEvent(tx as unknown as DB, jobId, "funded", `capture ${c.captureId}`);
    return { ok: true as const, data: { status: "open" as const } };
  });
}

// ---------------------------------------------------------------- bids

export function placeBid(
  db: DB,
  agentId: string,
  jobId: string,
  b: { priceCents: number; deliveryHours: number; pitch: string; sampleHtml: string },
  now = new Date(),
): Result<{ bidId: string; updated: boolean }> {
  const job = getJob(db, jobId);
  if (!job) return fail("Job not found.");
  const blocked = blockedReason(snapshot(job), "bid", now);
  if (blocked) return fail(blocked);
  const priceErr = checkBidPrice(job.budgetCents, b.priceCents);
  if (priceErr) return fail(priceErr);

  const existing = db.select().from(t.bids).where(and(eq(t.bids.jobId, jobId), eq(t.bids.agentId, agentId))).get();
  if (existing) {
    db.update(t.bids).set({ ...b, status: "active", updatedAt: now }).where(eq(t.bids.id, existing.id)).run();
    logEvent(db, jobId, "bid_updated", existing.id);
    return { ok: true, data: { bidId: existing.id, updated: true } };
  }
  const bidId = newId("b");
  db.insert(t.bids).values({ id: bidId, jobId, agentId, ...b, updatedAt: now }).run();
  logEvent(db, jobId, "bid_placed", bidId);
  return { ok: true, data: { bidId, updated: false } };
}

export function withdrawBid(db: DB, agentId: string, jobId: string): Result<{ bidId: string }> {
  const job = getJob(db, jobId);
  if (!job) return fail("Job not found.");
  if (job.status !== "open") return fail("Bids can only be withdrawn while the job is open.");
  const bid = db.select().from(t.bids).where(and(eq(t.bids.jobId, jobId), eq(t.bids.agentId, agentId))).get();
  if (!bid || bid.status !== "active") return fail("You have no active bid on this job.");
  db.update(t.bids).set({ status: "withdrawn" }).where(eq(t.bids.id, bid.id)).run();
  logEvent(db, jobId, "bid_withdrawn", bid.id);
  return { ok: true, data: { bidId: bid.id } };
}

// ---------------------------------------------------------------- money movements

function recordPayment(
  db: DB,
  p: { jobId: string; kind: Exclude<PaymentKind, "escrow_capture">; amountCents: number; currency: string; idempotencyKey: string; recipient?: string },
): number {
  return db.insert(t.payments).values(p).returning({ id: t.payments.id }).get().id;
}

// Run one pending refund/payout against PayPal and record the outcome.
// On a PayPal error the row stays `pending` with the error, so it can be retried with the same idempotency key.
export async function executePayment(db: DB, rail: PaymentRail, paymentId: number, now = new Date()) {
  const p = db.select().from(t.payments).where(eq(t.payments.id, paymentId)).get();
  if (!p) throw new Error(`Payment ${paymentId} not found`);
  if (p.status !== "pending") return p;
  const job = getJob(db, p.jobId)!;
  try {
    if (p.kind === "refund") {
      const r = await rail.refund({
        captureId: job.captureId!, amountCents: p.amountCents, currency: p.currency, idempotencyKey: p.idempotencyKey,
        note: `provable.bid: refund for "${job.title}"`,
      });
      db.update(t.payments)
        .set({ status: statusForRefund(r.status), paypalId: r.refundId, paypalStatus: r.status, error: null, updatedAt: now })
        .where(eq(t.payments.id, p.id)).run();
    } else if (p.kind === "payout") {
      const r = await rail.payout({
        batchId: p.idempotencyKey, payerId: p.recipient!, amountCents: p.amountCents, currency: p.currency,
        subject: `You were paid for "${job.title}"`,
        note: `The buyer accepted your delivery on provable.bid. Job ${job.id}.`,
      });
      // A new batch is always PENDING; sync later to see SUCCESS / UNCLAIMED.
      db.update(t.payments)
        .set({ status: "in_flight", paypalId: r.batchId, paypalStatus: r.status, error: null, updatedAt: now })
        .where(eq(t.payments.id, p.id)).run();
    }
    logEvent(db, p.jobId, `${p.kind}_sent`, `${p.amountCents}`);
  } catch (err) {
    const error = rail.describeError(err);
    db.update(t.payments).set({ error, updatedAt: now }).where(eq(t.payments.id, p.id)).run();
    logEvent(db, p.jobId, `${p.kind}_error`, error);
  }
  return db.select().from(t.payments).where(eq(t.payments.id, p.id)).get()!;
}

// Ask PayPal where an in-flight refund/payout stands now.
export async function syncPayment(db: DB, rail: PaymentRail, paymentId: number, now = new Date()) {
  const p = db.select().from(t.payments).where(eq(t.payments.id, paymentId)).get();
  if (!p) throw new Error(`Payment ${paymentId} not found`);
  if (p.status !== "in_flight" || !p.paypalId) return p;
  try {
    let status, paypalStatus, error: string | null = null, paypalFeeCents = p.paypalFeeCents;
    if (p.kind === "refund") {
      paypalStatus = await rail.refundStatus(p.paypalId);
      status = statusForRefund(paypalStatus);
    } else {
      const r = await rail.payoutStatus(p.paypalId);
      paypalStatus = r.itemStatus ?? r.batchStatus;
      status = statusForPayout(r.itemStatus, r.batchStatus);
      error = r.error ?? null;
      paypalFeeCents = r.feeCents ?? paypalFeeCents;
    }
    if (status !== p.status || paypalStatus !== p.paypalStatus || error !== p.error || paypalFeeCents !== p.paypalFeeCents) {
      db.update(t.payments).set({ status, paypalStatus, error, paypalFeeCents, updatedAt: now }).where(eq(t.payments.id, p.id)).run();
      if (status !== p.status) logEvent(db, p.jobId, `${p.kind}_${status}`, paypalStatus);
    }
  } catch (err) {
    db.update(t.payments).set({ error: rail.describeError(err), updatedAt: now }).where(eq(t.payments.id, p.id)).run();
  }
  return db.select().from(t.payments).where(eq(t.payments.id, p.id)).get()!;
}

export function paymentsFor(db: DB, jobId: string) {
  return db.select().from(t.payments).where(eq(t.payments.jobId, jobId)).orderBy(t.payments.id).all();
}

// ---------------------------------------------------------------- award → deliver → accept

export async function awardBid(db: DB, rail: PaymentRail, jobId: string, bidId: string, now = new Date()) {
  const step = db.transaction((tx) => {
    const d = tx as unknown as DB;
    const job = getJob(d, jobId);
    if (!job) return fail("Job not found.");
    const blocked = blockedReason(snapshot(job), "award", now);
    if (blocked) return fail(blocked);
    const bid = d.select().from(t.bids).where(and(eq(t.bids.id, bidId), eq(t.bids.jobId, jobId))).get();
    if (!bid || bid.status !== "active") return fail("That bid isn't available.");

    const { refundToBuyerCents } = settlementFor(job.budgetCents, bid.priceCents);
    d.update(t.jobs)
      .set({ status: "awarded", awardedBidId: bid.id, awardedAt: now, deliveryDueAt: new Date(now.getTime() + bid.deliveryHours * HOUR) })
      .where(eq(t.jobs.id, jobId)).run();
    d.update(t.bids).set({ status: "awarded" }).where(eq(t.bids.id, bid.id)).run();
    d.update(t.bids).set({ status: "lost" }).where(and(eq(t.bids.jobId, jobId), ne(t.bids.id, bid.id), eq(t.bids.status, "active"))).run();
    logEvent(d, jobId, "awarded", bid.id);
    const refundId = refundToBuyerCents > 0
      ? recordPayment(d, { jobId, kind: "refund", amountCents: refundToBuyerCents, currency: job.currency, idempotencyKey: `job-${jobId}-award-refund` })
      : null;
    return { ok: true as const, data: { refundId, refundToBuyerCents } };
  });
  if (!step.ok) return step;
  const refund = step.data.refundId ? await executePayment(db, rail, step.data.refundId, now) : null;
  return { ok: true as const, data: { refundToBuyerCents: step.data.refundToBuyerCents, refund } };
}

export function submitDelivery(db: DB, agentId: string, jobId: string, d: { html: string; note?: string }, now = new Date()): Result<{ deliveryId: number }> {
  const job = getJob(db, jobId);
  if (!job) return fail("Job not found.");
  const bid = job.awardedBidId ? db.select().from(t.bids).where(eq(t.bids.id, job.awardedBidId)).get() : undefined;
  if (!bid || bid.agentId !== agentId) return fail("Only the awarded agent can deliver this job.");
  const blocked = blockedReason(snapshot(job), "deliver", now);
  if (blocked) return fail(blocked);
  const deliveryId = db.insert(t.deliveries).values({ jobId, bidId: bid.id, html: d.html, note: d.note ?? "" }).returning({ id: t.deliveries.id }).get().id;
  db.update(t.jobs).set({ status: "delivered", deliveredAt: now }).where(eq(t.jobs.id, jobId)).run();
  logEvent(db, jobId, "delivered", String(deliveryId));
  return { ok: true, data: { deliveryId } };
}

export function latestDelivery(db: DB, jobId: string) {
  return db.select().from(t.deliveries).where(eq(t.deliveries.jobId, jobId)).orderBy(desc(t.deliveries.id)).get();
}

export function requestRevision(db: DB, jobId: string, request: string, now = new Date()): Result<{ deliveryDueAt: Date }> {
  const job = getJob(db, jobId);
  if (!job) return fail("Job not found.");
  const blocked = blockedReason(snapshot(job), "request_revision", now);
  if (blocked) return fail(blocked);
  const bid = db.select().from(t.bids).where(eq(t.bids.id, job.awardedBidId!)).get()!;
  const deliveryDueAt = new Date(now.getTime() + bid.deliveryHours * HOUR);
  db.update(t.deliveries).set({ revisionRequest: request }).where(eq(t.deliveries.id, latestDelivery(db, jobId)!.id)).run();
  db.update(t.jobs).set({ status: "awarded", revisionsUsed: job.revisionsUsed + 1, deliveryDueAt }).where(eq(t.jobs.id, jobId)).run();
  logEvent(db, jobId, "revision_requested", request.slice(0, 200));
  return { ok: true, data: { deliveryDueAt } };
}

export async function acceptDelivery(db: DB, rail: PaymentRail, jobId: string, now = new Date(), o: { auto?: boolean } = {}) {
  const step = db.transaction((tx) => {
    const d = tx as unknown as DB;
    const job = getJob(d, jobId);
    if (!job) return fail("Job not found.");
    const blocked = blockedReason(snapshot(job), "accept", now);
    if (blocked) return fail(blocked);
    const bid = d.select().from(t.bids).where(eq(t.bids.id, job.awardedBidId!)).get()!;
    const operator = d
      .select({ payerId: t.operators.paypalPayerId })
      .from(t.agents)
      .innerJoin(t.operators, eq(t.operators.id, t.agents.operatorId))
      .where(eq(t.agents.id, bid.agentId))
      .get()!;
    const { payoutToAgentCents, feeCents } = settlementFor(job.budgetCents, bid.priceCents);
    d.update(t.jobs).set({ status: "completed", completedAt: now }).where(eq(t.jobs.id, jobId)).run();
    logEvent(d, jobId, o.auto ? "auto_accepted" : "accepted", `payout ${payoutToAgentCents}, fee ${feeCents}`);
    const payoutId = recordPayment(d, {
      jobId, kind: "payout", amountCents: payoutToAgentCents, currency: job.currency,
      idempotencyKey: `job-${jobId}-payout`, recipient: operator.payerId,
    });
    return { ok: true as const, data: { payoutId, payoutToAgentCents, feeCents } };
  });
  if (!step.ok) return step;
  const payout = await executePayment(db, rail, step.data.payoutId, now);
  return { ok: true as const, data: { ...step.data, payout } };
}

// Cancel and refund whatever is still in escrow (all of it before award; the agent's price after a missed deadline).
export async function cancelJob(db: DB, rail: PaymentRail, jobId: string, now = new Date()) {
  const step = db.transaction((tx) => {
    const d = tx as unknown as DB;
    const job = getJob(d, jobId);
    if (!job) return fail("Job not found.");
    const blocked = blockedReason(snapshot(job), "cancel", now);
    if (blocked) return fail(blocked);
    const held = escrowBalance(paymentsFor(d, jobId));
    d.update(t.jobs).set({ status: "cancelled", cancelledAt: now }).where(eq(t.jobs.id, jobId)).run();
    d.update(t.bids).set({ status: "lost" }).where(and(eq(t.bids.jobId, jobId), ne(t.bids.status, "withdrawn"))).run();
    logEvent(d, jobId, "cancelled", `from ${job.status}, refunding ${held}`);
    const refundId = held > 0
      ? recordPayment(d, { jobId, kind: "refund", amountCents: held, currency: job.currency, idempotencyKey: `job-${jobId}-cancel-refund` })
      : null;
    return { ok: true as const, data: { refundId, refundCents: held } };
  });
  if (!step.ok) return step;
  const refund = step.data.refundId ? await executePayment(db, rail, step.data.refundId, now) : null;
  return { ok: true as const, data: { refundCents: step.data.refundCents, refund } };
}

// Bring every refund/payout on a job up to date: retry rows PayPal hasn't accepted yet (same idempotency key,
// so a retry can never pay twice) and ask PayPal about rows still in flight. Safe to call as often as you like.
export async function settleJob(db: DB, rail: PaymentRail, jobId: string, now = new Date()) {
  for (const p of paymentsFor(db, jobId)) {
    if (p.kind !== "refund" && p.kind !== "payout") continue;
    if (p.status === "pending") await executePayment(db, rail, p.id, now);
    else if (p.status === "in_flight") await syncPayment(db, rail, p.id, now);
  }
  return paymentsFor(db, jobId);
}

// What the winning agent needs to know about a job it was awarded.
export function assignmentFor(db: DB, jobId: string, agentId: string) {
  const job = getJob(db, jobId);
  if (!job?.awardedBidId) return null;
  const bid = db.select().from(t.bids).where(eq(t.bids.id, job.awardedBidId)).get();
  if (!bid || bid.agentId !== agentId) return null;
  const latest = latestDelivery(db, jobId);
  const payout = paymentsFor(db, jobId).find((p) => p.kind === "payout");
  const { payoutToAgentCents, feeCents } = settlementFor(job.budgetCents, bid.priceCents);
  return { job, bid, latest, payout, payoutToAgentCents, feeCents, deliveryCount: db.select({ id: t.deliveries.id }).from(t.deliveries).where(eq(t.deliveries.jobId, jobId)).all().length };
}

// Accept every delivery the buyer has left unanswered for AUTO_RELEASE_HOURS, so agents can't be stranded.
// Safe to run concurrently with a buyer's own accept: acceptDelivery re-checks the status in its transaction,
// and the payout's idempotency key is unique per job.
export async function releaseDueDeliveries(db: DB, rail: PaymentRail, now = new Date()) {
  const cutoff = new Date(now.getTime() - AUTO_RELEASE_HOURS * HOUR);
  const due = db.select({ id: t.jobs.id }).from(t.jobs).where(and(eq(t.jobs.status, "delivered"), lte(t.jobs.deliveredAt, cutoff))).all();
  const released: string[] = [];
  for (const { id } of due) {
    const r = await acceptDelivery(db, rail, id, now, { auto: true });
    if (r.ok) released.push(id);
  }
  return released;
}

// Follow up on refunds/payouts nobody is watching (e.g. an auto-released payout, or a buyer who closed the tab):
// retry unsent ones and sync in-flight ones. Rows touched in the last minute are left to whoever is handling them.
export async function settleStragglers(db: DB, rail: PaymentRail, now = new Date(), minAgeMs = 60_000) {
  const rows = db
    .select({ id: t.payments.id, status: t.payments.status })
    .from(t.payments)
    .where(and(inArray(t.payments.kind, ["refund", "payout"]), inArray(t.payments.status, ["pending", "in_flight"]), lte(sql`coalesce(${t.payments.updatedAt}, ${t.payments.createdAt})`, now.getTime() - minAgeMs)))
    .all();
  for (const p of rows) {
    if (p.status === "pending") await executePayment(db, rail, p.id, now);
    else await syncPayment(db, rail, p.id, now);
  }
  return rows.length;
}
