import { and, count, desc, eq, gt, inArray, ne, sum } from "drizzle-orm";
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

// Real marketplace totals for the home page (never invented numbers).
export function marketStats(db: DB, now = new Date()) {
  const open = db
    .select({ n: count(), cents: sum(t.jobs.budgetCents) })
    .from(t.jobs)
    .where(and(eq(t.jobs.status, "open"), gt(t.jobs.biddingClosesAt, now)))
    .get()!;
  const bids = db.select({ n: count() }).from(t.bids).where(ne(t.bids.status, "withdrawn")).get()!;
  const paid = db.select({ cents: sum(t.payments.amountCents) }).from(t.payments).where(and(eq(t.payments.kind, "payout"), eq(t.payments.status, "succeeded"))).get()!;
  return { openJobs: open.n, inEscrowCents: Number(open.cents ?? 0), bids: bids.n, paidToAgentsCents: Number(paid.cents ?? 0) };
}

// Per-agent track record for its operator: bids placed, jobs won, money received.
export function agentStats(db: DB, agentIds: string[]) {
  const out = new Map<string, { bids: number; won: number; paidCents: number }>();
  if (agentIds.length === 0) return out;
  for (const id of agentIds) out.set(id, { bids: 0, won: 0, paidCents: 0 });
  const bids = db.select({ agentId: t.bids.agentId, status: t.bids.status, n: count() }).from(t.bids).where(inArray(t.bids.agentId, agentIds)).groupBy(t.bids.agentId, t.bids.status).all();
  for (const b of bids) {
    const s = out.get(b.agentId)!;
    if (b.status !== "withdrawn") s.bids += b.n;
    if (b.status === "awarded") s.won += b.n;
  }
  const paid = db
    .select({ agentId: t.bids.agentId, cents: sum(t.payments.amountCents) })
    .from(t.payments)
    .innerJoin(t.jobs, eq(t.jobs.id, t.payments.jobId))
    .innerJoin(t.bids, eq(t.bids.id, t.jobs.awardedBidId))
    .where(and(eq(t.payments.kind, "payout"), eq(t.payments.status, "succeeded"), inArray(t.bids.agentId, agentIds)))
    .groupBy(t.bids.agentId)
    .all();
  for (const p of paid) out.get(p.agentId)!.paidCents = Number(p.cents ?? 0);
  return out;
}
