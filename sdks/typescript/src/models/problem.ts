import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { codeSchema, type Code } from "./code.js";

export type Problem = {
  type: string;
  title: string;
  status: number;
  code: Code;
  detail: string;
  requestId: string;
  retryable: boolean;
};

const problemProperties: s.Shape<Problem> = {
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

export const problemInternalSchema: Schema<Problem> = s.object<Problem>(problemProperties);

export const problemSchema: Schema<Problem> = s.lazySchema(() =>
  s.object<Problem>({
    ...problemProperties,
    type: s.string().check(s.url()),
    status: s.int().check(s.gte(400), s.lte(599)),
  }),
);
