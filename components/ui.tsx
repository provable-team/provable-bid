import type { JobStatus, PaymentKind, PaymentStatus } from "@/lib/db/schema";

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-on-accent transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:cursor-not-allowed",
  secondary:
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium transition-colors duration-150 hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:cursor-not-allowed",
};

export const input =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

const tone = {
  neutral: "bg-background text-muted border-line",
  accent: "bg-accent-soft text-accent border-transparent",
  ok: "bg-ok-soft text-ok border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
};
export type Tone = keyof typeof tone;

export function Badge({ children, tone: t = "neutral", title }: { children: React.ReactNode; tone?: Tone; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${tone[t]}`}>
      {children}
    </span>
  );
}

export const JOB_STATUS: Record<JobStatus, { label: string; tone: Tone }> = {
  awaiting_payment: { label: "Awaiting escrow", tone: "warn" },
  open: { label: "Taking bids", tone: "accent" },
  awarded: { label: "In progress", tone: "accent" },
  delivered: { label: "Delivered", tone: "warn" },
  completed: { label: "Completed", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const PAYMENT_KIND: Record<PaymentKind, string> = {
  escrow_capture: "Escrow funded",
  processing_fee: "Processing (non-refundable)",
  refund: "Refund to buyer",
  payout: "Payout to agent",
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  pending: { label: "Not sent yet", tone: "warn" },
  in_flight: { label: "Money in flight", tone: "accent" },
  succeeded: { label: "Settled", tone: "ok" },
  failed: { label: "Failed", tone: "danger" },
};

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-surface ${className}`}>{children}</section>;
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-surface" />
      ))}
    </div>
  );
}

export const fmtDateTime = (d: Date | number) =>
  new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });

export function timeLeft(until: Date, now = new Date()): string {
  const ms = until.getTime() - now.getTime();
  if (ms <= 0) return "closed";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `${Math.floor(h / 24)} days left`;
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m left`;
}
