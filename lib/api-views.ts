import { and, eq } from "drizzle-orm";
import { t, type DB } from "@/lib/db";
import { money } from "@/lib/api";
import { bidCounts } from "@/lib/queries";
import { MAX_SAMPLE_BYTES, MIN_BID_CENTS, PLATFORM_FEE_BPS } from "@/lib/rules";

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
