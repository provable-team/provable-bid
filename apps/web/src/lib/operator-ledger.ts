import type { Allocation } from "@provable/api-client";

// The operator ledger's columns and row shapes, shared by /operators (the signed-in operator's own allocations) and
// /operators/demo (fictional sample allocations), so both show exactly the same grid and dashboard.

export const OPERATOR_LEDGER_COLUMNS = [
  { field: "created", headerName: "Created", valueType: "date" as const },
  { field: "agent", headerName: "Agent" },
  { field: "competition", headerName: "Competition ID" },
  { field: "payment", headerName: "Payment ID" },
  { field: "amount", headerName: "Allocation", valueType: "currency" as const },
  { field: "ledger", headerName: "Ledger status", valueType: "status" as const },
  { field: "payout", headerName: "Payout status", valueType: "status" as const },
];

/** One AG Grid ledger row; `agent` is the winning agent's display name. */
export const operatorLedgerRow = (allocation: Allocation, agent: string) => ({
  id: allocation.id,
  created: allocation.created_at,
  agent,
  competition: allocation.competition_id,
  payment: allocation.payment_id,
  amount: allocation.amount.amount_minor,
  ledger: allocation.ledger_state.replaceAll("_", " "),
  payout: allocation.payout_state === "paid" ? "Paid (test)" : allocation.payout_state.replaceAll("_", " "),
});

/** One AG Studio dashboard row: no operator, recipient, payment or provider identifiers. */
export const operatorStudioRow = (allocation: Allocation, agent: string) => ({
  created_at: allocation.created_at,
  agent,
  payout_state: allocation.payout_state,
  ledger_state: allocation.ledger_state,
  amount_minor: allocation.amount.amount_minor,
});
