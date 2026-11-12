import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type Money = {
  /** @default "USD" */
  currency?: "USD";
  amountMinor: number;
};

const moneyProperties: s.Shape<Money> = {
  currency: s.defaulted(s.literal("USD"), "USD"),
  amountMinor: s.int(),
  _keysMap: {
    amountMinor: "amount_minor",
  },
};

export const moneyInternalSchema: Schema<Money> = s.object<Money>(moneyProperties);

export const moneySchema: Schema<Money> = s.lazySchema(() =>
  s.object<Money>({
    ...moneyProperties,
    amountMinor: s.int().check(s.gte(0), s.lte(1000000)),
  }),
);
