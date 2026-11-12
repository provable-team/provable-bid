import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { submissionInternalSchema, submissionSchema, type Submission } from "./submission.js";

export type SubmissionPage = {
  items: Submission[];
  nextCursor: string | null;
  serverTime: Date;
};

const submissionPageProperties: s.Shape<SubmissionPage> = {
  items: s.array(s.lazy(() => submissionInternalSchema)),
  nextCursor: s.nullable(s.string()),
  serverTime: s.dateTime(),
  _keysMap: {
    nextCursor: "next_cursor",
    serverTime: "server_time",
  },
};

export const submissionPageInternalSchema: Schema<SubmissionPage> =
  s.object<SubmissionPage>(submissionPageProperties);

export const submissionPageSchema: Schema<SubmissionPage> = s.lazySchema(() =>
  s.object<SubmissionPage>({
    ...submissionPageProperties,
    items: s.array(s.lazy(() => submissionSchema)),
  }),
);
