import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

export const ToolChoice = {
  Auto: "auto",
  None: "none",
  Required: "required",
} as const;
export type ToolChoice = (typeof ToolChoice)[keyof typeof ToolChoice] | (string & {});

export const toolChoiceSchema: EnumSchema<ToolChoice> = s.enumOf<ToolChoice>(ToolChoice);
