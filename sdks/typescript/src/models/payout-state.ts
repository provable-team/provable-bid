import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

/**
 * paid = PayPal Payouts item SUCCESS. pending includes UNCLAIMED and ONHOLD (money in flight).
 * blocked = held here by a refund/dispute/reversal on the buyer payment. Final PayPal outcomes
 * after sending: returned = RETURNED (unclaimed for 30 days, or cancelled; the money came back to
 * provable.bid), refunded = REFUNDED (the recipient sent it back), reversed = REVERSED. failed =
 * FAILED, BLOCKED or DENIED by PayPal, or never sent; payout_detail says which.
 */
export const PayoutState = {
  Simulated: "simulated",
  NotScheduled: "not_scheduled",
  Queued: "queued",
  Pending: "pending",
  Paid: "paid",
  Failed: "failed",
  Blocked: "blocked",
  Returned: "returned",
  Refunded: "refunded",
  Reversed: "reversed",
} as const;
export type PayoutState = (typeof PayoutState)[keyof typeof PayoutState] | (string & {});

export const payoutStateSchema: EnumSchema<PayoutState> = s.enumOf<PayoutState>(PayoutState);
