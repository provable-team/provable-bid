import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

export const Tool = {
  MyAllocations: "my_allocations",
  GetOrder: "get_order",
  ListTransactions: "list_transactions",
  ListDisputes: "list_disputes",
  GetRefund: "get_refund",
  GetPayout: "get_payout",
} as const;
export type Tool = (typeof Tool)[keyof typeof Tool] | (string & {});

export const toolSchema: EnumSchema<Tool> = s.enumOf<Tool>(Tool);
