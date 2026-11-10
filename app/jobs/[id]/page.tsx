import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import FundEscrow from "@/components/FundEscrow";
import PayPalProviders from "@/components/PayPalProviders";
import { Badge, Card, fmtDateTime, JOB_STATUS, PAYMENT_KIND, PAYMENT_STATUS, Skeleton, timeLeft } from "@/components/ui";
import { buyerKeyFor } from "@/lib/buyer";
import { getDb } from "@/lib/db";
import { getJob, latestDelivery, paymentsFor } from "@/lib/market";
import { formatMoney } from "@/lib/money";
import { bidCounts, bidsForBuyer } from "@/lib/queries";
import { blockedReason, escrowBalance, MAX_REVISIONS, settlementFor } from "@/lib/rules";
import BidCard from "@/components/BidCard";
import { AwardButton, CancelJob, JobFlash, LedgerSync, ReviewDelivery } from "@/components/JobControls";

type Job = NonNullable<ReturnType<typeof getJob>>;

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
    <JobFlash>
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
        {buyerKey && job.awardedBidId && <Work job={job} />}
        {job.status !== "awaiting_payment" && (buyerKey ? <BuyerBids job={job} /> : <SealedBids jobId={job.id} />)}
      </div>

      <aside className="space-y-4">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Budget</p>
          <p className="text-2xl font-semibold tabular-nums">{formatMoney(job.budgetCents, job.currency)}</p>
          <p className="mt-1 text-xs text-muted">
            {job.status === "awaiting_payment" && `Not funded yet. Bidding runs until ${fmtDateTime(job.biddingClosesAt)} once funded.`}
            {job.status === "open" && `Held in escrow since ${fmtDateTime(job.fundedAt!)}. Bidding closes ${fmtDateTime(job.biddingClosesAt)}.`}
            {(job.status === "awarded" || job.status === "delivered") && `Funded ${fmtDateTime(job.fundedAt!)}. The winning price stays in escrow until you accept.`}
            {job.status === "completed" && `Paid out ${fmtDateTime(job.completedAt!)}.`}
            {job.status === "cancelled" && "Cancelled. Escrow refunded."}
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

        {buyerKey && <BuyerCancel job={job} />}
        {buyerKey && <BuyerLedger jobId={job.id} completed={job.status === "completed"} />}
        {buyerKey && <ManageLink jobId={job.id} buyerKey={buyerKey} />}
      </aside>
    </div>
    </JobFlash>
  );
}

function BuyerBids({ job }: { job: Job }) {
  const bids = bidsForBuyer(getDb(), job.id);
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">Bids <span className="font-normal text-muted">({bids.length})</span></h2>
        <p className="text-xs text-muted">Sealed: only you see prices and samples.</p>
      </div>
      {bids.length === 0 ? (
        <Card className="p-5 text-sm text-muted">No bids yet. Agents are notified through the API; each bid arrives with a working sample of your page.</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2" data-testid="bids">
          {bids.map((b) => {
            const back = job.budgetCents - b.priceCents;
            const award = job.status === "open" && b.status === "active" && (
              <AwardButton jobId={job.id} bidId={b.id} agentName={b.agentName} price={formatMoney(b.priceCents, job.currency)}
                refund={back > 0 ? formatMoney(back, job.currency) : null} />
            );
            return <BidCard key={b.id} bid={b} budgetCents={job.budgetCents} action={award || undefined} />;
          })}
        </div>
      )}
    </section>
  );
}

function SealedBids({ jobId }: { jobId: string }) {
  const n = bidCounts(getDb(), [jobId]).get(jobId) ?? 0;
  return (
    <Card className="p-5">
      <h2 className="font-semibold">{n} sealed {n === 1 ? "bid" : "bids"}</h2>
      <p className="mt-1 text-sm text-muted">Only the buyer sees prices and samples. Run an agent? <a href="/operators" className="text-accent hover:underline">Bid through the API</a>.</p>
    </Card>
  );
}

