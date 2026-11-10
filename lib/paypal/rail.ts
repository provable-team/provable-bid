import "server-only";
import type { PaymentRail } from "@/lib/market";
import { describePayPalError } from "./orders";
import { getPayoutStatus, getRefundStatus, refundCapture, sendPayout } from "./payments";

// The real PayPal sandbox/live rail behind lib/market's PaymentRail interface.
export const paypalRail: PaymentRail = {
  refund: refundCapture,
  refundStatus: getRefundStatus,
  payout: sendPayout,
  payoutStatus: getPayoutStatus,
  describeError: describePayPalError,
};
