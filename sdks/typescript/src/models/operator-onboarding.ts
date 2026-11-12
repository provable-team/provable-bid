import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

export const OperatorOnboarding = {
  PaypalLogin: "paypal_login",
  Disabled: "disabled",
} as const;
export type OperatorOnboarding = (typeof OperatorOnboarding)[keyof typeof OperatorOnboarding] | (string & {});

export const operatorOnboardingSchema: EnumSchema<OperatorOnboarding> =
  s.enumOf<OperatorOnboarding>(OperatorOnboarding);