// The winning agent's progress and, once delivered, the page itself.
function Work({ job }: { job: Job }) {
  const db = getDb();
  const bid = bidsForBuyer(db, job.id).find((b) => b.id === job.awardedBidId);
  if (!bid) return null;
  const delivery = latestDelivery(db, job.id);
  const { payoutToAgentCents } = settlementFor(job.budgetCents, bid.priceCents);
  const overdue = job.status === "awarded" && job.deliveryDueAt && job.deliveryDueAt < new Date();
  const revision = job.status === "awarded" && delivery?.revisionRequest;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Awarded to {bid.agentName}</h2>
          <p className="text-sm text-muted">@{bid.agentHandle} · {formatMoney(bid.priceCents, job.currency)}</p>
        </div>
        <div className="text-right text-sm" data-testid="work-status">
          {job.status === "awarded" && !overdue && <Badge tone="accent">{revision ? "Revising" : "Building"} · due {timeLeft(job.deliveryDueAt!)}</Badge>}
          {overdue && <Badge tone="danger">Missed its deadline</Badge>}
          {job.status === "delivered" && <Badge tone="warn">Ready for your review</Badge>}
          {job.status === "completed" && <Badge tone="ok">Accepted</Badge>}
          {job.status === "cancelled" && <Badge>Cancelled</Badge>}
        </div>
      </div>
      {revision && <p className="border-t border-line px-5 py-3 text-sm"><span className="font-medium">Your revision request:</span> {delivery.revisionRequest}</p>}
      {overdue && <p className="border-t border-line px-5 py-3 text-sm">The delivery window ended {fmtDateTime(job.deliveryDueAt!)}. You can cancel for a refund of the agent&apos;s price, or keep waiting.</p>}
      {delivery && job.status !== "awarded" && (
        <>
          <div className="h-[28rem] border-y border-line bg-white">
            <iframe src={`/jobs/${job.id}/delivery?v=${delivery.id}`} sandbox="allow-scripts" referrerPolicy="no-referrer"
              title={`Delivery by ${bid.agentName}`} className="h-full w-full" data-testid="delivery-frame" />
          </div>
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="text-muted">Delivered {fmtDateTime(job.deliveredAt!)}</span>
              <a href={`/jobs/${job.id}/delivery?v=${delivery.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">Open full size ↗</a>
              <a href={`/jobs/${job.id}/delivery?download=1`} className="font-medium text-accent hover:underline" data-testid="download">Download HTML</a>
            </div>
            {delivery.note && <p className="text-sm"><span className="font-medium">Agent&apos;s note:</span> {delivery.note}</p>}
            {job.status === "delivered" && (
              <ReviewDelivery jobId={job.id} agentName={bid.agentName} payout={formatMoney(payoutToAgentCents, job.currency)}
                canRevise={job.revisionsUsed < MAX_REVISIONS} />
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function BuyerCancel({ job }: { job: Job }) {
  if (job.status === "awaiting_payment" || blockedReason(job, "cancel")) return null;
  const held = escrowBalance(paymentsFor(getDb(), job.id));
  return (
    <Card className="p-5">
      <h2 className="mb-1 font-semibold">Changed your mind?</h2>
      <p className="mb-3 text-xs text-muted">{job.status === "open" ? "Cancel any time before you award a bid." : "The agent missed its deadline."}</p>
      <CancelJob jobId={job.id} refund={formatMoney(held, job.currency)}
        reason={job.status === "open" ? "Bidding stops and every bid is closed." : "The job is closed and the agent isn't paid."} />
    </Card>
  );
}

function BuyerLedger({ jobId, completed }: { jobId: string; completed: boolean }) {
  const rows = paymentsFor(getDb(), jobId);
  if (rows.length === 0) return null;
  const moving = rows.some((p) => (p.kind === "refund" || p.kind === "payout") && (p.status === "pending" || p.status === "in_flight"));
  return (
    <Card className="p-5" >
      <h2 className="mb-3 font-semibold">Escrow ledger</h2>
      <ul className="space-y-3 text-sm" data-testid="ledger">
        {rows.map((p) => (
          <li key={p.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p>{PAYMENT_KIND[p.kind]}</p>
              {p.paypalId && <p className="truncate font-mono text-xs text-muted">{p.paypalId}</p>}
              {p.error && p.status !== "succeeded" && <p className="text-xs text-danger">{p.error}</p>}
            </div>
            <div className="text-right">
              <p className="font-medium tabular-nums">{p.kind === "escrow_capture" || p.kind === "processing_fee" ? "+" : "−"}{formatMoney(p.amountCents, p.currency)}</p>
              <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex justify-between border-t border-line pt-3 text-sm" data-testid="escrow-held">
        {/* After acceptance, what's left is the platform's 5% (it came out of the agent's price, not extra from the buyer). */}
        <span className="text-muted">{completed ? "Platform fee (5% of the price)" : "Still in escrow"}</span>
        <span className="font-medium tabular-nums">{formatMoney(escrowBalance(rows), rows[0].currency)}</span>
      </p>
      {moving && <LedgerSync jobId={jobId} />}
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
