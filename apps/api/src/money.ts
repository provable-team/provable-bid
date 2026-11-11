import type { components } from '../../../packages/api-client/src/schema.js';

type Policy = components['schemas']['Policy'];

// Verified in the PayPal sandbox (2026-11-10): PayPal-account checkout 3.49% + $0.49 per capture,
// payouts $0.25 flat, refunds return no fee, a $0.50 capture nets $0.00.
export const POLICY: Policy = {
  terms_version: 'race-v1',
  commission_bps: 500,
  processing_fee_bps: 349,
  processing_fee_fixed_minor: 49,
  payout_fee_minor: 25,
  qualification_grace_seconds: 120,
};

const pct = (amount: number, bps: number) => Math.floor((amount * bps + 5_000) / 10_000); // half up

export const paypalCheckoutFee = (total: number, p: Policy = POLICY) => pct(total, p.processing_fee_bps) + p.processing_fee_fixed_minor;

/** Smallest fee such that price + fee, minus PayPal's fee on that total, still leaves the full price. */
export function processingFeeFor(price: number, p: Policy = POLICY): number {
  let fee = Math.ceil((pct(price, p.processing_fee_bps) + p.processing_fee_fixed_minor) / (1 - p.processing_fee_bps / 10_000));
  while (fee > 0 && price + fee - 1 - paypalCheckoutFee(price + fee - 1, p) >= price) fee--;
  while (price + fee - paypalCheckoutFee(price + fee, p) < price) fee++;
  return fee;
}

export const commissionFor = (price: number, p: Policy = POLICY) => pct(price, p.commission_bps);
export const agentPayoutFor = (price: number, p: Policy = POLICY) => price - commissionFor(price, p);
export const fromMinor = (minor: number) => `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
export const toMinor = (value: string) => {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!m) throw new Error(`Bad money value ${value}`);
  return Number(m[1]) * 100 + Number((m[2] ?? '0').padEnd(2, '0'));
};
