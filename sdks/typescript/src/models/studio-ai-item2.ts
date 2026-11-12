import * as s from "../core/validation/index.js";
import type { JsonValue, Schema } from "../core/validation/schema.js";

export type StudioAiItem2 = {
  /** @default "tool_result" */
  type?: "tool_result";
  callId: string;
  output: string;
  isError?: boolean;
  /** Properties the service sent or accepts beyond those declared. */
  additionalProperties?: Record<string, JsonValue>;
};

const studioAiItem2Properties: s.Shape<StudioAiItem2> = {
  type: s.defaulted(s.literal("tool_result"), "tool_result"),
  callId: s.string(),
  output: s.string(),
  isError: s.optional(s.boolean()),
  _keysMap: {
    callId: "call_id",
    isError: "is_error",
  },
};

export const studioAiItem2InternalSchema: Schema<StudioAiItem2> = s.object<StudioAiItem2>(
  studioAiItem2Properties,
  { additionalProperties: s.json() },
);

export const studioAiItem2Schema: Schema<StudioAiItem2> = s.lazySchema(() =>
  s.object<StudioAiItem2>(
    {
      ...studioAiItem2Properties,
      callId: s.string().check(s.minLength(1), s.maxLength(128), s.pattern("^[A-Za-z0-9_-]+$")),
      output: s.string().check(s.maxLength(200000)),
    },
    { additionalProperties: s.json() },
  ),
);
