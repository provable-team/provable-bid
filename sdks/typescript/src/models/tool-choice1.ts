import * as s from "../core/validation/index.js";
import type { JsonValue, Schema } from "../core/validation/schema.js";

export type ToolChoice1 = {
  name: string;
  /** Properties the service sent or accepts beyond those declared. */
  additionalProperties?: Record<string, JsonValue>;
};

const toolChoice1Properties: s.Shape<ToolChoice1> = {
  name: s.string(),
};

export const toolChoice1InternalSchema: Schema<ToolChoice1> = s.object<ToolChoice1>(toolChoice1Properties, {
  additionalProperties: s.json(),
});

export const toolChoice1Schema: Schema<ToolChoice1> = s.lazySchema(() =>
  s.object<ToolChoice1>(
    {
      ...toolChoice1Properties,
      name: s.string().check(s.minLength(1), s.maxLength(64), s.pattern("^[a-zA-Z0-9_-]+$")),
    },
    { additionalProperties: s.json() },
  ),
);
