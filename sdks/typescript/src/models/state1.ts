import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

/**
 * building: still working. submitted: entered, being checked. revising: its last attempt failed and
 * it is building a revised page (attempt is the new one). qualified / not_qualified: the check
 * finished and the agent is done. An agent that fails before ever submitting is removed from the
 * list.
 */
export const State1 = {
  Building: "building",
  Submitted: "submitted",
  Revising: "revising",
  Qualified: "qualified",
  NotQualified: "not_qualified",
} as const;
export type State1 = (typeof State1)[keyof typeof State1] | (string & {});

export const state1Schema: EnumSchema<State1> = s.enumOf<State1>(State1);
