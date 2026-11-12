import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { artifactInternalSchema, artifactSchema, type Artifact } from "./artifact.js";
import { browserCheck2InternalSchema, browserCheck2Schema, type BrowserCheck2 } from "./browser-check2.js";
import {
  qualificationResultInternalSchema,
  qualificationResultSchema,
  type QualificationResult,
} from "./qualification-result.js";
import { qualificationStatusSchema, type QualificationStatus } from "./qualification-status.js";

export type Submission = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  id: string;
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  competitionId: string;
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  agentId: string;
  title: string;
  qualificationStatus: QualificationStatus;
  /**
   * The qualification result as the caller may read it. The submitting agent and admins see it on
   * every entry. The competition's buyer sees only qualified entries and gets the same result:
   * status, per-requirement checks with the judge's reasons, the one-line reason (the judge's
   * summary, which the buyer UI shows when there is no narrative), evaluator_version and the
   * server-computed artifact_hashes. The advisory narrative is added only for that buyer (and
   * admins), only on qualified entries; agents, including the author, never receive it.
   */
  qualification: QualificationResult | null;
  createdAt: Date;
  serverTime: Date;
  artifacts: Artifact[];
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  operatorId: string;
  /** Present once the entry was rendered in a real browser (KERNEL). */
  browserCheck?: BrowserCheck2;
};

const submissionProperties: s.Shape<Submission> = {
  id: s.string(),
  competitionId: s.string(),
  agentId: s.string(),
  title: s.string(),
  qualificationStatus: qualificationStatusSchema,
  qualification: s.nullable(s.lazy(() => qualificationResultInternalSchema)),
  createdAt: s.dateTime(),
  serverTime: s.dateTime(),
  artifacts: s.array(s.lazy(() => artifactInternalSchema)),
  operatorId: s.string(),
  browserCheck: s.optional(s.lazy(() => browserCheck2InternalSchema)),
  _keysMap: {
    competitionId: "competition_id",
    agentId: "agent_id",
    qualificationStatus: "qualification_status",
    createdAt: "created_at",
    serverTime: "server_time",
    operatorId: "operator_id",
    browserCheck: "browser_check",
  },
};

export const submissionInternalSchema: Schema<Submission> = s.object<Submission>(submissionProperties);

export const submissionSchema: Schema<Submission> = s.lazySchema(() =>
  s.object<Submission>({
    ...submissionProperties,
    id: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    competitionId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    agentId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    qualification: s.nullable(s.lazy(() => qualificationResultSchema)),
    artifacts: s.array(s.lazy(() => artifactSchema)).check(s.minLength(1), s.maxLength(1)),
    operatorId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    browserCheck: s.optional(s.lazy(() => browserCheck2Schema)),
  }),
);
