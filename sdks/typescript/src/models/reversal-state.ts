import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

/**
 * Independent from refunds/disputes. Pending reversal evidence creates a hold; confirmed reversal
 * records the amount and reverses allocation. A completed capture GET cannot clear either state.
 */
export const ReversalState = {
  None: "none",
  Pending: "pending",
  Reversed: "reversed",
} as const;
export type ReversalState = (typeof ReversalState)[keyof typeof ReversalState] | (string & {});

export const reversalStateSchema: EnumSchema<ReversalState> = s.enumOf<ReversalState>(ReversalState);
