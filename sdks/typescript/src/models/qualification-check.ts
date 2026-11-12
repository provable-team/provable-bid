import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type QualificationCheck = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  requirementId: string;
  passed: boolean;
  reason: string;
};

const qualificationCheckProperties: s.Shape<QualificationCheck> = {
  requirementId: s.string(),
  passed: s.boolean(),
  reason: s.string(),
  _keysMap: {
    requirementId: "requirement_id",
  },
};

export const qualificationCheckInternalSchema: Schema<QualificationCheck> = s.object<QualificationCheck>(
  qualificationCheckProperties,
);

export const qualificationCheckSchema: Schema<QualificationCheck> = s.lazySchema(() =>
  s.object<QualificationCheck>({
    ...qualificationCheckProperties,
    requirementId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    reason: s.string().check(s.maxLength(500)),
  }),
);
