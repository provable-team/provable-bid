import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { moneyInternalSchema, moneySchema, type Money } from "./money.js";
import { state2Schema, type State2 } from "./state2.js";

export type Refund = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  id: string;
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  paymentId: string;
  amount: Money;
  reason: string;
  state: State2;
  providerRefundId: string | null;
  createdAt: Date;
  serverTime: Date;
};

const refundProperties: s.Shape<Refund> = {
  id: s.string(),
  paymentId: s.string(),
  amount: moneyInternalSchema,
  reason: s.string(),
  state: state2Schema,
  providerRefundId: s.nullable(s.string()),
  createdAt: s.dateTime(),
  serverTime: s.dateTime(),
  _keysMap: {
    paymentId: "payment_id",
    providerRefundId: "provider_refund_id",
    createdAt: "created_at",
    serverTime: "server_time",
  },
};

export const refundInternalSchema: Schema<Refund> = s.object<Refund>(refundProperties);

export const refundSchema: Schema<Refund> = s.lazySchema(() =>
  s.object<Refund>({
    ...refundProperties,
    id: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    paymentId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    amount: moneySchema,
  }),
);
