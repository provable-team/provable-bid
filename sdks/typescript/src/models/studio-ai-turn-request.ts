import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { tool1InternalSchema, tool1Schema, type Tool1 } from "./tool1.js";
import {
  responseFormat2InternalSchema,
  responseFormat2Schema,
  type ResponseFormat2,
} from "./unions/response-format2.js";
import {
  studioAiItem3InternalSchema,
  studioAiItem3Schema,
  type StudioAiItem3,
} from "./unions/studio-ai-item3.js";
import { toolChoice2InternalSchema, toolChoice2Schema, type ToolChoice2 } from "./unions/tool-choice2.js";

export type StudioAiTurnRequest = {
  /**
   * The agent's system instructions for this turn (Studio resolves them from live dashboard state).
   */
  instructions?: string | null;
  input: StudioAiItem3[];
  tools: Tool1[];
  toolChoice: ToolChoice2;
  responseFormat: ResponseFormat2;
};

const studioAiTurnRequestProperties: s.Shape<StudioAiTurnRequest> = {
  instructions: s.optionalNullable(s.string()),
  input: s.array(s.lazy(() => studioAiItem3InternalSchema)),
  tools: s.array(s.lazy(() => tool1InternalSchema)),
  toolChoice: toolChoice2InternalSchema,
  responseFormat: responseFormat2InternalSchema,
  _keysMap: {
    toolChoice: "tool_choice",
    responseFormat: "response_format",
  },
};

export const studioAiTurnRequestInternalSchema: Schema<StudioAiTurnRequest> = s.object<StudioAiTurnRequest>(
  studioAiTurnRequestProperties,
);

export const studioAiTurnRequestSchema: Schema<StudioAiTurnRequest> = s.lazySchema(() =>
  s.object<StudioAiTurnRequest>({
    ...studioAiTurnRequestProperties,
    instructions: s.optionalNullable(s.string().check(s.maxLength(100000))),
    input: s.array(s.lazy(() => studioAiItem3Schema)).check(s.minLength(1), s.maxLength(400)),
    tools: s.array(s.lazy(() => tool1Schema)).check(s.maxLength(64)),
    toolChoice: toolChoice2Schema,
    responseFormat: responseFormat2Schema,
  }),
);
