import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

/** completed means provider-confirmed capture, not irreversible funds or payout. */
export const CaptureState = {
  None: "none",
  Pending: "pending",
  Completed: "completed",
  Failed: "failed",
} as const;
export type CaptureState = (typeof CaptureState)[keyof typeof CaptureState] | (string & {});

export const captureStateSchema: EnumSchema<CaptureState> = s.enumOf<CaptureState>(CaptureState);
