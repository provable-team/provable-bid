import * as s from "../../core/validation/index.js";
import type { Schema } from "../../core/validation/schema.js";
import { toolChoiceSchema, type ToolChoice } from "../tool-choice.js";
import { toolChoice1InternalSchema, toolChoice1Schema, type ToolChoice1 } from "../tool-choice1.js";

export type ToolChoice2 = ToolChoice | ToolChoice1;

export const toolChoice2InternalSchema: Schema<ToolChoice2> = s.of<ToolChoice2>(
  s.union([s.lazy(() => toolChoiceSchema), s.lazy(() => toolChoice1InternalSchema)]),
);

export const toolChoice2Schema: Schema<ToolChoice2> = s.lazySchema(() =>
  s.of<ToolChoice2>(s.union([s.lazy(() => toolChoiceSchema), s.lazy(() => toolChoice1Schema)])),
);
