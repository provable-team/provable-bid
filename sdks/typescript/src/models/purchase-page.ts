import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { purchaseInternalSchema, purchaseSchema, type Purchase } from "./purchase.js";

export type PurchasePage = {
  items: Purchase[];
  nextCursor: string | null;
  serverTime: Date;
};

const purchasePageProperties: s.Shape<PurchasePage> = {
  items: s.array(s.lazy(() => purchaseInternalSchema)),
  nextCursor: s.nullable(s.string()),
  serverTime: s.dateTime(),
  _keysMap: {
    nextCursor: "next_cursor",
    serverTime: "server_time",
  },
};

export const purchasePageInternalSchema: Schema<PurchasePage> =
  s.object<PurchasePage>(purchasePageProperties);

export const purchasePageSchema: Schema<PurchasePage> = s.lazySchema(() =>
  s.object<PurchasePage>({
    ...purchasePageProperties,
    items: s.array(s.lazy(() => purchaseSchema)),
  }),
);
