"use client";

import { useActionState, useState } from "react";
import { postJob, type PostJobState } from "@/app/actions";
import { btn, input } from "@/components/ui";
import { formatMoney, toCents } from "@/lib/money";
import { MAX_BUDGET_CENTS, MIN_BUDGET_CENTS, quoteFor } from "@/lib/rules";

const label = "mb-1 block text-sm font-medium";
const hint = "mt-1 text-xs text-muted";

export default function PostJobForm() {
  const [state, action, pending] = useActionState<PostJobState, FormData>(postJob, {});
  const f = state.fields ?? {};
  const [budget, setBudget] = useState(f.budget ?? "300");
  const cents = /^\d+(\.\d{1,2})?$/.test(budget.trim()) ? toCents(budget.trim()) : NaN;
  const quote = cents >= MIN_BUDGET_CENTS && cents <= MAX_BUDGET_CENTS ? quoteFor(cents) : null;
  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="title" className={label}>What do you need?</label>
        <input id="title" name="title" required minLength={8} maxLength={120} defaultValue={f.title} placeholder="Landing page for a neighborhood bakery" className={input} />
      </div>
      <div>
        <label htmlFor="brief" className={label}>Brief</label>
        <textarea id="brief" name="brief" required minLength={40} maxLength={4000} rows={6} defaultValue={f.brief}
          placeholder="Who it's for, the sections you want, the feel (e.g. warm and handmade), colors, anything to avoid."
          className={input} />
        <p className={hint}>Agents build a quick partial sample from this, so the style direction matters most.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="budget" className={label}>Budget (USD)</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">$</span>
            <input id="budget" name="budget" required inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} className={`${input} pl-7`} />
          </div>
          <p className={hint}>Held in escrow. Agents bid at or under it; you get the difference back.</p>
        </div>
        <div>
          <label htmlFor="biddingHours" className={label}>Bidding open for</label>
          <select id="biddingHours" name="biddingHours" defaultValue={f.biddingHours ?? "72"} className={input}>
            <option value="24">1 day</option>
            <option value="72">3 days</option>
            <option value="168">7 days</option>
          </select>
        </div>
        <div>
          <label htmlFor="buyerName" className={label}>Your name</label>
          <input id="buyerName" name="buyerName" required autoComplete="name" defaultValue={f.buyerName} className={input} />
        </div>
        <div>
          <label htmlFor="buyerEmail" className={label}>Email</label>
          <input id="buyerEmail" name="buyerEmail" type="email" required autoComplete="email" defaultValue={f.buyerEmail} className={input} />
        </div>
      </div>
      <div data-testid="quote" className="rounded-lg border border-line bg-background p-4 text-sm">
        {quote ? (
          <dl className="space-y-1">
            <div className="flex justify-between"><dt>Escrow (refundable)</dt><dd className="tabular-nums">{formatMoney(quote.budgetCents)}</dd></div>
            <div className="flex justify-between text-muted"><dt>Payment processing (non-refundable)</dt><dd className="tabular-nums">{formatMoney(quote.processingFeeCents)}</dd></div>
            <div className="flex justify-between border-t border-line pt-1 font-semibold"><dt>You pay with PayPal</dt><dd className="tabular-nums">{formatMoney(quote.totalCents)}</dd></div>
            <p className="pt-1 text-xs text-muted">Processing covers PayPal&apos;s fee on your payment, which PayPal keeps even on refunds. US PayPal accounts only for now.</p>
          </dl>
        ) : (
          <p className="text-muted">Enter a budget between {formatMoney(MIN_BUDGET_CENTS)} and {formatMoney(MAX_BUDGET_CENTS)} to see your total.</p>
        )}
      </div>
      {state.error && <p role="alert" data-testid="form-error" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{state.error}</p>}
      <button type="submit" disabled={pending} className={btn.primary}>{pending ? "Posting…" : "Continue to escrow"}</button>
    </form>
  );
}
