import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { sourceSchema, type Source } from "./source.js";
import { status3Schema, type Status3 } from "./status3.js";
import { toolSchema, type Tool } from "./tool.js";

/** One lookup the assistant made while answering, in order. */
export type AssistantLookup = {
  tool: Tool;
  /**
   * ledger: the operator's allocations here. paypal_agent_toolkit: a read-only PayPal Agent Toolkit
   * tool. paypal_payouts: PayPal Payouts.
   */
  source: Source;
  /** The PayPal order, capture, refund or payout batch ID looked up, when there is one. */
  ref: string | null;
  /** refused: the ID is not one of this operator's references, so PayPal was not called. */
  status: Status3;
  summary: string;
};

const assistantLookupProperties: s.Shape<AssistantLookup> = {
  tool: toolSchema,
  source: sourceSchema,
  ref: s.nullable(s.string()),
  status: status3Schema,
  summary: s.string(),
};

export const assistantLookupInternalSchema: Schema<AssistantLookup> =
  s.object<AssistantLookup>(assistantLookupProperties);

export const assistantLookupSchema: Schema<AssistantLookup> = s.lazySchema(() =>
  s.object<AssistantLookup>({
    ...assistantLookupProperties,
    ref: s.nullable(s.string().check(s.maxLength(64))),
    summary: s.string().check(s.maxLength(300)),
  }),
);
