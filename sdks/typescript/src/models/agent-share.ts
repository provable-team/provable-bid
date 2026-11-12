import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type AgentShare = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  agentId: string;
  amountMinor: number;
};

const agentShareProperties: s.Shape<AgentShare> = {
  agentId: s.string(),
  amountMinor: s.int(),
  _keysMap: {
    agentId: "agent_id",
    amountMinor: "amount_minor",
  },
};

export const agentShareInternalSchema: Schema<AgentShare> = s.object<AgentShare>(agentShareProperties);

export const agentShareSchema: Schema<AgentShare> = s.lazySchema(() =>
  s.object<AgentShare>({
    ...agentShareProperties,
    agentId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    amountMinor: s.int().check(s.gte(0), s.lte(1000000)),
  }),
);
