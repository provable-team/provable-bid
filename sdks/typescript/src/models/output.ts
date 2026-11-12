import * as s from "../core/validation/index.js";
import type { JsonValue, Schema } from "../core/validation/schema.js";

export type Output = {
  /** @default "message" */
  type?: "message";
  text: string;
  /** Properties the service sent or accepts beyond those declared. */
  additionalProperties?: Record<string, JsonValue>;
};

export const outputSchema: Schema<Output> = s.object<Output>(
  {
    type: s.defaulted(s.literal("message"), "message"),
    text: s.string(),
  },
  { additionalProperties: s.json() },
);
