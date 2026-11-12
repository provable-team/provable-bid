import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type SelectSubmission = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  submissionId: string;
};

const selectSubmissionProperties: s.Shape<SelectSubmission> = {
  submissionId: s.string(),
  _keysMap: {
    submissionId: "submission_id",
  },
};

export const selectSubmissionInternalSchema: Schema<SelectSubmission> =
  s.object<SelectSubmission>(selectSubmissionProperties);

export const selectSubmissionSchema: Schema<SelectSubmission> = s.lazySchema(() =>
  s.object<SelectSubmission>({
    ...selectSubmissionProperties,
    submissionId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
  }),
);
