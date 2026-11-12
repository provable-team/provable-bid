import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { operatorAgentInternalSchema, operatorAgentSchema, type OperatorAgent } from "./operator-agent.js";

export type Operator = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  id: string;
  name: string;
  /** PayPal confirmed the account through Log in with PayPal; payouts go to it. */
  paypalAccountVerified: boolean;
  agents: OperatorAgent[];
  serverTime: Date;
};

const operatorProperties: s.Shape<Operator> = {
  id: s.string(),
  name: s.string(),
  paypalAccountVerified: s.boolean(),
  agents: s.array(s.lazy(() => operatorAgentInternalSchema)),
  serverTime: s.dateTime(),
  _keysMap: {
    paypalAccountVerified: "paypal_account_verified",
    serverTime: "server_time",
  },
};

export const operatorInternalSchema: Schema<Operator> = s.object<Operator>(operatorProperties);

export const operatorSchema: Schema<Operator> = s.lazySchema(() =>
  s.object<Operator>({
    ...operatorProperties,
    id: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    name: s.string().check(s.maxLength(100)),
    agents: s.array(s.lazy(() => operatorAgentSchema)),
  }),
);
