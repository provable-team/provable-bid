"use client";

import { createContext, useContext, useEffect, useState, useTransition } from "react";
import { acceptJob, askForRevision, awardJob, cancelOrder, syncPayments } from "@/app/actions";
import type { Result } from "@/lib/market";
import { btn, input } from "@/components/ui";

type Outcome = { ok: boolean; text: string } | null;

// A success usually changes the job's state, which unmounts the button that was clicked.
// So success messages live here, above the page content, and survive the refresh. Errors stay by the button.
const FlashContext = createContext<(text: string) => void>(() => {});

export function JobFlash({ children }: { children: React.ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <FlashContext.Provider value={setText}>
      {text && (
        <div role="status" data-testid="flash" className="mb-6 flex items-start justify-between gap-3 rounded-lg bg-ok-soft p-3 text-sm text-ok">
          <p>{text}</p>
          <button type="button" onClick={() => setText(null)} className="text-xs font-medium hover:underline">Dismiss</button>
        </div>
      )}
      {children}
    </FlashContext.Provider>
  );
}

// Runs a buyer action. Money actions ask for a second click instead of a browser dialog.
function useBuyerAction() {
  const flash = useContext(FlashContext);
  const [pending, start] = useTransition();
  const [outcome, setOutcome] = useState<Outcome>(null);
  const run = (fn: () => Promise<Result<{ message: string }>>) =>
    start(async () => {
      setOutcome(null);
      try {
        const r = await fn();
        if (r.ok) flash(r.data.message);
        else setOutcome({ ok: false, text: r.error });
      } catch {
        setOutcome({ ok: false, text: "Something went wrong. Nothing was charged twice; try again." });
      }
    });
  return { pending, outcome, run };
}

function Message({ outcome }: { outcome: Outcome }) {
  if (!outcome) return null;
  return (
    <p role="alert" data-testid="action-error" className="text-sm text-danger">
      {outcome.text}
    </p>
  );
}

function ConfirmButton({ label, confirmLabel, detail, onConfirm, pending, tone = "primary", testId }: {
  label: string; confirmLabel: string; detail: string; onConfirm: () => void; pending: boolean; tone?: "primary" | "secondary"; testId: string;
}) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return <button type="button" className={`${btn[tone]} w-full`} onClick={() => setArmed(true)} data-testid={testId}>{label}</button>;
  }
  return (
    <div className="space-y-2 rounded-lg border border-line bg-background p-3">
      <p className="text-sm">{detail}</p>
      <div className="flex gap-2">
        <button type="button" className={`${btn.primary} flex-1`} disabled={pending} onClick={onConfirm} data-testid={`${testId}-confirm`}>
          {pending ? "Working…" : confirmLabel}
        </button>
        <button type="button" className={btn.secondary} disabled={pending} onClick={() => setArmed(false)}>Back</button>
      </div>
    </div>
  );
}

export function AwardButton({ jobId, bidId, agentName, price, refund }: { jobId: string; bidId: string; agentName: string; price: string; refund: string | null }) {
  const { pending, outcome, run } = useBuyerAction();
  return (
    <div className="space-y-2 pt-2">
      <ConfirmButton
        testId="award" label={`Award to ${agentName}`} confirmLabel={`Award for ${price}`} pending={pending}
        detail={`${agentName} builds the full page for ${price}.${refund ? ` ${refund} of your escrow is refunded right away.` : ""} Other bids are closed.`}
        onConfirm={() => run(() => awardJob(jobId, bidId))}
      />
      <Message outcome={outcome} />
    </div>
  );
}

export function ReviewDelivery({ jobId, canRevise, payout, agentName }: { jobId: string; canRevise: boolean; payout: string; agentName: string }) {
  const { pending, outcome, run } = useBuyerAction();
  const [revising, setRevising] = useState(false);
  const [request, setRequest] = useState("");
  return (
    <div className="space-y-3">
      {!revising && (
        <ConfirmButton
          testId="accept" label="Accept and release payment" confirmLabel="Release payment" pending={pending}
          detail={`${agentName} is paid ${payout} through PayPal. This can't be undone.`}
          onConfirm={() => run(() => acceptJob(jobId))}
        />
      )}
      {canRevise && !revising && (
        <button type="button" className={`${btn.secondary} w-full`} onClick={() => setRevising(true)} data-testid="revise">Ask for a revision</button>
      )}
      {revising && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => askForRevision(jobId, request));
          }}
        >
          <label htmlFor="revision" className="text-sm font-medium">What should change?</label>
          <textarea id="revision" rows={4} maxLength={2000} value={request} onChange={(e) => setRequest(e.target.value)} className={input} data-testid="revision-text"
            placeholder="Bigger product photos, and move the opening hours above the fold." />
          <p className="text-xs text-muted">You get one revision. The agent gets a fresh delivery window.</p>
          <div className="flex gap-2">
            <button type="submit" className={`${btn.primary} flex-1`} disabled={pending} data-testid="revise-send">{pending ? "Sending…" : "Send revision request"}</button>
            <button type="button" className={btn.secondary} onClick={() => setRevising(false)}>Back</button>
          </div>
        </form>
      )}
      <Message outcome={outcome} />
    </div>
  );
}

export function CancelJob({ jobId, refund, reason }: { jobId: string; refund: string; reason: string }) {
  const { pending, outcome, run } = useBuyerAction();
  return (
    <div className="space-y-2">
      <ConfirmButton
        testId="cancel" tone="secondary" label="Cancel job" confirmLabel={`Cancel and refund ${refund}`} pending={pending}
        detail={`${reason} ${refund} goes back to your PayPal. The processing fee isn't refunded.`}
        onConfirm={() => run(() => cancelOrder(jobId))}
      />
      <Message outcome={outcome} />
    </div>
  );
}

// While a refund or payout is moving, ask PayPal for news every few seconds (and retry anything unsent).
export function LedgerSync({ jobId }: { jobId: string }) {
  const [note, setNote] = useState("Checking PayPal…");
  useEffect(() => {
    let stop = false;
    let delay = 4000;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await syncPayments(jobId);
        if (stop) return;
        if (r.ok && r.data.settled) return setNote("Up to date with PayPal.");
      } catch {
        /* network blip: try again */
      }
      delay = Math.min(delay * 1.5, 30_000);
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, delay);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [jobId]);
  return <p className="mt-3 text-xs text-muted" data-testid="ledger-sync">{note}</p>;
}
