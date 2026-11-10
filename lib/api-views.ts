import { and, eq } from "drizzle-orm";
import { t, type DB } from "@/lib/db";
import { money } from "@/lib/api";
import { bidCounts } from "@/lib/queries";
import type { assignmentFor } from "@/lib/market";
import { MAX_REVISIONS, MAX_SAMPLE_BYTES, MIN_BID_CENTS, PLATFORM_FEE_BPS } from "@/lib/rules";

type Job = typeof t.jobs.$inferSelect;
type Bid = typeof t.bids.$inferSelect;

// What agents see of a job. Never the buyer's contact details, never other agents' bids.
export function jobForAgents(db: DB, job: Job, origin: string) {
  return {
    id: job.id,
    title: job.title,
    brief: job.brief,
    status: job.status,
    budget: money(job.budgetCents, job.currency),
    escrowFunded: job.fundedAt !== null,
    biddingClosesAt: job.biddingClosesAt.toISOString(),
    bidCount: bidCounts(db, [job.id]).get(job.id) ?? 0,
    url: `${origin}/jobs/${job.id}`,
    rules: { minBid: money(MIN_BID_CENTS), platformFeePercent: PLATFORM_FEE_BPS / 100, maxSampleBytes: MAX_SAMPLE_BYTES },
  };
}

export function bidForAgent(bid: Bid) {
  return {
    id: bid.id,
    jobId: bid.jobId,
    status: bid.status,
    price: money(bid.priceCents),
    deliveryHours: bid.deliveryHours,
    pitch: bid.pitch,
    sampleBytes: Buffer.byteLength(bid.sampleHtml),
    updatedAt: bid.updatedAt.toISOString(),
  };
}

export function ownBid(db: DB, agentId: string, jobId: string) {
  return db.select().from(t.bids).where(and(eq(t.bids.agentId, agentId), eq(t.bids.jobId, jobId))).get();
}

// The awarded agent's view: deadline, the buyer's revision request, and where its money stands.
export function assignmentView(a: NonNullable<ReturnType<typeof assignmentFor>>) {
  const { job, latest, payout } = a;
  return {
    status: job.status, // awarded = deliver (or re-deliver); delivered = buyer reviewing; completed = paid
    deliveryDueAt: job.deliveryDueAt?.toISOString() ?? null,
    deliveries: a.deliveryCount,
    revisionRequest: job.status === "awarded" ? (latest?.revisionRequest ?? null) : null,
    revisionsLeft: MAX_REVISIONS - job.revisionsUsed,
    payout: {
      amount: money(a.payoutToAgentCents, job.currency),
      platformFee: money(a.feeCents, job.currency),
      status: payout ? payout.status : "not_released", // pending | in_flight | succeeded | failed
      paypalBatchId: payout?.paypalId ?? null,
    },
  };
}
