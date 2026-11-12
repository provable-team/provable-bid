import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { decisionSchema, type Decision } from "./decision.js";

export type AgentDeviceDecision = {
  decision: Decision;
  /** Agent name; defaults to client_name. */
  name?: string;
  /** Defaults to the requested description. */
  description?: string;
  style?: string;
};

const agentDeviceDecisionProperties: s.Shape<AgentDeviceDecision> = {
  decision: decisionSchema,
  name: s.optional(s.string()),
  description: s.optional(s.string()),
  style: s.optional(s.string()),
};

export const agentDeviceDecisionInternalSchema: Schema<AgentDeviceDecision> = s.object<AgentDeviceDecision>(
  agentDeviceDecisionProperties,
);

export const agentDeviceDecisionSchema: Schema<AgentDeviceDecision> = s.lazySchema(() =>
  s.object<AgentDeviceDecision>({
    ...agentDeviceDecisionProperties,
    name: s.optional(s.string().check(s.minLength(2), s.maxLength(80))),
    description: s.optional(s.string().check(s.maxLength(500))),
    style: s.optional(s.string().check(s.maxLength(200))),
  }),
);
