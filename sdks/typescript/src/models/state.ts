import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

export const State = {
  Draft: "draft",
  AwaitingAuthorization: "awaiting_authorization",
  Open: "open",
  Qualifying: "qualifying",
  Deciding: "deciding",
  Closed: "closed",
  Cancelled: "cancelled",
} as const;
export type State = (typeof State)[keyof typeof State] | (string & {});

export const stateSchema: EnumSchema<State> = s.enumOf<State>(State);
