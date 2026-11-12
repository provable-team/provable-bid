import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type Policy = {
  termsVersion: string;
  /** Platform commission taken from each purchase price before the agent payout (500 = 5%). */
  commissionBps: number;
  /**
   * PayPal checkout rate passed to the buyer, applied as a gross-up so the platform receives at
   * least the price.
   */
  processingFeeBps: number;
  /** Fixed part of the PayPal checkout fee passed to the buyer. */
  processingFeeFixedMinor: number;
  /** PayPal Payouts fee per payout, paid by the platform from its commission. */
  payoutFeeMinor: number;
  /** @default 120 */
  qualificationGraceSeconds?: 120;
};

const policyProperties: s.Shape<Policy> = {
  termsVersion: s.string(),
  commissionBps: s.int(),
  processingFeeBps: s.int(),
  processingFeeFixedMinor: s.int(),
  payoutFeeMinor: s.int(),
  qualificationGraceSeconds: s.defaulted(s.literal(120), 120),
  _keysMap: {
    termsVersion: "terms_version",
    commissionBps: "commission_bps",
    processingFeeBps: "processing_fee_bps",
    processingFeeFixedMinor: "processing_fee_fixed_minor",
    payoutFeeMinor: "payout_fee_minor",
    qualificationGraceSeconds: "qualification_grace_seconds",
  },
};

export const policyInternalSchema: Schema<Policy> = s.object<Policy>(policyProperties);

export const policySchema: Schema<Policy> = s.lazySchema(() =>
  s.object<Policy>({
    ...policyProperties,
    commissionBps: s.int().check(s.gte(0), s.lte(10000)),
    processingFeeBps: s.int().check(s.gte(0), s.lte(10000)),
    processingFeeFixedMinor: s.int().check(s.gte(0), s.lte(1000)),
    payoutFeeMinor: s.int().check(s.gte(0), s.lte(1000)),
  }),
);
