"use client";

import React, { useMemo } from "react";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import type { AgDataSourcesDefinition, AgReportState } from "ag-studio";
import type { OperatorStudioRow } from "./operator-studio";

// Deliberately pass only state, amount, and count to the in-browser engine: no
// operator, agent, recipient, payment, or provider identifiers are needed here.
export function studioAllocationData(rows: OperatorStudioRow[]) {
  let missingAmounts = 0;
  const allocations = rows.map((row) => {
    const validAmount = typeof row.amount_minor === "number" && Number.isSafeInteger(row.amount_minor);
    if (!validAmount) missingAmounts++;
    return {
      payout_state: typeof row.payout_state === "string" && row.payout_state.trim() ? row.payout_state : "unknown",
      allocation_usd: validAmount ? (row.amount_minor as number) / 100 : null,
      allocation_count: 1,
    };
  });
  return { allocations, missingAmounts };
}

const initialState: AgReportState = {
  pages: [{
    id: "allocations",
    widgets: {
      "allocation-total": {
        type: "value",
        dataMapping: { value: [{ id: "allocations.allocation_usd", aggregation: "sum" }] },
        format: { style: { label: { enabled: true, text: "Known allocation amount (USD)" } } },
      },
      "allocation-count": {
        type: "value",
        dataMapping: { value: [{ id: "allocations.allocation_count", aggregation: "sum" }] },
        format: { style: { label: { enabled: true, text: "Loaded allocations" } } },
      },
      "allocation-status": {
        type: "bar-chart-grouped",
        dataMapping: {
          categoryKey: [{ id: "allocations.payout_state" }],
          valueKey: [{ id: "allocations.allocation_count", aggregation: "sum" }],
        },
        format: { title: { enabled: true, text: "Allocations by payout status" } },
      },
      "amount-status": {
        type: "bar-chart-grouped",
        dataMapping: {
          categoryKey: [{ id: "allocations.payout_state" }],
          valueKey: [{ id: "allocations.allocation_usd", aggregation: "sum" }],
        },
        format: { title: { enabled: true, text: "Known allocation amount by payout status (USD)" } },
      },
    },
    widgetLayout: {
      "allocation-total": { xTrack: 0, yTrack: 0, xSpan: 12, ySpan: 6 },
      "allocation-count": { xTrack: 12, yTrack: 0, xSpan: 12, ySpan: 6 },
      "allocation-status": { xTrack: 0, yTrack: 6, xSpan: 12, ySpan: 18 },
      "amount-status": { xTrack: 12, yTrack: 6, xSpan: 12, ySpan: 18 },
    },
  }],
  selectedPageId: "allocations",
};

export default function OperatorStudioCanvas({ rows, licenseKey }: { rows: OperatorStudioRow[]; licenseKey?: string }) {
  const { allocations, missingAmounts } = useMemo(() => studioAllocationData(rows), [rows]);
  const data = useMemo<AgDataSourcesDefinition>(() => ({
    sources: [{
      id: "allocations",
      name: "Loaded allocations",
      data: allocations,
      fields: [
        { id: "payout_state", name: "Payout status", format: "textFormat" },
        { id: "allocation_usd", name: "Allocation amount (USD)", format: "currencyFormat" },
        { id: "allocation_count", name: "Allocations", format: "integerFormat" },
      ],
    }],
  }), [allocations]);

  return (
    <section aria-label="Sandbox allocation dashboard">
      <h2>Sandbox allocation dashboard</h2>
      <p>Summarizes loaded records only. Allocation amounts are not amounts received; payout status is shown separately.</p>
      {missingAmounts > 0 && <p role="status">{missingAmounts} loaded allocation{missingAmounts === 1 ? " has" : "s have"} no valid amount and {missingAmounts === 1 ? "is" : "are"} excluded from amount totals.</p>}
      <div style={{ width: "100%", height: 620 }}>
        <AgStudioProvider licenseKey={licenseKey}>
          <AgStudio data={data} initialState={initialState} mode="view" />
        </AgStudioProvider>
      </div>
    </section>
  );
}
