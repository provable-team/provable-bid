import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

export const ExpenseState = {
  Unknown: "unknown",
  Confirmed: "confirmed",
} as const;
export type ExpenseState = (typeof ExpenseState)[keyof typeof ExpenseState] | (string & {});

export const expenseStateSchema: EnumSchema<ExpenseState> = s.enumOf<ExpenseState>(ExpenseState);
