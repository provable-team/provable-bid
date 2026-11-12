import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

export const Intent = {
  Authorize: "AUTHORIZE",
  Capture: "CAPTURE",
} as const;
export type Intent = (typeof Intent)[keyof typeof Intent] | (string & {});

export const intentSchema: EnumSchema<Intent> = s.enumOf<Intent>(Intent);
