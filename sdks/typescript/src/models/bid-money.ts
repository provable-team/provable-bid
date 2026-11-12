import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type BidMoney = {
  /** @default "USD" */
  currency?: "USD";
  /** Price per selected entry, $5.00 to $5,000.00. */
  amountMinor: number;
};

const bidMoneyProperties: s.Shape<BidMoney> = {
  currency: s.defaulted(s.literal("USD"), "USD"),
  amountMinor: s.int(),
  _keysMap: {
    amountMinor: "amount_minor",
  },
};

export const bidMoneyInternalSchema: Schema<BidMoney> = s.object<BidMoney>(bidMoneyProperties);

export const bidMoneySchema: Schema<BidMoney> = s.lazySchema(() =>
  s.object<BidMoney>({
    ...bidMoneyProperties,
    amountMinor: s.int().check(s.gte(500), s.lte(500000)),
  }),
);
