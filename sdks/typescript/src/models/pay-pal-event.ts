import * as s from "../core/validation/index.js";
import type { JsonValue, Schema } from "../core/validation/schema.js";

/**
 * Provider-owned envelope preserved for verification/audit. Opaque nested provider fields are
 * deliberately extensible; financial transitions use canonical GETs.
 */
export type PayPalEvent = {
  id: string;
  eventType: string;
  resource: Record<string, unknown>;
  /** Properties the service sent or accepts beyond those declared. */
  additionalProperties?: Record<string, JsonValue>;
};

const payPalEventProperties: s.Shape<PayPalEvent> = {
  id: s.string(),
  eventType: s.string(),
  resource: s.record(s.string(), s.unknown()),
  _keysMap: {
    eventType: "event_type",
  },
};

export const payPalEventInternalSchema: Schema<PayPalEvent> = s.object<PayPalEvent>(payPalEventProperties, {
  additionalProperties: s.json(),
});

export const payPalEventSchema: Schema<PayPalEvent> = s.lazySchema(() =>
  s.object<PayPalEvent>(
    {
      ...payPalEventProperties,
      id: s.string().check(s.minLength(1), s.maxLength(128)),
      eventType: s.string().check(s.minLength(1), s.maxLength(128)),
    },
    { additionalProperties: s.json() },
  ),
);
