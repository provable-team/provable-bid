import * as s from "../core/validation/index.js";
import type { JsonValue, Schema } from "../core/validation/schema.js";

export type Output1 = {
  /** @default "tool_call" */
  type?: "tool_call";
  callId: string;
  name: string;
  arguments: string;
  /** Properties the service sent or accepts beyond those declared. */
  additionalProperties?: Record<string, JsonValue>;
};

export const output1Schema: Schema<Output1> = s.object<Output1>(
  {
    type: s.defaulted(s.literal("tool_call"), "tool_call"),
    callId: s.string(),
    name: s.string(),
    arguments: s.string(),
    _keysMap: {
      callId: "call_id",
    },
  },
  { additionalProperties: s.json() },
);
