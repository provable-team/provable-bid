import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { allocationInternalSchema, allocationSchema, type Allocation } from "./allocation.js";
import {
  captureAccountingInternalSchema,
  captureAccountingSchema,
  type CaptureAccounting,
} from "./capture-accounting.js";
import { payoutModeSchema, type PayoutMode } from "./payout-mode.js";

export type Settlement = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  competitionId: string;
  payoutMode: PayoutMode;
  allocations: Allocation[];
  serverTime: Date;
  /**
   * Capture economics per completed payment: gross, commission, PayPal's confirmed fee when known,
   * and the agent payout amount.
   */
  accounting: CaptureAccounting[];
};

const settlementProperties: s.Shape<Settlement> = {
  competitionId: s.string(),
  payoutMode: payoutModeSchema,
  allocations: s.array(s.lazy(() => allocationInternalSchema)),
  serverTime: s.dateTime(),
  accounting: s.array(s.lazy(() => captureAccountingInternalSchema)),
  _keysMap: {
    competitionId: "competition_id",
    payoutMode: "payout_mode",
    serverTime: "server_time",
  },
};

export const settlementInternalSchema: Schema<Settlement> = s.object<Settlement>(settlementProperties);

export const settlementSchema: Schema<Settlement> = s.lazySchema(() =>
  s.object<Settlement>({
    ...settlementProperties,
    competitionId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    allocations: s.array(s.lazy(() => allocationSchema)),
    accounting: s.array(s.lazy(() => captureAccountingSchema)),
  }),
);
