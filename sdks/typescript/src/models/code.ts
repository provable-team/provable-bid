import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

export const Code = {
  ValidationError: "VALIDATION_ERROR",
  InvalidWebhook: "INVALID_WEBHOOK",
  Unauthenticated: "UNAUTHENTICATED",
  Forbidden: "FORBIDDEN",
  NotFound: "NOT_FOUND",
  InvalidState: "INVALID_STATE",
  DeadlinePassed: "DEADLINE_PASSED",
  IdempotencyConflict: "IDEMPOTENCY_CONFLICT",
  DecisionLocked: "DECISION_LOCKED",
  DeliveryLocked: "DELIVERY_LOCKED",
  DuplicateSubmission: "DUPLICATE_SUBMISSION",
  PaymentNotReady: "PAYMENT_NOT_READY",
  PayloadTooLarge: "PAYLOAD_TOO_LARGE",
  TermsMismatch: "TERMS_MISMATCH",
  PaymentCapabilityUnavailable: "PAYMENT_CAPABILITY_UNAVAILABLE",
  RateLimited: "RATE_LIMITED",
  ProviderUnavailable: "PROVIDER_UNAVAILABLE",
  InternalError: "INTERNAL_ERROR",
  OperatorRequired: "OPERATOR_REQUIRED",
  AuthorizationPending: "AUTHORIZATION_PENDING",
  SlowDown: "SLOW_DOWN",
  AccessDenied: "ACCESS_DENIED",
  ExpiredToken: "EXPIRED_TOKEN",
} as const;
export type Code = (typeof Code)[keyof typeof Code] | (string & {});

export const codeSchema: EnumSchema<Code> = s.enumOf<Code>(Code);
