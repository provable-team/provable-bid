import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

/**
 * ledger: the operator's allocations here. paypal_agent_toolkit: a read-only PayPal Agent Toolkit
 * tool. paypal_payouts: PayPal Payouts.
 */
export const Source = {
  Ledger: "ledger",
  PaypalAgentToolkit: "paypal_agent_toolkit",
  PaypalPayouts: "paypal_payouts",
} as const;
export type Source = (typeof Source)[keyof typeof Source] | (string & {});

export const sourceSchema: EnumSchema<Source> = s.enumOf<Source>(Source);
