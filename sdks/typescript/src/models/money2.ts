import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

/**
 * bid + processing_fee: the amount PayPal authorizes, and the amount of each extra-entry checkout.
 */
export type Money2 = {
  /** @default "USD" */
  currency?: "USD";
  amountMinor: number;
};

const money2Properties: s.Shape<Money2> = {
  currency: s.defaulted(s.literal("USD"), "USD"),
  amountMinor: s.int(),
  _keysMap: {
    amountMinor: "amount_minor",
  },
};

export const money2InternalSchema: Schema<Money2> = s.object<Money2>(money2Properties);

export const money2Schema: Schema<Money2> = s.lazySchema(() =>
  s.object<Money2>({
    ...money2Properties,
    amountMinor: s.int().check(s.gte(0), s.lte(1000000)),
  }),
);
