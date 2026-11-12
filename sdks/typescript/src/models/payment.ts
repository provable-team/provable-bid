import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { authorizationStateSchema, type AuthorizationState } from "./authorization-state.js";
import { captureStateSchema, type CaptureState } from "./capture-state.js";
import { disputeStateSchema, type DisputeState } from "./dispute-state.js";
import { money3InternalSchema, money3Schema, type Money3 } from "./money3.js";
import { operationStateSchema, type OperationState } from "./operation-state.js";
import { purposeSchema, type Purpose } from "./purpose.js";
import { refundStateSchema, type RefundState } from "./refund-state.js";
import { reversalStateSchema, type ReversalState } from "./reversal-state.js";

export type Payment = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  id: string;
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  competitionId: string;
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  buyerId: string;
  /** initial changes to first_purchase when the winner is selected. */
  purpose: Purpose;
  /** Authorized/checkout amount: price + processing fee. */
  amount: Money3;
  authorizationState: AuthorizationState;
  /** completed means provider-confirmed capture, not irreversible funds or payout. */
  captureState: CaptureState;
  operationState: OperationState;
  /** Stable logical financial command ID; internal operation journal retains all prior IDs. */
  operationId: string | null;
  providerOrderId: string | null;
  providerAuthorizationId: string | null;
  providerCaptureId: string | null;
  /**
   * Provider-reported authorization creation time, never callback receipt, browser time, or restart
   * time. Safety horizon and expiry derive from this origin.
   */
  authorizedAt: Date | null;
  authorizationExpiresAt: Date | null;
  capturedMinor: number;
  refundedMinor: number;
  refundState: RefundState;
  disputeState: DisputeState;
  lastErrorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  serverTime: Date;
  /**
   * Independent from refunds/disputes. Pending reversal evidence creates a hold; confirmed reversal
   * records the amount and reverses allocation. A completed capture GET cannot clear either state.
   */
  reversalState: ReversalState;
  reversedMinor: number;
  /**
   * Confirmed capture-processing expense only; null is unknown, not zero. Expenses are never
   * charged above the agreed buyer price. Demo policy absorbs all provider expenses.
   */
  providerExpenseMinor: number | null;
};

const paymentProperties: s.Shape<Payment> = {
  id: s.string(),
  competitionId: s.string(),
  buyerId: s.string(),
  purpose: purposeSchema,
  amount: money3InternalSchema,
  authorizationState: authorizationStateSchema,
  captureState: captureStateSchema,
  operationState: operationStateSchema,
  operationId: s.nullable(s.string()),
  providerOrderId: s.nullable(s.string()),
  providerAuthorizationId: s.nullable(s.string()),
  providerCaptureId: s.nullable(s.string()),
  authorizedAt: s.nullable(s.dateTime()),
  authorizationExpiresAt: s.nullable(s.dateTime()),
  capturedMinor: s.int(),
  refundedMinor: s.int(),
  refundState: refundStateSchema,
  disputeState: disputeStateSchema,
  lastErrorCode: s.nullable(s.string()),
  createdAt: s.dateTime(),
  updatedAt: s.dateTime(),
  serverTime: s.dateTime(),
  reversalState: reversalStateSchema,
  reversedMinor: s.int(),
  providerExpenseMinor: s.nullable(s.int()),
  _keysMap: {
    competitionId: "competition_id",
    buyerId: "buyer_id",
    authorizationState: "authorization_state",
    captureState: "capture_state",
    operationState: "operation_state",
    operationId: "operation_id",
    providerOrderId: "provider_order_id",
    providerAuthorizationId: "provider_authorization_id",
    providerCaptureId: "provider_capture_id",
    authorizedAt: "authorized_at",
    authorizationExpiresAt: "authorization_expires_at",
    capturedMinor: "captured_minor",
    refundedMinor: "refunded_minor",
    refundState: "refund_state",
    disputeState: "dispute_state",
    lastErrorCode: "last_error_code",
    createdAt: "created_at",
    updatedAt: "updated_at",
    serverTime: "server_time",
    reversalState: "reversal_state",
    reversedMinor: "reversed_minor",
    providerExpenseMinor: "provider_expense_minor",
  },
};

export const paymentInternalSchema: Schema<Payment> = s.object<Payment>(paymentProperties);

export const paymentSchema: Schema<Payment> = s.lazySchema(() =>
  s.object<Payment>({
    ...paymentProperties,
    id: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    competitionId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    buyerId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    amount: money3Schema,
    capturedMinor: s.int().check(s.gte(0), s.lte(1000000)),
    refundedMinor: s.int().check(s.gte(0), s.lte(1000000)),
    reversedMinor: s.int().check(s.gte(0), s.lte(1000000)),
    providerExpenseMinor: s.nullable(s.int().check(s.gte(0), s.lte(1000000))),
  }),
);
