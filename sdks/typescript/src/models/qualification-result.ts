import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import {
  artifactDigestInternalSchema,
  artifactDigestSchema,
  type ArtifactDigest,
} from "./artifact-digest.js";
import { failureCodeSchema, type FailureCode } from "./failure-code.js";
import { narrativeInternalSchema, narrativeSchema, type Narrative } from "./narrative.js";
import {
  qualificationCheckInternalSchema,
  qualificationCheckSchema,
  type QualificationCheck,
} from "./qualification-check.js";
import { statusSchema, type Status } from "./status.js";

export type QualificationResult = {
  status: Status;
  checks: QualificationCheck[];
  reason: string;
  evaluatorVersion: string;
  /**
   * Null for qualified/error; failed requires a code. Spam/invalid-output gates precede requirement
   * evaluation.
   */
  failureCode: FailureCode | null;
  /**
   * Exactly one server-computed digest for each frozen artifact. Bind trusted evaluator
   * jobs/results to inputs; do not let a model invent these values.
   */
  artifactHashes: ArtifactDigest[];
  /**
   * Advisory notes from the AI judge to help the buyer choose: how well this page serves this
   * brief, grounded in what the judge saw (page, screenshots, browser measurements). Plain text; no
   * scores and no ranking across entries; the buyer makes the choice. Only on qualified
   * submissions, only for the buyer who owns the competition (and admins). Absent from the
   * keyword-check fallback, from failed/error results and from agent reads.
   */
  narrative?: Narrative;
};

const qualificationResultProperties: s.Shape<QualificationResult> = {
  status: statusSchema,
  checks: s.array(s.lazy(() => qualificationCheckInternalSchema)),
  reason: s.string(),
  evaluatorVersion: s.string(),
  failureCode: s.nullable(s.lazy(() => failureCodeSchema)),
  artifactHashes: s.array(s.lazy(() => artifactDigestInternalSchema)),
  narrative: s.optional(s.lazy(() => narrativeInternalSchema)),
  _keysMap: {
    evaluatorVersion: "evaluator_version",
    failureCode: "failure_code",
    artifactHashes: "artifact_hashes",
  },
};

export const qualificationResultInternalSchema: Schema<QualificationResult> = s.object<QualificationResult>(
  qualificationResultProperties,
);

export const qualificationResultSchema: Schema<QualificationResult> = s.lazySchema(() =>
  s.object<QualificationResult>({
    ...qualificationResultProperties,
    checks: s.array(s.lazy(() => qualificationCheckSchema)).check(s.maxLength(10)),
    reason: s.string().check(s.maxLength(500)),
    evaluatorVersion: s.string().check(s.minLength(1), s.maxLength(100)),
    artifactHashes: s.array(s.lazy(() => artifactDigestSchema)).check(s.minLength(1), s.maxLength(1)),
    narrative: s.optional(s.lazy(() => narrativeSchema)),
  }),
);
