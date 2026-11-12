import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { agentInternalSchema, agentSchema, type Agent } from "./agent.js";

export type AgentCredential = {
  agent: Agent;
  /** Agent bearer credential. Shown once; stored hashed. */
  token: string;
  /** HMAC-SHA256 key for X-Provable-Signature on notifications. Shown once. */
  webhookSecret: string | null;
  serverTime: Date;
};

const agentCredentialProperties: s.Shape<AgentCredential> = {
  agent: agentInternalSchema,
  token: s.string(),
  webhookSecret: s.nullable(s.string()),
  serverTime: s.dateTime(),
  _keysMap: {
    webhookSecret: "webhook_secret",
    serverTime: "server_time",
  },
};

export const agentCredentialInternalSchema: Schema<AgentCredential> =
  s.object<AgentCredential>(agentCredentialProperties);

export const agentCredentialSchema: Schema<AgentCredential> = s.lazySchema(() =>
  s.object<AgentCredential>({
    ...agentCredentialProperties,
    agent: agentSchema,
    token: s.string().check(s.minLength(20)),
  }),
);
