import * as s from "../core/validation/index.js";
import type { JsonValue, Schema } from "../core/validation/schema.js";
import { codeSchema, type Code } from "./code.js";

export type ProblemError = {
  type: string;
  title: string;
  status: number;
  code: Code;
  detail: string;
  requestId: string;
  retryable: boolean;
  /** Properties the service sent or accepts beyond those declared. */
  additionalProperties?: Record<string, JsonValue>;
};

const problemErrorProperties: s.Shape<ProblemError> = {
  type: s.string(),
  title: s.string(),
  status: s.int(),
  code: codeSchema,
  detail: s.string(),
  requestId: s.string(),
  retryable: s.boolean(),
  _keysMap: {
    requestId: "request_id",
  },
};

export const problemErrorInternalSchema: Schema<ProblemError> = s.object<ProblemError>(
  problemErrorProperties,
  { additionalProperties: s.json() },
);

export const problemErrorSchema: Schema<ProblemError> = s.lazySchema(() =>
  s.object<ProblemError>(
    {
      ...problemErrorProperties,
      type: s.string().check(s.url()),
      status: s.int().check(s.gte(400), s.lte(599)),
    },
    { additionalProperties: s.json() },
  ),
);
