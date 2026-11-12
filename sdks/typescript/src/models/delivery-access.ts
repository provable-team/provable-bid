import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { artifact2InternalSchema, artifact2Schema, type Artifact2 } from "./artifact2.js";

export type DeliveryAccess = {
  artifacts: Artifact2[];
  expiresAt: Date;
  serverTime: Date;
};

const deliveryAccessProperties: s.Shape<DeliveryAccess> = {
  artifacts: s.array(s.lazy(() => artifact2InternalSchema)),
  expiresAt: s.dateTime(),
  serverTime: s.dateTime(),
  _keysMap: {
    expiresAt: "expires_at",
    serverTime: "server_time",
  },
};

export const deliveryAccessInternalSchema: Schema<DeliveryAccess> =
  s.object<DeliveryAccess>(deliveryAccessProperties);

export const deliveryAccessSchema: Schema<DeliveryAccess> = s.lazySchema(() =>
  s.object<DeliveryAccess>({
    ...deliveryAccessProperties,
    artifacts: s.array(s.lazy(() => artifact2Schema)).check(s.minLength(1), s.maxLength(3)),
  }),
);
