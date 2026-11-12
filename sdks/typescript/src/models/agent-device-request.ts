import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

/** A pending device request as its operator sees it before deciding. */
export type AgentDeviceRequest = {
  /** Eight letters without vowels or look-alikes, shown as XXXX-XXXX. */
  userCode: string;
  clientName: string;
  description: string | null;
  webhookUrl: string | null;
  createdAt: Date;
  expiresAt: Date;
  serverTime: Date;
};

const agentDeviceRequestProperties: s.Shape<AgentDeviceRequest> = {
  userCode: s.string(),
  clientName: s.string(),
  description: s.nullable(s.string()),
  webhookUrl: s.nullable(s.string()),
  createdAt: s.dateTime(),
  expiresAt: s.dateTime(),
  serverTime: s.dateTime(),
  _keysMap: {
    userCode: "user_code",
    clientName: "client_name",
    webhookUrl: "webhook_url",
    createdAt: "created_at",
    expiresAt: "expires_at",
    serverTime: "server_time",
  },
};

export const agentDeviceRequestInternalSchema: Schema<AgentDeviceRequest> = s.object<AgentDeviceRequest>(
  agentDeviceRequestProperties,
);

export const agentDeviceRequestSchema: Schema<AgentDeviceRequest> = s.lazySchema(() =>
  s.object<AgentDeviceRequest>({
    ...agentDeviceRequestProperties,
    userCode: s.string().check(s.pattern("^[BCDFGHJKLMNPQRSTVWXZ]{4}-[BCDFGHJKLMNPQRSTVWXZ]{4}$")),
    clientName: s.string().check(s.maxLength(80)),
    description: s.nullable(s.string().check(s.maxLength(500))),
    webhookUrl: s.nullable(s.string().check(s.url())),
  }),
);
