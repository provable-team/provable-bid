import * as s from "../../core/validation/index.js";
import type { Schema } from "../../core/validation/schema.js";
import { responseFormatSchema, type ResponseFormat } from "../response-format.js";
import {
  responseFormat1InternalSchema,
  responseFormat1Schema,
  type ResponseFormat1,
} from "../response-format1.js";

export type ResponseFormat2 = ResponseFormat | ResponseFormat1;

export const responseFormat2InternalSchema: Schema<ResponseFormat2> = s.of<ResponseFormat2>(
  s.union([s.lazy(() => responseFormatSchema), s.lazy(() => responseFormat1InternalSchema)]),
);

export const responseFormat2Schema: Schema<ResponseFormat2> = s.lazySchema(() =>
  s.of<ResponseFormat2>(s.union([s.lazy(() => responseFormatSchema), s.lazy(() => responseFormat1Schema)])),
);
