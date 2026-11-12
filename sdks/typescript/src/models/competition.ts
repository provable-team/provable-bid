import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { bidMoneyInternalSchema, bidMoneySchema, type BidMoney } from "./bid-money.js";
import { buildProgressInternalSchema, buildProgressSchema, type BuildProgress } from "./build-progress.js";
import { money1InternalSchema, money1Schema, type Money1 } from "./money1.js";
import { money2InternalSchema, money2Schema, type Money2 } from "./money2.js";
import { outcomeSchema, type Outcome } from "./outcome.js";
import { policyInternalSchema, policySchema, type Policy } from "./policy.js";
import { requirementInternalSchema, requirementSchema, type Requirement } from "./requirement.js";
import { stateSchema, type State } from "./state.js";

export type Competition = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  id: string;
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  buyerId: string;
  title: string;
  brief: string;
  bid: BidMoney;
  requirements: Requirement[];
  submissionWindowSeconds: number;
  /**
   * Decision period after fixed qualification grace; 30 seconds to 24 hours. Immediate selection
   * during open remains allowed.
   */
  decisionWindowSeconds: number;
  policy: Policy;
  state: State;
  /**
   * rejected, no_decision (decision deadline passed) and no_qualifiers void the authorization: the
   * buyer pays nothing.
   */
  outcome: Outcome;
  initialPaymentId: string | null;
  firstPurchaseId: string | null;
  createdAt: Date;
  opensAt: Date | null;
  submissionDeadline: Date | null;
  qualificationDeadline: Date | null;
  decisionDeadline: Date | null;
  version: number;
  serverTime: Date;
  /**
   * Disclosed PayPal processing fee added to each checkout; covers PayPal's fee, never refunded by
   * PayPal.
   */
  processingFee: Money1;
  /**
   * bid + processing_fee: the amount PayPal authorizes, and the amount of each extra-entry
   * checkout.
   */
  total: Money2;
  /**
   * Only in GET /v1/competitions/{competition_id} for the buyer who owns the competition: live
   * build steps of the house agents for this run (kept in memory; empty after a restart). Absent
   * for everyone else.
   */
  buildProgress?: BuildProgress[];
};

const competitionProperties: s.Shape<Competition> = {
  id: s.string(),
  buyerId: s.string(),
  title: s.string(),
  brief: s.string(),
  bid: bidMoneyInternalSchema,
  requirements: s.array(s.lazy(() => requirementInternalSchema)),
  submissionWindowSeconds: s.int(),
  decisionWindowSeconds: s.int(),
  policy: policyInternalSchema,
  state: stateSchema,
  outcome: outcomeSchema,
  initialPaymentId: s.nullable(s.string()),
  firstPurchaseId: s.nullable(s.string()),
  createdAt: s.dateTime(),
  opensAt: s.nullable(s.dateTime()),
  submissionDeadline: s.nullable(s.dateTime()),
  qualificationDeadline: s.nullable(s.dateTime()),
  decisionDeadline: s.nullable(s.dateTime()),
  version: s.int(),
  serverTime: s.dateTime(),
  processingFee: money1InternalSchema,
  total: money2InternalSchema,
  buildProgress: s.optional(s.array(s.lazy(() => buildProgressInternalSchema))),
  _keysMap: {
    buyerId: "buyer_id",
    submissionWindowSeconds: "submission_window_seconds",
    decisionWindowSeconds: "decision_window_seconds",
    initialPaymentId: "initial_payment_id",
    firstPurchaseId: "first_purchase_id",
    createdAt: "created_at",
    opensAt: "opens_at",
    submissionDeadline: "submission_deadline",
    qualificationDeadline: "qualification_deadline",
    decisionDeadline: "decision_deadline",
    serverTime: "server_time",
    processingFee: "processing_fee",
    buildProgress: "build_progress",
  },
};

export const competitionInternalSchema: Schema<Competition> = s.object<Competition>(competitionProperties);

export const competitionSchema: Schema<Competition> = s.lazySchema(() =>
  s.object<Competition>({
    ...competitionProperties,
    id: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    buyerId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    bid: bidMoneySchema,
    requirements: s.array(s.lazy(() => requirementSchema)),
    decisionWindowSeconds: s.int().check(s.gte(30), s.lte(86400)),
    policy: policySchema,
    version: s.int().check(s.gte(1)),
    processingFee: money1Schema,
    total: money2Schema,
    buildProgress: s.optional(s.array(s.lazy(() => buildProgressSchema)).check(s.maxLength(16))),
  }),
);
