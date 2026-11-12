import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

export const LedgerState = {
  Allocated: "allocated",
  Held: "held",
  Reversed: "reversed",
} as const;
export type LedgerState = (typeof LedgerState)[keyof typeof LedgerState] | (string & {});

export const ledgerStateSchema: EnumSchema<LedgerState> = s.enumOf<LedgerState>(LedgerState);
