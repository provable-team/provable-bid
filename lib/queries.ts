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
