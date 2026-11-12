import * as s from "../core/validation/index.js";
import type { JsonValue, Schema } from "../core/validation/schema.js";

export type ResponseFormat = {
  /** @default "text" */
  type?: "text";
  /** Properties the service sent or accepts beyond those declared. */
  additionalProperties?: Record<string, JsonValue>;
};

export const responseFormatSchema: Schema<ResponseFormat> = s.object<ResponseFormat>(
  {
    type: s.defaulted(s.literal("text"), "text"),
  },
  { additionalProperties: s.json() },
);
