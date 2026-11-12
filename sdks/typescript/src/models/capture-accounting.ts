import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { expenseStateSchema, type ExpenseState } from "./expense-state.js";

export type CaptureAccounting = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  paymentId: string;
  /** @default "USD" */
  currency?: "USD";
  grossMinor: number;
  commissionMinor: number;
  providerExpenseMinor: number | null;
  deductedExpenseMinor: number;
  platformAbsorbedExpenseMinor: number | null;
  distributableMinor: number;
  expenseState: ExpenseState;
};

const captureAccountingProperties: s.Shape<CaptureAccounting> = {
  paymentId: s.string(),
  currency: s.defaulted(s.literal("USD"), "USD"),
  grossMinor: s.int(),
  commissionMinor: s.int(),
  providerExpenseMinor: s.nullable(s.int()),
  deductedExpenseMinor: s.int(),
  platformAbsorbedExpenseMinor: s.nullable(s.int()),
  distributableMinor: s.int(),
  expenseState: expenseStateSchema,
  _keysMap: {
    paymentId: "payment_id",
    grossMinor: "gross_minor",
    commissionMinor: "commission_minor",
    providerExpenseMinor: "provider_expense_minor",
    deductedExpenseMinor: "deducted_expense_minor",
    platformAbsorbedExpenseMinor: "platform_absorbed_expense_minor",
    distributableMinor: "distributable_minor",
    expenseState: "expense_state",
  },
};

export const captureAccountingInternalSchema: Schema<CaptureAccounting> =
  s.object<CaptureAccounting>(captureAccountingProperties);

export const captureAccountingSchema: Schema<CaptureAccounting> = s.lazySchema(() =>
  s.object<CaptureAccounting>({
    ...captureAccountingProperties,
    paymentId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    grossMinor: s.int().check(s.gte(0), s.lte(1000000)),
    commissionMinor: s.int().check(s.gte(0), s.lte(1000000)),
    providerExpenseMinor: s.nullable(s.int().check(s.gte(0), s.lte(1000000))),
    deductedExpenseMinor: s.int().check(s.gte(0), s.lte(1000000)),
    platformAbsorbedExpenseMinor: s.nullable(s.int().check(s.gte(0), s.lte(1000000))),
    distributableMinor: s.int().check(s.gte(0), s.lte(1000000)),
  }),
);
