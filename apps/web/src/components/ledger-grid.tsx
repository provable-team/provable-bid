"use client";

import { useMemo } from "react";
import { AllCommunityModule, themeQuartz, type ColDef } from "ag-grid-community";
import { AgGridProvider, AgGridReact } from "ag-grid-react";

type LedgerRow = Record<string, string | number | null>;
type LedgerColumn = {
  field: string;
  headerName: string;
  valueType?: "currency" | "date" | "text";
};

const modules = [AllCommunityModule];
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
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
    minWidth: 150,
    flex: 1,
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

  return (
    <div role="region" aria-label={label} style={{ width: "100%", minWidth: 0 }}>
      <AgGridProvider modules={modules}>
        <AgGridReact<LedgerRow>
          theme={theme}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: true, filter: true, resizable: true }}
          domLayout="autoHeight"
          suppressColumnVirtualisation
          pagination
          paginationPageSize={10}
          paginationPageSizeSelector={[10, 25, 50]}
        />
      </AgGridProvider>
    </div>
  );
}
