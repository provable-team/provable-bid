import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

export const QualificationStatus = {
  Pending: "pending",
  Qualified: "qualified",
  Failed: "failed",
  Error: "error",
} as const;
export type QualificationStatus =
  | (typeof QualificationStatus)[keyof typeof QualificationStatus]
  | (string & {});

export const qualificationStatusSchema: EnumSchema<QualificationStatus> =
  s.enumOf<QualificationStatus>(QualificationStatus);
