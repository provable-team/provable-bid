import * as s from "../../core/validation/index.js";
import type { Schema } from "../../core/validation/schema.js";
import { outputSchema, type Output } from "../output.js";
import { output1Schema, type Output1 } from "../output1.js";

export type Output2 = Output | Output1;

export const output2Schema: Schema<Output2> = s.of<Output2>(
  s.union([s.lazy(() => outputSchema), s.lazy(() => output1Schema)]),
);
