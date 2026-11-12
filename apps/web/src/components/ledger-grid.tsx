"use client";

import { useMemo } from "react";
import { AllCommunityModule, themeQuartz, type ColDef } from "ag-grid-community";
import { AgGridProvider, AgGridReact } from "ag-grid-react";

type LedgerRow = Record<string, string | number | null>;
type LedgerColumn = {
  field: string;
  headerName: string;
  valueType?: "currency" | "date" | "text" | "status";
};

const modules = [AllCommunityModule];
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const pageSizes = [10, 25, 50];
const theme = themeQuartz.withParams({
  accentColor: "#657b19",
  backgroundColor: "#fffef9",
  foregroundColor: "#20221d",
  headerBackgroundColor: "#f6f5ef",
  borderColor: "#dddfd4",
  fontFamily: "DM Sans, Arial, sans-serif",
  fontSize: 13,
  spacing: 6,
});

/** Sortable, filterable view of the values supplied by the authenticated API. */
export function LedgerGrid({
  label,
  columns,
  rows,
  emptyMessage = "No activity yet.",
}: {
  label: string;
  columns: LedgerColumn[];
  rows: LedgerRow[];
  emptyMessage?: string;
}) {
  const columnDefs = useMemo<ColDef<LedgerRow>[]>(() => columns.map(({ field, headerName, valueType }) => ({
    field,
    headerName,
    // Amounts and statuses are short; give titles and IDs the spare width so they truncate less.
    minWidth: valueType === "currency" ? 120 : valueType === "status" ? 125 : 150,
    flex: valueType === "currency" || valueType === "status" ? 1 : 1.5,
    // Amounts read down a column: right-aligned, tabular figures.
    ...(valueType === "currency" ? { type: "rightAligned", cellClass: ["ag-right-aligned-cell", "ledger-number"] } : {}),
    // Status words stay as the API sends them; failures get the existing error tone so they stand out.
    ...(valueType === "status"
      ? { cellClass: "ledger-status", cellClassRules:{ "ledger-status-danger": ({ value }) => typeof value === "string" && /^(failed|blocked|reversed)$/i.test(value) } }
      : {}),
    // IDs and titles truncate in narrow columns; show the full value on hover.
    ...(valueType === "currency" ? {} : { tooltipValueGetter: ({ valueFormatted, value }) => valueFormatted ?? (value === null || value === undefined ? undefined : String(value)) }),
    valueFormatter: ({ value }) => {
      if (value === null || value === undefined) return "Unknown";
      if (valueType === "currency" && typeof value === "number") return currency.format(value / 100);
      if (valueType === "date" && typeof value === "string") {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
      }
      return String(value);
    },
  })), [columns]);

  if (rows.length === 0) return <p className="muted">{emptyMessage}</p>;
  // Paging controls only once there is more than one page's worth of rows.
  const paged = rows.length > pageSizes[0];

  return (
    <div className="ledger-grid" role="region" aria-label={label} style={{ width: "100%", minWidth: 0 }}>
      <AgGridProvider modules={modules}>
        <AgGridReact<LedgerRow>
          theme={theme}
          rowData={rows}
          columnDefs={columnDefs}
          // Narrow columns wrap their header onto two lines rather than truncating it.
          defaultColDef={{ sortable: true, filter: true, resizable: true, wrapHeaderText: true, autoHeaderHeight: true }}
          domLayout="autoHeight"
          suppressColumnVirtualisation
          tooltipShowMode="whenTruncated"
          tooltipShowDelay={300}
          pagination={paged}
          paginationPageSize={pageSizes[0]}
          paginationPageSizeSelector={paged ? pageSizes : false}
        />
      </AgGridProvider>
    </div>
  );
}
