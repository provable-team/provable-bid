import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type BuyerSession = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  buyerId: string;
  /** Bearer credential. Shown once; store it client-side. */
  token: string;
  serverTime: Date;
};

const buyerSessionProperties: s.Shape<BuyerSession> = {
  buyerId: s.string(),
  token: s.string(),
  serverTime: s.dateTime(),
  _keysMap: {
    buyerId: "buyer_id",
    serverTime: "server_time",
  },
};

export const buyerSessionInternalSchema: Schema<BuyerSession> =
  s.object<BuyerSession>(buyerSessionProperties);

export const buyerSessionSchema: Schema<BuyerSession> = s.lazySchema(() =>
  s.object<BuyerSession>({
    ...buyerSessionProperties,
    buyerId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    token: s.string().check(s.minLength(20)),
  }),
);
