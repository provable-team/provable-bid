import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { agentShareInternalSchema, agentShareSchema, type AgentShare } from "./agent-share.js";
import { ledgerStateSchema, type LedgerState } from "./ledger-state.js";
import { moneyInternalSchema, moneySchema, type Money } from "./money.js";
import { payoutStateSchema, type PayoutState } from "./payout-state.js";

export type Allocation = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  id: string;
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  competitionId: string;
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  paymentId: string;
  /** @default "winner" */
  kind?: "winner";
  amount: Money;
  ledgerState: LedgerState;
  /**
   * paid = PayPal Payouts item SUCCESS. pending includes UNCLAIMED and ONHOLD (money in flight).
   * blocked = held here by a refund/dispute/reversal on the buyer payment. Final PayPal outcomes
   * after sending: returned = RETURNED (unclaimed for 30 days, or cancelled; the money came back to
   * provable.bid), refunded = REFUNDED (the recipient sent it back), reversed = REVERSED. failed =
   * FAILED, BLOCKED or DENIED by PayPal, or never sent; payout_detail says which.
   */
  payoutState: PayoutState;
  providerPayoutId: string | null;
  createdAt: Date;
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  operatorId: string;
  /**
   * Private payout-recipient ID bound to the operator's PayPal account verified by Log in with
   * PayPal. Never a raw PayPal identifier.
   */
  recipientId: string;
  /** Per-agent attribution; exactly one winner share that sums to allocation.amount. */
  agentShares: AgentShare[];
  /**
   * Why the payout is not (or no longer) paid, in PayPal's words when PayPal gave one: e.g.
   * "BLOCKED: …", "RETURNED". Null when paid or in progress without remarks. May be absent on
   * allocations recorded before this field existed.
   */
  payoutDetail?: string | null;
};

const allocationProperties: s.Shape<Allocation> = {
  id: s.string(),
  competitionId: s.string(),
  paymentId: s.string(),
  kind: s.defaulted(s.literal("winner"), "winner"),
  amount: moneyInternalSchema,
  ledgerState: ledgerStateSchema,
  payoutState: payoutStateSchema,
  providerPayoutId: s.nullable(s.string()),
  createdAt: s.dateTime(),
  operatorId: s.string(),
  recipientId: s.string(),
  agentShares: s.array(s.lazy(() => agentShareInternalSchema)),
  payoutDetail: s.optionalNullable(s.string()),
  _keysMap: {
    competitionId: "competition_id",
    paymentId: "payment_id",
    ledgerState: "ledger_state",
    payoutState: "payout_state",
    providerPayoutId: "provider_payout_id",
    createdAt: "created_at",
    operatorId: "operator_id",
    recipientId: "recipient_id",
    agentShares: "agent_shares",
    payoutDetail: "payout_detail",
  },
};

export const allocationInternalSchema: Schema<Allocation> = s.object<Allocation>(allocationProperties);

export const allocationSchema: Schema<Allocation> = s.lazySchema(() =>
  s.object<Allocation>({
    ...allocationProperties,
    id: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    competitionId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    paymentId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    amount: moneySchema,
    operatorId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    recipientId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    agentShares: s.array(s.lazy(() => agentShareSchema)).check(s.minLength(1)),
    payoutDetail: s.optionalNullable(s.string().check(s.maxLength(300))),
  }),
);
