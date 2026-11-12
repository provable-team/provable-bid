"use client";

import { useMemo } from "react";
import {
  CellStyleModule,
  ClientSideRowModelModule,
  DateFilterModule,
  NumberFilterModule,
  PaginationModule,
  TextFilterModule,
  ValidationModule,
  themeQuartz,
  type ColDef,
  type GetRowIdParams,
  type ICellRendererParams,
  type Module,
} from "ag-grid-community";
import { AgGridProvider, AgGridReact } from "ag-grid-react";

type LedgerRow = Record<string, string | number | null>;
type LedgerColumn = {
  field: string;
  headerName: string;
  valueType?: "currency" | "date" | "text" | "status";
};

// Only what these ledgers use: client-side rows, pagination, the three filters and cell classes. Sorting, resizing and flex
// sizing are part of the core grid. ValidationModule explains misconfiguration in development builds only.
const modules: Module[] = [
  ClientSideRowModelModule,
  CellStyleModule, // the right-aligned amount column
  PaginationModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  ...(process.env.NODE_ENV === "development" ? [ValidationModule] : []),
];
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const theme = themeQuartz.withParams({
  accentColor: "#657b19",
  backgroundColor: "#fffef9",
  foregroundColor: "#20221d",
  headerBackgroundColor: "#f6f5ef",
  borderColor: "#dddfd4",
  rowHoverColor: "#f7f8f0",
  selectedRowBackgroundColor: "#eff4de",
  fontFamily: "DM Sans, Arial, sans-serif",
  headerFontWeight: 600,
  fontSize: 13,
  spacing: 6,
});

/** Settled, waiting or stopped: the same three tones the checkout status uses. */
export function statusTone(value: string): "success" | "pending" | "danger" | "neutral" {
  const v = value.toLowerCase();
  if (/^(paid|allocated|simulated|completed|captured)/.test(v)) return "success";
  if (/^(failed|blocked|reversed|refunded|denied|declined)/.test(v)) return "danger";
  if (/^(queued|not scheduled)/.test(v)) return "neutral"; // waiting to be sent, as on the dashboard
  if (/^(pending|held|unclaimed|processing)/.test(v)) return "pending";
  return "neutral";
}

function StatusCell({ value }: ICellRendererParams<LedgerRow, string | null>) {
  if (value === null || value === undefined || value === "") return <span className="ledger-status neutral">Unknown</span>;
  return <span className={`ledger-status ${statusTone(String(value))}`}>{String(value)}</span>;
}

const dateOf = (value: unknown) => {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Sortable, filterable view of the values supplied by the authenticated API. Rows need a stable `id`. */
export function LedgerGrid({
  label,
  columns,
  rows,
  emptyMessage = "No activity yet.",
}: {
  label: string;
  columns: LedgerColumn[];
  rows: (LedgerRow & { id: string })[];
  emptyMessage?: string;
}) {
  const columnDefs = useMemo<ColDef<LedgerRow>[]>(() => columns.map(({ field, headerName, valueType }) => ({
    field,
    headerName,
    minWidth: valueType === "status" ? 140 : 150,
    flex: 1,
    // Amounts arrive in cents. Convert in the getter (not only for display) so sorting and the number filter
    // work in dollars: typing 19 matches $19.00. Dates become Date objects so the date filter can compare them.
    ...(valueType === "currency"
      ? { valueGetter: ({ data }: { data?: LedgerRow }) => { const v = data?.[field]; return typeof v === "number" ? v / 100 : null; }, filter: "agNumberColumnFilter", type: "rightAligned" }
      : valueType === "date"
        ? { valueGetter: ({ data }: { data?: LedgerRow }) => dateOf(data?.[field]), filter: "agDateColumnFilter" }
        : { filter: "agTextColumnFilter" }),
    ...(valueType === "status" ? { cellRenderer: StatusCell } : {}),
    valueFormatter: ({ value }) => {
      if (value === null || value === undefined) return "Unknown";
      if (valueType === "currency" && typeof value === "number") return currency.format(value);
      if (valueType === "date" && value instanceof Date) return value.toLocaleString();
      return String(value);
    },
  })), [columns]);
  const defaultColDef = useMemo<ColDef<LedgerRow>>(() => ({ sortable: true, resizable: true }), []);
  const getRowId = useMemo(() => ({ data }: GetRowIdParams<LedgerRow>) => String(data.id), []);

  if (rows.length === 0) return <p className="muted">{emptyMessage}</p>;

  return (
    <div role="region" aria-label={label} style={{ width: "100%", minWidth: 0 }}>
      <AgGridProvider modules={modules}>
        <AgGridReact<LedgerRow>
          theme={theme}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={getRowId}
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
