import { describe, expect, it } from "vitest";
import {
  autoReleaseAt, blockedReason, checkBidPrice, escrowBalance, feeFor, MAX_BUDGET_CENTS, MIN_BID_CENTS, MIN_BUDGET_CENTS, PAYPAL_PAYOUT_FEE_CENTS,
  paypalCheckoutFeeFor, platformMargin, processingFeeFor, quoteFor, settlementFor, statusForPayout, statusForRefund, type JobSnapshot,
} from "@/lib/rules";

describe("settlementFor", () => {
  it("splits the escrow into buyer refund, agent payout and a 5% fee", () => {
    expect(settlementFor(300_00, 240_00)).toEqual({ refundToBuyerCents: 60_00, payoutToAgentCents: 228_00, feeCents: 12_00 });
  });

  it("always adds back up to the budget", () => {
    for (const [budget, price] of [[10_00, 10_00], [99_99, 33_33], [5_000_00, 4_999_99], [17_01, 17_01], [12_34, 10_09]]) {
      const s = settlementFor(budget, price);
      expect(s.refundToBuyerCents + s.payoutToAgentCents + s.feeCents).toBe(budget);
      expect(s.payoutToAgentCents).toBeGreaterThan(0);
    }
  });

  it("rounds the fee half up to the cent", () => {
    expect(feeFor(10)).toBe(1); // 0.5¢ → 1¢
    expect(feeFor(9)).toBe(0); // 0.45¢ → 0¢
    expect(feeFor(33_33)).toBe(1_67); // 166.65¢ → 167¢
  });

  it("refuses a price above the budget", () => {
    expect(() => settlementFor(100_00, 100_01)).toThrow();
  });
});

describe("checkBidPrice", () => {
  it("enforces the minimum and the budget", () => {
    expect(checkBidPrice(100_00, 9_99)).toMatch(/Minimum/);
    expect(checkBidPrice(100_00, 100_01)).toMatch(/budget/);
    expect(checkBidPrice(100_00, 12.5)).toMatch(/cents/);
    expect(checkBidPrice(100_00, 100_00)).toBeNull();
  });
});

