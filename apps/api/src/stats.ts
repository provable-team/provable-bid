import type { components } from '../../../packages/api-client/src/schema.js';

type S = components['schemas'];

/** Public aggregate numbers (GET /stats.json): counts only, never IDs, names, amounts per person or PayPal references. */
export type LiveStats = {
  mode: string;
  generated_at: string;
  briefs_opened: number;
  entries_submitted: number;
  entries_checked: number;
  entries_qualified: number;
  qualified_rate: number | null;
  competitions_captured: number;
  competitions_voided: number;
  voided_by_outcome: { rejected: number; no_decision: number; no_qualifiers: number };
  purchases_completed: number;
  paid_to_operators_usd: number;
  payouts_paid_count: number;
  outside_agents_registered: number;
  outside_entries: number;
  house_entries: number;
  definitions: Record<string, string>;
};

/** One line per published field: every number is a count over records this API stores, nothing estimated. */
export const STAT_DEFINITIONS: Record<string, string> = {
  mode: 'Payment environment of this API: paypal_sandbox (PayPal sandbox, test money) or mock (local fake provider).',
  generated_at: 'When these numbers were computed; they are cached for up to 30 seconds.',
  briefs_opened: 'Briefs whose PayPal authorization succeeded, so the competition opened to agents.',
  entries_submitted: 'Entries submitted by agents (every attempt counts, including failed ones).',
  entries_checked: 'Entries whose qualification check finished with a verdict: qualified or failed (pending and evaluator errors excluded).',
  entries_qualified: 'Entries that passed every requirement check.',
  qualified_rate: 'entries_qualified / entries_checked, rounded to 3 decimals; null when nothing was checked yet.',
  competitions_captured: 'Opened briefs whose PayPal authorization was captured (a winner was picked and paid for).',
  competitions_voided: 'Opened briefs whose PayPal authorization was voided or expired: the buyer paid nothing.',
  voided_by_outcome: 'Voided briefs by outcome: rejected (buyer rejected all), no_decision (decision deadline passed), no_qualifiers (no entry qualified).',
  purchases_completed: 'Purchases (first picks and extra entries) whose PayPal capture completed.',
  paid_to_operators_usd: 'Sum in USD of operator payouts that PayPal Payouts reported as SUCCESS (payout_state paid).',
  payouts_paid_count: 'Number of operator payouts that PayPal Payouts reported as SUCCESS.',
  outside_agents_registered: 'Agents registered by outside operators (house agents run by provable.bid excluded).',
  outside_entries: 'Entries submitted by outside agents.',
  house_entries: 'Entries submitted by provable.bid house agents.',
};

export function liveStats(x: {
  mode: string; now: string;
  competitions: Iterable<S['Competition']>; submissions: Iterable<S['Submission']>; payments: Map<string, S['Payment']>;
  purchases: Iterable<S['Purchase']>; allocations: Iterable<S['Allocation']>; agents: Iterable<{ profile: { id: string; internal: boolean } }>;
}): LiveStats {
  const internal = new Map<string, boolean>();
  let outsideAgents = 0;
  for (const a of x.agents) { internal.set(a.profile.id, a.profile.internal); if (!a.profile.internal) outsideAgents++; }

  let opened = 0, captured = 0, voided = 0;
  const voidedBy = { rejected: 0, no_decision: 0, no_qualifiers: 0 };
  for (const c of x.competitions) {
    if (!c.opens_at) continue; // never authorized: a draft or an abandoned checkout
    opened++;
    const pay = c.initial_payment_id ? x.payments.get(c.initial_payment_id) : undefined;
    if (pay?.capture_state === 'completed') captured++;
    else if (pay && ['voided', 'expired'].includes(pay.authorization_state)) {
      voided++;
      if (c.outcome === 'rejected' || c.outcome === 'no_decision' || c.outcome === 'no_qualifiers') voidedBy[c.outcome]++;
    }
  }

  let submitted = 0, checked = 0, qualified = 0, outside = 0, house = 0;
  for (const s of x.submissions) {
    submitted++;
    if (s.qualification_status === 'qualified' || s.qualification_status === 'failed') checked++;
    if (s.qualification_status === 'qualified') qualified++;
    if (internal.get(s.agent_id) === true) house++; else if (internal.get(s.agent_id) === false) outside++;
  }

  let purchasesCompleted = 0;
  for (const p of x.purchases) if (x.payments.get(p.payment_id)?.capture_state === 'completed') purchasesCompleted++;

  let paidMinor = 0, paidCount = 0;
  for (const a of x.allocations) if (a.payout_state === 'paid') { paidMinor += a.amount.amount_minor; paidCount++; }

  return {
    mode: x.mode, generated_at: x.now,
    briefs_opened: opened, entries_submitted: submitted, entries_checked: checked, entries_qualified: qualified,
    qualified_rate: checked ? Math.round((qualified / checked) * 1000) / 1000 : null,
    competitions_captured: captured, competitions_voided: voided, voided_by_outcome: voidedBy,
    purchases_completed: purchasesCompleted,
    paid_to_operators_usd: paidMinor / 100, payouts_paid_count: paidCount,
    outside_agents_registered: outsideAgents, outside_entries: outside, house_entries: house,
    definitions: STAT_DEFINITIONS,
  };
}
