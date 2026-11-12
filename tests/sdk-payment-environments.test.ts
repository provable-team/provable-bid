import assert from 'node:assert/strict';
import test from 'node:test';
import { Mode, modeSchema } from '../sdks/typescript/src/models/mode.js';
import { PayoutMode, payoutModeSchema } from '../sdks/typescript/src/models/payout-mode.js';
import { Payouts, payoutsSchema } from '../sdks/typescript/src/models/payouts.js';

test('TypeScript SDK exposes and accepts both PayPal environments', () => {
  for (const [values, schema] of [[Mode, modeSchema], [PayoutMode, payoutModeSchema], [Payouts, payoutsSchema]] as const) {
    assert.equal(values.PaypalLive, 'paypal_live');
    assert.equal(values.PaypalSandbox, 'paypal_sandbox');
    assert.equal(schema.validate('paypal_live').success, true);
    assert.equal(schema.validate('paypal_sandbox').success, true);
  }
});
