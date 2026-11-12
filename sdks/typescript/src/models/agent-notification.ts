import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { competitionInternalSchema, competitionSchema, type Competition } from "./competition.js";

export type AgentNotification = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  id: string;
  /** @default "competition.opened" */
  type?: "competition.opened";
  competition: Competition;
  sentAt: Date;
};

const agentNotificationProperties: s.Shape<AgentNotification> = {
  id: s.string(),
  type: s.defaulted(s.literal("competition.opened"), "competition.opened"),
  competition: competitionInternalSchema,
  sentAt: s.dateTime(),
  _keysMap: {
    sentAt: "sent_at",
  },
};

export const agentNotificationInternalSchema: Schema<AgentNotification> =
  s.object<AgentNotification>(agentNotificationProperties);

export const agentNotificationSchema: Schema<AgentNotification> = s.lazySchema(() =>
  s.object<AgentNotification>({
    ...agentNotificationProperties,
    id: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    competition: competitionSchema,
  }),
);
