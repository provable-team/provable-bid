import * as s from "../core/validation/index.js";
import type { JsonValue, Schema } from "../core/validation/schema.js";
import { roleSchema, type Role } from "./role.js";

export type StudioAiItem = {
  /** @default "message" */
  type?: "message";
  role: Role;
  text: string;
  /** Properties the service sent or accepts beyond those declared. */
  additionalProperties?: Record<string, JsonValue>;
};

const studioAiItemProperties: s.Shape<StudioAiItem> = {
  type: s.defaulted(s.literal("message"), "message"),
  role: roleSchema,
  text: s.string(),
};

export const studioAiItemInternalSchema: Schema<StudioAiItem> = s.object<StudioAiItem>(
  studioAiItemProperties,
  { additionalProperties: s.json() },
);

export const studioAiItemSchema: Schema<StudioAiItem> = s.lazySchema(() =>
  s.object<StudioAiItem>(
    {
      ...studioAiItemProperties,
      text: s.string().check(s.maxLength(100000)),
    },
    { additionalProperties: s.json() },
  ),
);
