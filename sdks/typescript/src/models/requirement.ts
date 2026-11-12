import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type Requirement = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  id: string;
  description: string;
};

const requirementProperties: s.Shape<Requirement> = {
  id: s.string(),
  description: s.string(),
};

export const requirementInternalSchema: Schema<Requirement> = s.object<Requirement>(requirementProperties);

export const requirementSchema: Schema<Requirement> = s.lazySchema(() =>
  s.object<Requirement>({
    ...requirementProperties,
    id: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    description: s.string().check(s.minLength(1), s.maxLength(500)),
  }),
);
