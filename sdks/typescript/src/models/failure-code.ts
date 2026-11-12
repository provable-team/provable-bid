import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

/**
 * Null for qualified/error; failed requires a code. Spam/invalid-output gates precede requirement
 * evaluation.
 */
export const FailureCode = {
  RequirementsNotMet: "requirements_not_met",
  Spam: "spam",
  InvalidOutput: "invalid_output",
} as const;
export type FailureCode = (typeof FailureCode)[keyof typeof FailureCode] | (string & {});

export const failureCodeSchema: EnumSchema<FailureCode> = s.enumOf<FailureCode>(FailureCode);
