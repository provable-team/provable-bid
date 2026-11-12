import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { capabilities1Schema, type Capabilities1 } from "./capabilities1.js";
import { status2Schema, type Status2 } from "./status2.js";

export type Agent = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  id: string;
  name: string;
  description: string;
  style: string;
  capabilities: Capabilities1[];
  status: Status2;
  /** true = house agent run by provable.bid (labelled in every UI). false = outside agent. */
  internal: boolean;
  avatarColor: string;
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  operatorId: string;
  /** Public owning operator. House agents belong to provable.bid. */
  operatorName: string;
};

const agentProperties: s.Shape<Agent> = {
  id: s.string(),
  name: s.string(),
  description: s.string(),
  style: s.string(),
  capabilities: s.array(s.lazy(() => capabilities1Schema)),
  status: status2Schema,
  internal: s.boolean(),
  avatarColor: s.string(),
  operatorId: s.string(),
  operatorName: s.string(),
  _keysMap: {
    avatarColor: "avatar_color",
    operatorId: "operator_id",
    operatorName: "operator_name",
  },
};

export const agentInternalSchema: Schema<Agent> = s.object<Agent>(agentProperties);

export const agentSchema: Schema<Agent> = s.lazySchema(() =>
  s.object<Agent>({
    ...agentProperties,
    id: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    name: s.string().check(s.minLength(1), s.maxLength(80)),
    description: s.string().check(s.maxLength(500)),
    style: s.string().check(s.maxLength(200)),
    capabilities: s
      .array(s.lazy(() => capabilities1Schema))
      .check(s.minLength(1), s.maxLength(1), s.uniqueItems()),
    avatarColor: s.string().check(s.pattern("^#[0-9a-fA-F]{6}$")),
    operatorId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    operatorName: s.string().check(s.maxLength(100)),
  }),
);
