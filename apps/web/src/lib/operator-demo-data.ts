import type { Allocation } from "@provable/api-client";

/*
 * FICTIONAL SAMPLE DATA for the public dashboard demo at /operators/demo. None of these agents, briefs, payments or
 * payouts exist: no money moved and nothing here comes from the API or from PayPal. It has the shape of the
 * operator's real allocations (GET /v1/operators/me/allocations) so the demo renders the same ledger grid and AG Studio
 * dashboard a signed-in operator sees. Amounts are the operator's 95% of $10–$50 briefs.
 */

export const SAMPLE_AGENTS = {
  agt_sample_pixel_forge: "Pixel Forge",
  agt_sample_loom_ledger: "Loom & Ledger",
  agt_sample_copper_kettle: "Copper Kettle",
  agt_sample_northwind: "Northwind Pages",
} as const;
type SampleAgentId = keyof typeof SAMPLE_AGENTS;

// [created_at (UTC), winning agent, brief price in cents, payout state, ledger state, payout detail]
const PLAN: [string, SampleAgentId, number, Allocation["payout_state"], Allocation["ledger_state"], string?][] = [
  ["2026-11-02T09:14:00Z", "agt_sample_pixel_forge", 2500, "paid", "allocated"],
  ["2026-11-02T15:40:00Z", "agt_sample_loom_ledger", 4500, "paid", "allocated"],
  ["2026-11-03T11:05:00Z", "agt_sample_copper_kettle", 1500, "paid", "allocated"],
  ["2026-11-03T18:22:00Z", "agt_sample_pixel_forge", 3900, "paid", "allocated"],
  ["2026-11-04T10:47:00Z", "agt_sample_northwind", 2000, "paid", "allocated"],
  ["2026-11-05T13:30:00Z", "agt_sample_loom_ledger", 5000, "paid", "allocated"],
  ["2026-11-05T20:12:00Z", "agt_sample_pixel_forge", 1200, "failed", "allocated", "FAILED: sample payout failure"],
  ["2026-11-06T09:55:00Z", "agt_sample_copper_kettle", 3500, "paid", "allocated"],
  ["2026-11-07T14:18:00Z", "agt_sample_northwind", 2900, "paid", "allocated"],
  ["2026-11-07T17:41:00Z", "agt_sample_loom_ledger", 1900, "blocked", "held", "Held: sample buyer dispute"],
  ["2026-11-08T11:26:00Z", "agt_sample_pixel_forge", 4900, "paid", "allocated"],
  ["2026-11-09T10:03:00Z", "agt_sample_copper_kettle", 2500, "pending", "allocated"],
  ["2026-11-09T16:37:00Z", "agt_sample_loom_ledger", 3000, "pending", "allocated"],
  ["2026-11-10T12:15:00Z", "agt_sample_northwind", 4000, "pending", "allocated"],
  ["2026-11-11T09:48:00Z", "agt_sample_pixel_forge", 1000, "queued", "allocated"],
  ["2026-11-11T14:20:00Z", "agt_sample_copper_kettle", 4500, "not_scheduled", "allocated"],
];

/** Fictional allocations, newest first like the API returns them. */
export const SAMPLE_ALLOCATIONS: Allocation[] = PLAN.map(([created_at, agent_id, price, payout_state, ledger_state, payout_detail], index): Allocation => {
  const n = String(index + 1).padStart(2, "0");
  const amount_minor = Math.round(price * 0.95);
  return {
    id: `alloc_sample_${n}`,
    competition_id: `cmp_sample_${n}`,
    payment_id: `pay_sample_${n}`,
    kind: "winner",
    amount: { currency: "USD", amount_minor },
    ledger_state,
    payout_state,
    provider_payout_id: payout_state === "paid" || payout_state === "pending" ? `sample_payout_${n}` : null,
    created_at,
    operator_id: "op_sample",
    recipient_id: "rcp_sample",
    agent_shares: [{ agent_id, amount_minor }],
    payout_detail: payout_detail ?? null,
  };
}).reverse();

export const sampleAgentName = (allocation: Allocation) =>
  allocation.agent_shares.map((share) => SAMPLE_AGENTS[share.agent_id as SampleAgentId] ?? share.agent_id).join(", ");
