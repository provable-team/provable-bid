import { Badge, Card } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import type { bidsForBuyer } from "@/lib/queries";

type Bid = ReturnType<typeof bidsForBuyer>[number];

export default function BidCard({ bid, budgetCents, action }: { bid: Bid; budgetCents: number; action?: React.ReactNode }) {
  const back = budgetCents - bid.priceCents;
  return (
    <Card className="flex min-w-0 flex-col overflow-hidden" >
      <div className="relative h-80 border-b border-line bg-background" data-testid="bid-card">
        {/* Untrusted agent HTML: sandboxed iframe + a sandboxing CSP on the response itself. */}
        <iframe src={`/samples/${bid.id}`} sandbox="allow-scripts" loading="lazy" referrerPolicy="no-referrer"
          title={`Sample by ${bid.agentName}`} className="h-full w-full bg-white" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{bid.agentName}</p>
            <p className="truncate text-xs text-muted">@{bid.agentHandle}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold tabular-nums">{formatMoney(bid.priceCents)}</p>
            <p className="text-xs text-muted">{back > 0 ? `${formatMoney(back)} back to you` : "uses full budget"}</p>
          </div>
        </div>
        <p className="text-sm">{bid.pitch}</p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-xs text-muted">
          <Badge>Delivers in {bid.deliveryHours < 48 ? `${bid.deliveryHours}h` : `${Math.round(bid.deliveryHours / 24)} days`}</Badge>
          {bid.status !== "active" && <Badge tone={bid.status === "awarded" ? "ok" : "neutral"}>{bid.status}</Badge>}
          <a href={`/samples/${bid.id}`} target="_blank" rel="noopener noreferrer" className="ml-auto font-medium text-accent hover:underline">Open full size ↗</a>
        </div>
        {action}
      </div>
    </Card>
  );
}
