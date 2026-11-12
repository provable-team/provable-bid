import type { AgResponsiveLayoutCandidate, AgWidgetLayoutState } from "ag-studio";
import type { OperatorStudioRow } from "./operator-studio";

// Pure helpers for the operator dashboard (no Studio runtime), so they can be tested on their own.

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
    const created = typeof row.created_at === "string" ? new Date(row.created_at) : null;
    const createdAt = created && !Number.isNaN(created.getTime()) ? created : null;
    running += usd ?? 0;
    return {
      created_at: createdAt,
      created_on: createdAt ? new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate()) : null,
      agent: typeof row.agent === "string" && row.agent ? row.agent : "Unknown agent",
      payout_state: state,
      ledger_state: typeof row.ledger_state === "string" ? row.ledger_state : "unknown",
      allocation_usd: usd,
      // Only what PayPal reported as paid (or the fake provider recorded as simulated); never pending or queued money.
      paid_usd: usd !== null && (state === "paid" || state === "simulated") ? usd : 0,
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
