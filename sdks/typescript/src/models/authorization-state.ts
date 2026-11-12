import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

export const AuthorizationState = {
  NotApplicable: "not_applicable",
  None: "none",
  Pending: "pending",
  Authorized: "authorized",
  Captured: "captured",
  VoidPending: "void_pending",
  Voided: "voided",
  Expired: "expired",
  Failed: "failed",
} as const;
export type AuthorizationState = (typeof AuthorizationState)[keyof typeof AuthorizationState] | (string & {});

export const authorizationStateSchema: EnumSchema<AuthorizationState> =
  s.enumOf<AuthorizationState>(AuthorizationState);
