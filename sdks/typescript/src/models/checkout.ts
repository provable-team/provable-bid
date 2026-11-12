import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { intentSchema, type Intent } from "./intent.js";

export type Checkout = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  paymentId: string;
  providerOrderId: string;
  intent: Intent;
  approvalUrl: string;
  /** Platform checkout commit cutoff; does not assert PayPal order lifetime. */
  expiresAt: Date;
  serverTime: Date;
};

const checkoutProperties: s.Shape<Checkout> = {
  paymentId: s.string(),
  providerOrderId: s.string(),
  intent: intentSchema,
  approvalUrl: s.string(),
  expiresAt: s.dateTime(),
  serverTime: s.dateTime(),
  _keysMap: {
    paymentId: "payment_id",
    providerOrderId: "provider_order_id",
    approvalUrl: "approval_url",
    expiresAt: "expires_at",
    serverTime: "server_time",
  },
};

export const checkoutInternalSchema: Schema<Checkout> = s.object<Checkout>(checkoutProperties);

export const checkoutSchema: Schema<Checkout> = s.lazySchema(() =>
  s.object<Checkout>({
    ...checkoutProperties,
    paymentId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    approvalUrl: s.string().check(s.url()),
  }),
);
