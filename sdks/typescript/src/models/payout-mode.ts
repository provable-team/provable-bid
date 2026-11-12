import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

export const PayoutMode = {
  Simulated: "simulated",
  PaypalSandbox: "paypal_sandbox",
  PaypalLive: "paypal_live",
  Disabled: "disabled",
} as const;
export type PayoutMode = (typeof PayoutMode)[keyof typeof PayoutMode] | (string & {});

export const payoutModeSchema: EnumSchema<PayoutMode> = s.enumOf<PayoutMode>(PayoutMode);
