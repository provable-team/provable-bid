import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

/**
 * Disclosed PayPal processing fee added to each checkout; covers PayPal's fee, never refunded by
 * PayPal.
 */
export type Money1 = {
  /** @default "USD" */
  currency?: "USD";
  amountMinor: number;
};

const money1Properties: s.Shape<Money1> = {
  currency: s.defaulted(s.literal("USD"), "USD"),
  amountMinor: s.int(),
  _keysMap: {
    amountMinor: "amount_minor",
  },
};

export const money1InternalSchema: Schema<Money1> = s.object<Money1>(money1Properties);

export const money1Schema: Schema<Money1> = s.lazySchema(() =>
  s.object<Money1>({
    ...money1Properties,
    amountMinor: s.int().check(s.gte(0), s.lte(1000000)),
  }),
);
