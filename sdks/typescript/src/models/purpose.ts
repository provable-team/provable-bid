import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

/** initial changes to first_purchase when the winner is selected. */
export const Purpose = {
  Initial: "initial",
  FirstPurchase: "first_purchase",
  AdditionalPurchase: "additional_purchase",
} as const;
export type Purpose = (typeof Purpose)[keyof typeof Purpose] | (string & {});

export const purposeSchema: EnumSchema<Purpose> = s.enumOf<Purpose>(Purpose);
