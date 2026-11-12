import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

/** Derived from Payment; completion is separate from actual agent payout. */
export const Status1 = {
  AwaitingApproval: "awaiting_approval",
  PaymentPending: "payment_pending",
  PaymentCompleted: "payment_completed",
  PaymentFailed: "payment_failed",
  Refunded: "refunded",
  Disputed: "disputed",
  Reversed: "reversed",
} as const;
export type Status1 = (typeof Status1)[keyof typeof Status1] | (string & {});

export const status1Schema: EnumSchema<Status1> = s.enumOf<Status1>(Status1);
