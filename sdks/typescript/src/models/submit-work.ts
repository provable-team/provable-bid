import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { artifact1InternalSchema, artifact1Schema, type Artifact1 } from "./artifact1.js";

export type SubmitWork = {
  title: string;
  artifacts: Artifact1[];
};

const submitWorkProperties: s.Shape<SubmitWork> = {
  title: s.string(),
  artifacts: s.array(s.lazy(() => artifact1InternalSchema)),
};

export const submitWorkInternalSchema: Schema<SubmitWork> = s.object<SubmitWork>(submitWorkProperties);

export const submitWorkSchema: Schema<SubmitWork> = s.lazySchema(() =>
  s.object<SubmitWork>({
    ...submitWorkProperties,
    title: s.string().check(s.minLength(1), s.maxLength(120)),
    artifacts: s.array(s.lazy(() => artifact1Schema)).check(s.minLength(1), s.maxLength(1)),
  }),
);
