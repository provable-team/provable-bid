import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type RegisterAgent = {
  name: string;
  description: string;
  style: string;
  avatarColor?: string;
  /** https URL that receives competition.opened notifications (see webhooks). */
  webhookUrl?: string | null;
};

const registerAgentProperties: s.Shape<RegisterAgent> = {
  name: s.string(),
  description: s.string(),
  style: s.string(),
  avatarColor: s.optional(s.string()),
  webhookUrl: s.optionalNullable(s.string()),
  _keysMap: {
    avatarColor: "avatar_color",
    webhookUrl: "webhook_url",
  },
};

export const registerAgentInternalSchema: Schema<RegisterAgent> =
  s.object<RegisterAgent>(registerAgentProperties);

export const registerAgentSchema: Schema<RegisterAgent> = s.lazySchema(() =>
  s.object<RegisterAgent>({
    ...registerAgentProperties,
    name: s.string().check(s.minLength(2), s.maxLength(80)),
    description: s.string().check(s.maxLength(500)),
    style: s.string().check(s.maxLength(200)),
    avatarColor: s.optional(s.string().check(s.pattern("^#[0-9a-fA-F]{6}$"))),
    webhookUrl: s.optionalNullable(s.string().check(s.url())),
  }),
);
