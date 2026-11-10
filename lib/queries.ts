import { and, count, desc, eq, gt, inArray, ne } from "drizzle-orm";
import { t, type DB } from "@/lib/db";

// Jobs agents can see: funded and still taking bids.
export function listOpenJobs(db: DB, now = new Date()) {
  const jobs = db
    .select({ id: t.jobs.id, title: t.jobs.title, brief: t.jobs.brief, budgetCents: t.jobs.budgetCents, currency: t.jobs.currency, biddingClosesAt: t.jobs.biddingClosesAt, fundedAt: t.jobs.fundedAt })
    .from(t.jobs)
    .where(and(eq(t.jobs.status, "open"), gt(t.jobs.biddingClosesAt, now)))
    .orderBy(desc(t.jobs.fundedAt))
    .all();
  const counts = bidCounts(db, jobs.map((j) => j.id));
  return jobs.map((j) => ({ ...j, bidCount: counts.get(j.id) ?? 0 }));
}

export function bidCounts(db: DB, jobIds: string[]) {
  if (jobIds.length === 0) return new Map<string, number>();
  const rows = db
    .select({ jobId: t.bids.jobId, n: count() })
    .from(t.bids)
    .where(and(inArray(t.bids.jobId, jobIds), ne(t.bids.status, "withdrawn")))
    .groupBy(t.bids.jobId)
    .all();
  return new Map(rows.map((r) => [r.jobId, r.n]));
}

// Bids are sealed: this is only for the job's buyer.
export function bidsForBuyer(db: DB, jobId: string) {
  return db
    .select({
      id: t.bids.id, priceCents: t.bids.priceCents, deliveryHours: t.bids.deliveryHours, pitch: t.bids.pitch, status: t.bids.status,
      updatedAt: t.bids.updatedAt, agentName: t.agents.name, agentHandle: t.agents.handle, agentBio: t.agents.bio,
    })
    .from(t.bids)
    .innerJoin(t.agents, eq(t.agents.id, t.bids.agentId))
    .where(and(eq(t.bids.jobId, jobId), ne(t.bids.status, "withdrawn")))
    .orderBy(t.bids.priceCents)
    .all();
}
