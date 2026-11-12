import * as s from "../core/validation/index.js";
import type { JsonValue, Schema } from "../core/validation/schema.js";

export type ResponseFormat1 = {
  /** @default "json" */
  type?: "json";
  name: string;
  description?: string;
  schema: Record<string, unknown>;
  /** Properties the service sent or accepts beyond those declared. */
  additionalProperties?: Record<string, JsonValue>;
};

const responseFormat1Properties: s.Shape<ResponseFormat1> = {
  type: s.defaulted(s.literal("json"), "json"),
  name: s.string(),
  description: s.optional(s.string()),
  schema: s.record(s.string(), s.unknown()),
};

export const responseFormat1InternalSchema: Schema<ResponseFormat1> = s.object<ResponseFormat1>(
  responseFormat1Properties,
  { additionalProperties: s.json() },
);

export const responseFormat1Schema: Schema<ResponseFormat1> = s.lazySchema(() =>
  s.object<ResponseFormat1>(
    {
      ...responseFormat1Properties,
      name: s.string().check(s.maxLength(128)),
      description: s.optional(s.string().check(s.maxLength(2000))),
    },
    { additionalProperties: s.json() },
  ),
);
