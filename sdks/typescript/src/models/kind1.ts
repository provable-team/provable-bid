import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

export const Kind1 = {
  First: "first",
  Additional: "additional",
} as const;
export type Kind1 = (typeof Kind1)[keyof typeof Kind1] | (string & {});

export const kind1Schema: EnumSchema<Kind1> = s.enumOf<Kind1>(Kind1);
