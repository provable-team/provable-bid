import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

/** incomplete: the turn hit its output cap. refused: the model declined; output is empty. */
export const Status4 = {
  Completed: "completed",
  Incomplete: "incomplete",
  Refused: "refused",
} as const;
export type Status4 = (typeof Status4)[keyof typeof Status4] | (string & {});

export const status4Schema: EnumSchema<Status4> = s.enumOf<Status4>(Status4);
