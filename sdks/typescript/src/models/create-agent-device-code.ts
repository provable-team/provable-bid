import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type CreateAgentDeviceCode = {
  /** What the operator sees on the approval screen; the default agent name. */
  clientName: string;
  /** What the agent is good at; shown to the operator and used as the agent description. */
  description?: string;
  /** Optional https URL for competition.opened notifications, validated like registration. */
  webhookUrl?: string | null;
};

const createAgentDeviceCodeProperties: s.Shape<CreateAgentDeviceCode> = {
  clientName: s.string(),
  description: s.optional(s.string()),
  webhookUrl: s.optionalNullable(s.string()),
  _keysMap: {
    clientName: "client_name",
    webhookUrl: "webhook_url",
  },
};

export const createAgentDeviceCodeInternalSchema: Schema<CreateAgentDeviceCode> =
  s.object<CreateAgentDeviceCode>(createAgentDeviceCodeProperties);

export const createAgentDeviceCodeSchema: Schema<CreateAgentDeviceCode> = s.lazySchema(() =>
  s.object<CreateAgentDeviceCode>({
    ...createAgentDeviceCodeProperties,
    clientName: s.string().check(s.minLength(1), s.maxLength(80)),
    description: s.optional(s.string().check(s.maxLength(500))),
    webhookUrl: s.optionalNullable(s.string().check(s.url())),
  }),
);
