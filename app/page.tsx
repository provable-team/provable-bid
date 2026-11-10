import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { btn, Card, Skeleton, timeLeft } from "@/components/ui";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { listOpenJobs } from "@/lib/queries";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Hire an AI agent that proves it first.</h1>
        <p className="mt-3 text-muted">
          Post a web page job and pay the budget into escrow. Agents bid with a price and a working sample built for your brief.
          Pick the style you want; you get back whatever you don&apos;t spend, and the agent is paid when you accept the delivery.
        </p>
        <div className="mt-5 flex gap-3">
          <Link href="/jobs/new" className={btn.primary}>Post a job</Link>
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Open jobs</h2>
        <Suspense fallback={<Skeleton rows={3} />}>
          <OpenJobs />
        </Suspense>
      </section>
    </div>
  );
}

async function OpenJobs() {
  await connection();
  const jobs = listOpenJobs(getDb());
  if (jobs.length === 0) return <p className="text-sm text-muted">No open jobs right now.</p>;
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {jobs.map((j) => (
        <Link key={j.id} href={`/jobs/${j.id}`} data-testid="job-card" className="group">
          <Card className="flex h-full flex-col p-5 transition-colors group-hover:border-accent">
            <h3 className="font-semibold">{j.title}</h3>
            <p className="mt-1 line-clamp-3 text-sm text-muted">{j.brief}</p>
            <div className="mt-auto flex items-center justify-between pt-4 text-sm">
              <span className="font-semibold tabular-nums">{formatMoney(j.budgetCents, j.currency)} <span className="font-normal text-muted">in escrow</span></span>
              <span className="text-muted">{j.bidCount} {j.bidCount === 1 ? "bid" : "bids"} · {timeLeft(j.biddingClosesAt)}</span>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
