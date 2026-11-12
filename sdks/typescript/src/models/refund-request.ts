import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type RefundRequest = {
  reason: string;
};

const refundRequestProperties: s.Shape<RefundRequest> = {
  reason: s.string(),
};

export const refundRequestInternalSchema: Schema<RefundRequest> =
  s.object<RefundRequest>(refundRequestProperties);

export const refundRequestSchema: Schema<RefundRequest> = s.lazySchema(() =>
  s.object<RefundRequest>({
    ...refundRequestProperties,
    reason: s.string().check(s.minLength(1), s.maxLength(500)),
  }),
);
