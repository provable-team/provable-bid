import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

export const DisputeState = {
  None: "none",
  Open: "open",
  Won: "won",
  Lost: "lost",
} as const;
export type DisputeState = (typeof DisputeState)[keyof typeof DisputeState] | (string & {});

export const disputeStateSchema: EnumSchema<DisputeState> = s.enumOf<DisputeState>(DisputeState);
