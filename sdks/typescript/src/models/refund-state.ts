import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

export const RefundState = {
  None: "none",
  Pending: "pending",
  PartiallyRefunded: "partially_refunded",
  Refunded: "refunded",
  Failed: "failed",
} as const;
export type RefundState = (typeof RefundState)[keyof typeof RefundState] | (string & {});

export const refundStateSchema: EnumSchema<RefundState> = s.enumOf<RefundState>(RefundState);
