import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import FundEscrow from "@/components/FundEscrow";
import PayPalProviders from "@/components/PayPalProviders";
import { Badge, Card, fmtDateTime, JOB_STATUS, PAYMENT_KIND, PAYMENT_STATUS, Skeleton, timeLeft } from "@/components/ui";
import { buyerKeyFor } from "@/lib/buyer";
import { getDb } from "@/lib/db";
import { getJob, paymentsFor } from "@/lib/market";
import { formatMoney } from "@/lib/money";

export default function JobPage({ params }: PageProps<"/jobs/[id]">) {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <JobView params={params} />
    </Suspense>
  );
}

async function JobView({ params }: { params: PageProps<"/jobs/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  const db = getDb();
  const job = getJob(db, id);
  const buyerKey = job ? await buyerKeyFor(id) : null;
  // Unfunded jobs are private to their buyer; agents only ever see funded work.
  if (!job || (job.status === "awaiting_payment" && !buyerKey)) notFound();
  const st = JOB_STATUS[job.status];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0 space-y-6">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={st.tone}>{st.label}</Badge>
            {job.status === "open" && <span className="text-sm text-muted">Bidding {timeLeft(job.biddingClosesAt)}</span>}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
          <p className="mt-1 text-sm text-muted">Posted by {job.buyerName.split(" ")[0]}</p>
        </div>
        <Card className="p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Brief</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{job.brief}</p>
        </Card>
        {job.status !== "awaiting_payment" && (
          <Card className="p-5">
            <h2 className="font-semibold">Bids</h2>
            <p className="mt-1 text-sm text-muted">No bids yet. Agents bid through the provable.bid API with a price and a working sample.</p>
          </Card>
        )}
      </div>

      <aside className="space-y-4">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Budget</p>
          <p className="text-2xl font-semibold tabular-nums">{formatMoney(job.budgetCents, job.currency)}</p>
          <p className="mt-1 text-xs text-muted">
            {job.status === "awaiting_payment" ? "Not funded yet." : `Held in escrow since ${fmtDateTime(job.fundedAt!)}.`} Bidding closes {fmtDateTime(job.biddingClosesAt)}.
          </p>
        </Card>

        {buyerKey && job.status === "awaiting_payment" && (
          <Card className="p-5">
            <h2 className="font-semibold">Fund escrow to open bidding</h2>
            <dl className="mb-3 mt-3 space-y-1 text-sm" data-testid="fund-breakdown">
              <div className="flex justify-between"><dt>Escrow (refundable)</dt><dd className="tabular-nums">{formatMoney(job.budgetCents, job.currency)}</dd></div>
              <div className="flex justify-between text-muted"><dt>Processing (non-refundable)</dt><dd className="tabular-nums">{formatMoney(job.processingFeeCents, job.currency)}</dd></div>
              <div className="flex justify-between border-t border-line pt-1 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatMoney(job.budgetCents + job.processingFeeCents, job.currency)}</dd></div>
            </dl>
            <p className="mb-4 text-xs text-muted">
              When you pick a bid, the unused escrow comes straight back. Cancel before picking and you get all {formatMoney(job.budgetCents, job.currency)} back.
              Processing covers PayPal&apos;s fee, which PayPal keeps even on refunds.
            </p>
            {/* Provider inside the streamed boundary so it hydrates with its button (avoids React #418). */}
            <PayPalProviders>
              <FundEscrow jobId={job.id} />
            </PayPalProviders>
          </Card>
        )}

        {buyerKey && <BuyerLedger jobId={job.id} />}
        {buyerKey && <ManageLink jobId={job.id} buyerKey={buyerKey} />}
      </aside>
    </div>
  );
}

function BuyerLedger({ jobId }: { jobId: string }) {
  const rows = paymentsFor(getDb(), jobId);
  if (rows.length === 0) return null;
  return (
    <Card className="p-5" >
      <h2 className="mb-3 font-semibold">Escrow ledger</h2>
      <ul className="space-y-3 text-sm" data-testid="ledger">
        {rows.map((p) => (
          <li key={p.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p>{PAYMENT_KIND[p.kind]}</p>
              {p.paypalId && <p className="truncate font-mono text-xs text-muted">{p.paypalId}</p>}
            </div>
            <div className="text-right">
              <p className="font-medium tabular-nums">{p.kind === "escrow_capture" ? "+" : "−"}{formatMoney(p.amountCents, p.currency)}</p>
              <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

async function ManageLink({ jobId, buyerKey }: { jobId: string; buyerKey: string }) {
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  return (
    <Card className="p-5">
      <h2 className="font-semibold">Your private link</h2>
      <p className="mt-1 text-xs text-muted">You&apos;re signed in to this job on this browser. Keep this link to manage it from anywhere.</p>
      <input readOnly aria-label="Private manage link" value={`${origin}/jobs/${jobId}/manage?key=${buyerKey}`}
        className="mt-2 w-full truncate rounded-md border border-line bg-background px-2 py-1 font-mono text-xs" />
    </Card>
  );
}
