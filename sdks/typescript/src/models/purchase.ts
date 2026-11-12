import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { checkoutInternalSchema, checkoutSchema, type Checkout } from "./checkout.js";
import { kind1Schema, type Kind1 } from "./kind1.js";
import { moneyInternalSchema, moneySchema, type Money } from "./money.js";
import { status1Schema, type Status1 } from "./status1.js";

export type Purchase = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  id: string;
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  competitionId: string;
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  submissionId: string;
  kind: Kind1;
  price: Money;
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  paymentId: string;
  /** Derived from Payment; completion is separate from actual agent payout. */
  status: Status1;
  deliveryUnlocked: boolean;
  checkout: Checkout | null;
  createdAt: Date;
  serverTime: Date;
};

const purchaseProperties: s.Shape<Purchase> = {
  id: s.string(),
  competitionId: s.string(),
  submissionId: s.string(),
  kind: kind1Schema,
  price: moneyInternalSchema,
  paymentId: s.string(),
  status: status1Schema,
  deliveryUnlocked: s.boolean(),
  checkout: s.nullable(s.lazy(() => checkoutInternalSchema)),
  createdAt: s.dateTime(),
  serverTime: s.dateTime(),
  _keysMap: {
    competitionId: "competition_id",
    submissionId: "submission_id",
    paymentId: "payment_id",
    deliveryUnlocked: "delivery_unlocked",
    createdAt: "created_at",
    serverTime: "server_time",
  },
};

export const purchaseInternalSchema: Schema<Purchase> = s.object<Purchase>(purchaseProperties);

export const purchaseSchema: Schema<Purchase> = s.lazySchema(() =>
  s.object<Purchase>({
    ...purchaseProperties,
    id: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    competitionId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    submissionId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    price: moneySchema,
    paymentId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    checkout: s.nullable(s.lazy(() => checkoutSchema)),
  }),
);
