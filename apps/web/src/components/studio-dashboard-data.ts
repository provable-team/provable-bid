import type { AgResponsiveLayoutCandidate, AgWidgetLayoutState } from "ag-studio";
import type { OperatorStudioRow } from "./operator-studio";

// Pure helpers for the operator dashboard (no Studio runtime), so they can be tested on their own.

/**
 * Payout stages and their colours, by meaning: the same stage has the same colour in the pipeline, the donut, the
 * latest-payout pill and the ledger pills. Validated with the dataviz palette check on the #fffef9 surface (light only;
 * the site has no dark mode): CVD and normal-vision separation pass for every pair. "Waiting" is a deliberate neutral,
 * and the light marks rely on the text labels and amounts beside them (and the ledger table), not on colour alone.
 * Order matters: Studio 3.1 colours chart categories by palette position only, so charts list stages in this order.
 */
export const PAYOUT_STAGES = [
  { key: "paid", label: "Paid", states: ["paid", "simulated"], color: "#6f8a1f" },
  { key: "sent", label: "Sent", states: ["pending"], color: "#e5a51a" },
  { key: "waiting", label: "Waiting", states: ["queued", "not_scheduled"], color: "#dfe0d6" },
  // "Issue" (failed or on hold): short enough for one legend row on desktop; the pipeline spells it out.
  { key: "attention", label: "Issue", states: ["failed", "blocked"], color: "#8a3b25" },
] as const;
export type PayoutStageKey = (typeof PAYOUT_STAGES)[number]["key"];
/** The stage a contract payout state belongs to; anything unrecognised needs attention. */
export const payoutStage = (state: unknown) =>
  PAYOUT_STAGES.find((stage) => (stage.states as readonly string[]).includes(String(state))) ?? PAYOUT_STAGES[3];

/**
 * Allocated money per payout stage, always all four stages in the fixed order (zero when empty), so a chart of it
 * keeps each stage on its own palette colour whichever stages the operator has.
 */
export function payoutStageSummary(allocations: { payout_state: string; allocation_usd: number | null }[]) {
  return PAYOUT_STAGES.map((stage, index) => {
    const rows = allocations.filter((a) => payoutStage(a.payout_state).key === stage.key);
    return {
      stage: stage.label,
      stage_order: index + 1,
      amount_usd: Math.round(rows.reduce((sum, a) => sum + (a.allocation_usd ?? 0), 0) * 100) / 100,
      allocation_count: rows.length,
    };
  });
}

/**
 * One row per loaded allocation, from the operator's own ledger and nothing else. No operator, recipient, payment or
 * provider identifiers reach the in-browser engine; agent names are the operator's own agents.
 */
export function studioAllocationData(rows: OperatorStudioRow[]) {
  let missingAmounts = 0;
  const sorted = [...rows].sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
  let running = 0;
  const allocations = sorted.map((row) => {
    const validAmount = typeof row.amount_minor === "number" && Number.isSafeInteger(row.amount_minor);
    if (!validAmount) missingAmounts++;
    const usd = validAmount ? (row.amount_minor as number) / 100 : null;
    const state = typeof row.payout_state === "string" && row.payout_state.trim() ? row.payout_state : "unknown";
    // Reversing an obligation does not recall an already-paid transfer. Keep the original amount and payment
    // history separate from current allocations and outstanding obligations.
    const net = row.ledger_state === "reversed" ? 0 : usd;
    const paid = state === "paid" || state === "simulated";
    const created = typeof row.created_at === "string" ? new Date(row.created_at) : null;
    const createdAt = created && !Number.isNaN(created.getTime()) ? created : null;
    running += net ?? 0;
    return {
      created_at: createdAt,
      created_on: createdAt ? new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate()) : null,
      agent: typeof row.agent === "string" && row.agent ? row.agent : "Unknown agent",
      payout_state: state,
      ledger_state: typeof row.ledger_state === "string" ? row.ledger_state : "unknown",
      allocation_usd: usd,
      net_allocated_usd: net,
      outstanding_usd: paid ? 0 : net,
      // Only what PayPal reported as paid (or the fake provider recorded as simulated); never pending or queued money.
      paid_usd: usd !== null && paid ? usd : 0,
      cumulative_usd: Math.round(running * 100) / 100,
      allocation_count: 1,
    };
  });
  return { allocations, missingAmounts };
}

export const bottom = (layouts: AgWidgetLayoutState[]) => layouts.reduce((max, l) => Math.max(max, l.yTrack + l.ySpan), 0);

/**
 * Phones: small tiles pair up two to a row, everything else goes full width in desktop reading order, with enough
 * height for a chart (or the pipeline's vertical stages) at that width. Returns layouts in the order given.
 */
export function phoneLayout(candidates: AgResponsiveLayoutCandidate[], columns: number): AgWidgetLayoutState[] {
  const order = candidates.map((c, i) => ({ ...c, i })).sort((a, b) => a.layout.yTrack - b.layout.yTrack || a.layout.xTrack - b.layout.xTrack);
  const out: AgWidgetLayoutState[] = new Array(candidates.length);
  const half = Math.floor(columns / 2);
  let y = 0;
  for (let k = 0; k < order.length; k++) {
    const { layout, minSize, i } = order[k];
    const small = layout.xSpan <= 6 && layout.ySpan <= 10;
    const next = order[k + 1];
    const pairs = small && minSize.xSpan <= half && next && next.layout.xSpan <= 6 && next.layout.ySpan <= 10 && next.minSize.xSpan <= half;
    if (pairs && next) {
      const h = Math.max(layout.ySpan, next.layout.ySpan, minSize.ySpan, next.minSize.ySpan);
      out[i] = { ...layout, xTrack: 0, yTrack: y, xSpan: half, ySpan: h };
      out[next.i] = { ...next.layout, xTrack: half, yTrack: y, xSpan: columns - half, ySpan: h };
      y += h; k++;
      continue;
    }
    // A full-width strip (the pipeline) stacks its stages on a phone; charts get a readable height.
    const h = small ? Math.max(layout.ySpan, minSize.ySpan) : layout.xSpan >= columns ? Math.max(layout.ySpan, 14, minSize.ySpan) : Math.max(16, Math.min(layout.ySpan, 18), minSize.ySpan);
    out[i] = { ...layout, xTrack: 0, yTrack: y, xSpan: columns, ySpan: h };
    y += h;
  }
  return out;
}
