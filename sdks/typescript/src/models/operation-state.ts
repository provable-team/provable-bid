import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

export const OperationState = {
  Idle: "idle",
  Queued: "queued",
  Running: "running",
  Unknown: "unknown",
  Succeeded: "succeeded",
  Failed: "failed",
} as const;
export type OperationState = (typeof OperationState)[keyof typeof OperationState] | (string & {});

export const operationStateSchema: EnumSchema<OperationState> = s.enumOf<OperationState>(OperationState);
