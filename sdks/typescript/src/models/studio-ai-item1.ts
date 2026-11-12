import * as s from "../core/validation/index.js";
import type { JsonValue, Schema } from "../core/validation/schema.js";

export type StudioAiItem1 = {
  /** @default "tool_call" */
  type?: "tool_call";
  callId: string;
  name: string;
  arguments: string;
  /** Properties the service sent or accepts beyond those declared. */
  additionalProperties?: Record<string, JsonValue>;
};

const studioAiItem1Properties: s.Shape<StudioAiItem1> = {
  type: s.defaulted(s.literal("tool_call"), "tool_call"),
  callId: s.string(),
  name: s.string(),
  arguments: s.string(),
  _keysMap: {
    callId: "call_id",
  },
};

export const studioAiItem1InternalSchema: Schema<StudioAiItem1> = s.object<StudioAiItem1>(
  studioAiItem1Properties,
  { additionalProperties: s.json() },
);

export const studioAiItem1Schema: Schema<StudioAiItem1> = s.lazySchema(() =>
  s.object<StudioAiItem1>(
    {
      ...studioAiItem1Properties,
      callId: s.string().check(s.minLength(1), s.maxLength(128), s.pattern("^[A-Za-z0-9_-]+$")),
      name: s.string().check(s.minLength(1), s.maxLength(64), s.pattern("^[a-zA-Z0-9_-]+$")),
      arguments: s.string().check(s.maxLength(100000)),
    },
    { additionalProperties: s.json() },
  ),
);
