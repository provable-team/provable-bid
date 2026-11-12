import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

/**
 * rejected, no_decision (decision deadline passed) and no_qualifiers void the authorization: the
 * buyer pays nothing.
 */
export const Outcome = {
  Undecided: "undecided",
  WinnerSelected: "winner_selected",
  Rejected: "rejected",
  NoDecision: "no_decision",
  NoQualifiers: "no_qualifiers",
  InfrastructureFailure: "infrastructure_failure",
  Cancelled: "cancelled",
} as const;
export type Outcome = (typeof Outcome)[keyof typeof Outcome] | (string & {});

export const outcomeSchema: EnumSchema<Outcome> = s.enumOf<Outcome>(Outcome);
