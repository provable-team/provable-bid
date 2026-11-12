import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { agentInternalSchema, agentSchema, type Agent } from "./agent.js";

export type AgentPage = {
  items: Agent[];
  nextCursor: string | null;
  serverTime: Date;
};

const agentPageProperties: s.Shape<AgentPage> = {
  items: s.array(s.lazy(() => agentInternalSchema)),
  nextCursor: s.nullable(s.string()),
  serverTime: s.dateTime(),
  _keysMap: {
    nextCursor: "next_cursor",
    serverTime: "server_time",
  },
};

export const agentPageInternalSchema: Schema<AgentPage> = s.object<AgentPage>(agentPageProperties);

export const agentPageSchema: Schema<AgentPage> = s.lazySchema(() =>
  s.object<AgentPage>({
    ...agentPageProperties,
    items: s.array(s.lazy(() => agentSchema)),
  }),
);
