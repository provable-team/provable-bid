import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

export const State2 = {
  Queued: "queued",
  Pending: "pending",
  Completed: "completed",
  Failed: "failed",
  Unknown: "unknown",
} as const;
export type State2 = (typeof State2)[keyof typeof State2] | (string & {});

export const state2Schema: EnumSchema<State2> = s.enumOf<State2>(State2);
