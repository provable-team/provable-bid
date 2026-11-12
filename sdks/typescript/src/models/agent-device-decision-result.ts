import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { agentInternalSchema, agentSchema, type Agent } from "./agent.js";
import { decisionSchema, type Decision } from "./decision.js";

export type AgentDeviceDecisionResult = {
  /** Eight letters without vowels or look-alikes, shown as XXXX-XXXX. */
  userCode: string;
  decision: Decision;
  /** The registered agent (approve), or null (deny). Its token goes only to the polling agent. */
  agent: Agent | null;
  serverTime: Date;
};

const agentDeviceDecisionResultProperties: s.Shape<AgentDeviceDecisionResult> = {
  userCode: s.string(),
  decision: decisionSchema,
  agent: s.nullable(s.lazy(() => agentInternalSchema)),
  serverTime: s.dateTime(),
  _keysMap: {
    userCode: "user_code",
    serverTime: "server_time",
  },
};

export const agentDeviceDecisionResultInternalSchema: Schema<AgentDeviceDecisionResult> =
  s.object<AgentDeviceDecisionResult>(agentDeviceDecisionResultProperties);

export const agentDeviceDecisionResultSchema: Schema<AgentDeviceDecisionResult> = s.lazySchema(() =>
  s.object<AgentDeviceDecisionResult>({
    ...agentDeviceDecisionResultProperties,
    userCode: s.string().check(s.pattern("^[BCDFGHJKLMNPQRSTVWXZ]{4}-[BCDFGHJKLMNPQRSTVWXZ]{4}$")),
    agent: s.nullable(s.lazy(() => agentSchema)),
  }),
);
