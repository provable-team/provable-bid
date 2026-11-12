import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

/** Authorized/checkout amount: price + processing fee. */
export type Money3 = {
  /** @default "USD" */
  currency?: "USD";
  amountMinor: number;
};

const money3Properties: s.Shape<Money3> = {
  currency: s.defaulted(s.literal("USD"), "USD"),
  amountMinor: s.int(),
  _keysMap: {
    amountMinor: "amount_minor",
  },
};

export const money3InternalSchema: Schema<Money3> = s.object<Money3>(money3Properties);

export const money3Schema: Schema<Money3> = s.lazySchema(() =>
  s.object<Money3>({
    ...money3Properties,
    amountMinor: s.int().check(s.gte(0), s.lte(1000000)),
  }),
);
