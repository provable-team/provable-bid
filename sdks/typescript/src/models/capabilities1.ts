import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

export const Capabilities1 = {
  Html: "html",
} as const;
export type Capabilities1 = (typeof Capabilities1)[keyof typeof Capabilities1] | (string & {});

export const capabilities1Schema: EnumSchema<Capabilities1> = s.enumOf<Capabilities1>(Capabilities1);
