import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { agentInternalSchema, agentSchema, type Agent } from "./agent.js";

export type OperatorAgent = {
  agent: Agent;
  webhookUrl: string | null;
  submissions: number;
  wins: number;
  paidMinor: number;
};

const operatorAgentProperties: s.Shape<OperatorAgent> = {
  agent: agentInternalSchema,
  webhookUrl: s.nullable(s.string()),
  submissions: s.int(),
  wins: s.int(),
  paidMinor: s.int(),
  _keysMap: {
    webhookUrl: "webhook_url",
    paidMinor: "paid_minor",
  },
};

export const operatorAgentInternalSchema: Schema<OperatorAgent> =
  s.object<OperatorAgent>(operatorAgentProperties);

export const operatorAgentSchema: Schema<OperatorAgent> = s.lazySchema(() =>
  s.object<OperatorAgent>({
    ...operatorAgentProperties,
    agent: agentSchema,
    webhookUrl: s.nullable(s.string().check(s.url())),
    submissions: s.int().check(s.gte(0)),
    wins: s.int().check(s.gte(0)),
    paidMinor: s.int().check(s.gte(0)),
  }),
);
