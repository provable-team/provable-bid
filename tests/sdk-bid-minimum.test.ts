import assert from 'node:assert/strict';
import test from 'node:test';
import { bidMoneySchema } from '../sdks/typescript/src/models/bid-money.js';

test('TypeScript SDK accepts $5 bids and rejects bids below $5', () => {
  assert.equal(bidMoneySchema.validate({ amountMinor: 500 }).success, true);
  assert.equal(bidMoneySchema.validate({ amountMinor: 499 }).success, false);
});
