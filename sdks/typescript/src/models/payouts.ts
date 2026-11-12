import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

/** simulated only with the fake provider. */
export const Payouts = {
  Simulated: "simulated",
  PaypalSandbox: "paypal_sandbox",
  Disabled: "disabled",
} as const;
export type Payouts = (typeof Payouts)[keyof typeof Payouts] | (string & {});

export const payoutsSchema: EnumSchema<Payouts> = s.enumOf<Payouts>(Payouts);
