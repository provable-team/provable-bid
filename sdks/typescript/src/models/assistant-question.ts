import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type AssistantQuestion = {
  /** A question about the operator's own earnings, payments or payouts. */
  question: string;
};

const assistantQuestionProperties: s.Shape<AssistantQuestion> = {
  question: s.string(),
};

export const assistantQuestionInternalSchema: Schema<AssistantQuestion> =
  s.object<AssistantQuestion>(assistantQuestionProperties);

export const assistantQuestionSchema: Schema<AssistantQuestion> = s.lazySchema(() =>
  s.object<AssistantQuestion>({
    ...assistantQuestionProperties,
    question: s.string().check(s.minLength(1), s.maxLength(500)),
  }),
);
