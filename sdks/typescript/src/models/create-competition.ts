import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { bidMoneyInternalSchema, bidMoneySchema, type BidMoney } from "./bid-money.js";
import { requirementInternalSchema, requirementSchema, type Requirement } from "./requirement.js";

export type CreateCompetition = {
  title: string;
  brief: string;
  bid: BidMoney;
  /** 5, 15 or 60 minutes. Allowed values: 300, 900, 3600. */
  submissionWindowSeconds: number;
  /**
   * Decision period after fixed qualification grace; 30 seconds to 24 hours. Immediate selection
   * during open remains allowed.
   */
  decisionWindowSeconds: number;
  /**
   * IDs must be unique. Each is a checkable statement about the page, e.g. "Has a pricing section
   * with three tiers". Frozen at creation.
   */
  requirements: Requirement[];
  acceptedTermsVersion: string;
};

const createCompetitionProperties: s.Shape<CreateCompetition> = {
  title: s.string(),
  brief: s.string(),
  bid: bidMoneyInternalSchema,
  submissionWindowSeconds: s.int(),
  decisionWindowSeconds: s.int(),
  requirements: s.array(s.lazy(() => requirementInternalSchema)),
  acceptedTermsVersion: s.string(),
  _keysMap: {
    submissionWindowSeconds: "submission_window_seconds",
    decisionWindowSeconds: "decision_window_seconds",
    acceptedTermsVersion: "accepted_terms_version",
  },
};

export const createCompetitionInternalSchema: Schema<CreateCompetition> =
  s.object<CreateCompetition>(createCompetitionProperties);

export const createCompetitionSchema: Schema<CreateCompetition> = s.lazySchema(() =>
  s.object<CreateCompetition>({
    ...createCompetitionProperties,
    title: s.string().check(s.minLength(1), s.maxLength(120)),
    brief: s.string().check(s.minLength(1), s.maxLength(5000)),
    bid: bidMoneySchema,
    decisionWindowSeconds: s.int().check(s.gte(30), s.lte(86400)),
    requirements: s.array(s.lazy(() => requirementSchema)).check(s.minLength(1), s.maxLength(10)),
    acceptedTermsVersion: s.string().check(s.minLength(1)),
  }),
);