describe("blockedReason", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  const job = (over: Partial<JobSnapshot>): JobSnapshot => ({
    status: "open", biddingClosesAt: new Date("2026-11-11T12:00:00Z"), deliveryDueAt: null, revisionsUsed: 0, ...over,
  });

  it("only takes bids while open and before the bidding deadline", () => {
    expect(blockedReason(job({}), "bid", now)).toBeNull();
    expect(blockedReason(job({ status: "awaiting_payment" }), "bid", now)).toMatch(/isn't taking bids/);
    expect(blockedReason(job({ biddingClosesAt: new Date("2026-11-10T11:59:59Z") }), "bid", now)).toMatch(/closed/);
  });

  it("lets the buyer award after bidding closes", () => {
    expect(blockedReason(job({ biddingClosesAt: new Date("2026-11-01") }), "award", now)).toBeNull();
  });

  it("allows one revision", () => {
    expect(blockedReason(job({ status: "delivered" }), "request_revision", now)).toBeNull();
    expect(blockedReason(job({ status: "delivered", revisionsUsed: 1 }), "request_revision", now)).toMatch(/already been used/);
  });

  it("only cancels an awarded job once the agent misses its deadline", () => {
    const due = new Date("2026-11-10T13:00:00Z");
    expect(blockedReason(job({ status: "awarded", deliveryDueAt: due }), "cancel", now)).toMatch(/delivery window/);
    expect(blockedReason(job({ status: "awarded", deliveryDueAt: due }), "cancel", new Date("2026-11-10T13:00:01Z"))).toBeNull();
    expect(blockedReason(job({ status: "delivered" }), "cancel", now)).toMatch(/can't be cancelled/);
    expect(blockedReason(job({ status: "completed" }), "cancel", now)).toMatch(/can't be cancelled/);
  });
});

describe("escrowBalance", () => {
  it("counts succeeded captures, and refunds/payouts unless they failed", () => {
    expect(
      escrowBalance([
        { kind: "escrow_capture", status: "succeeded", amountCents: 300_00 },
        { kind: "refund", status: "succeeded", amountCents: 60_00 },
        { kind: "payout", status: "pending", amountCents: 228_00 },
        { kind: "refund", status: "failed", amountCents: 999_00 },
      ]),
    ).toBe(12_00);
  });
});

describe("PayPal status mapping", () => {
  it("treats only COMPLETED refunds and SUCCESS payouts as done", () => {
    expect(statusForRefund("COMPLETED")).toBe("succeeded");
    expect(statusForRefund("PENDING")).toBe("in_flight");
    expect(statusForRefund("FAILED")).toBe("failed");
    expect(statusForPayout("SUCCESS", "SUCCESS")).toBe("succeeded");
    expect(statusForPayout(null, "PENDING")).toBe("in_flight");
    expect(statusForPayout("UNCLAIMED", "SUCCESS")).toBe("in_flight");
    expect(statusForPayout("RETURNED", "SUCCESS")).toBe("failed");
  });
});

describe("processing fee (PayPal checkout fee passed to the buyer)", () => {
  // Card 2.59% + $0.49 is cheaper than the PayPal-account rate the quote is built on.
  const cardFee = (total: number) => Math.floor((total * 259 + 5_000) / 10_000) + 49;

  it("matches the sandbox: PayPal kept $10.96 on a $300.00 PayPal-account capture", () => {
    expect(paypalCheckoutFeeFor(300_00)).toBe(10_96);
  });

  it("quotes $300 as $300.00 escrow + $11.36 processing", () => {
    expect(quoteFor(300_00)).toEqual({ budgetCents: 300_00, processingFeeCents: 11_36, totalCents: 311_36 });
  });

  it("always leaves at least the full budget after PayPal's fee, and is the smallest fee that does", () => {
    for (let budget = MIN_BUDGET_CENTS; budget <= MAX_BUDGET_CENTS; budget += 1_37) {
      const p = processingFeeFor(budget);
      expect(budget + p - paypalCheckoutFeeFor(budget + p)).toBeGreaterThanOrEqual(budget);
      expect(budget + p - cardFee(budget + p)).toBeGreaterThanOrEqual(budget);
      expect(budget + p - 1 - paypalCheckoutFeeFor(budget + p - 1)).toBeLessThan(budget);
    }
  });

  it("never loses money on a job, whatever the winning price or outcome", () => {
    for (let budget = MIN_BUDGET_CENTS; budget <= MAX_BUDGET_CENTS; budget += 9_73) {
      const processingFeeCents = processingFeeFor(budget);
      const captureFeeCents = paypalCheckoutFeeFor(budget + processingFeeCents);
      // cancelled (full refund, PayPal keeps its fee)
      expect(platformMargin({ processingFeeCents, captureFeeCents, priceCents: null, payoutFeeCents: 0 })).toBeGreaterThanOrEqual(0);
      for (const price of [MIN_BID_CENTS, Math.floor(budget / 3), budget].filter((p) => p >= MIN_BID_CENTS && p <= budget)) {
        expect(platformMargin({ processingFeeCents, captureFeeCents, priceCents: price, payoutFeeCents: PAYPAL_PAYOUT_FEE_CENTS })).toBeGreaterThan(0);
      }
    }
  });
});

describe("autoReleaseAt", () => {
  it("is 7 days after delivery, only while the delivery awaits the buyer", () => {
    const deliveredAt = new Date("2026-11-10T12:00:00Z");
    expect(autoReleaseAt({ status: "delivered", deliveredAt })).toEqual(new Date("2026-11-17T12:00:00Z"));
    expect(autoReleaseAt({ status: "awarded", deliveredAt })).toBeNull();
    expect(autoReleaseAt({ status: "completed", deliveredAt })).toBeNull();
  });
});
