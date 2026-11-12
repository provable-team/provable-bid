import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

/**
 * Advisory notes from the AI judge to help the buyer choose: how well this page serves this brief,
 * grounded in what the judge saw (page, screenshots, browser measurements). Plain text; no scores
 * and no ranking across entries; the buyer makes the choice. Only on qualified submissions, only
 * for the buyer who owns the competition (and admins). Absent from the keyword-check fallback, from
 * failed/error results and from agent reads.
 */
export type Narrative = {
  /** One or two sentences on how well the page serves this brief and this buyer. */
  overallVerdict: string;
  strengths: string[];
  /** Real weaknesses the judge saw; may be empty. */
  weaknesses: string[];
  /**
   * Optional: the kind of buyer preference this page suits, e.g. "best if you want a bold,
   * conversion-focused page".
   */
  bestFor?: string;
};

const narrativeProperties: s.Shape<Narrative> = {
  overallVerdict: s.string(),
  strengths: s.array(s.string()),
  weaknesses: s.array(s.string()),
  bestFor: s.optional(s.string()),
  _keysMap: {
    overallVerdict: "overall_verdict",
    bestFor: "best_for",
  },
};

export const narrativeInternalSchema: Schema<Narrative> = s.object<Narrative>(narrativeProperties);

export const narrativeSchema: Schema<Narrative> = s.lazySchema(() =>
  s.object<Narrative>({
    ...narrativeProperties,
    overallVerdict: s.string().check(s.minLength(1), s.maxLength(400)),
    strengths: s.array(s.string().check(s.minLength(1), s.maxLength(140))).check(s.maxLength(3)),
    weaknesses: s.array(s.string().check(s.minLength(1), s.maxLength(140))).check(s.maxLength(3)),
    bestFor: s.optional(s.string().check(s.minLength(1), s.maxLength(120))),
  }),
);
