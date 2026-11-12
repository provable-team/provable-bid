import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paymentConfiguration, paypalApprovalUrl } from '../apps/api/src/provider/environment.js';

const credentials = { PAYPAL_CLIENT_ID: 'stub-client', PAYPAL_CLIENT_SECRET: 'stub-secret' };

test('deployment payment configuration keeps sandbox as the default and preserves local fake mode', () => {
  const local = paymentConfiguration({});
  assert.deepEqual([local.usePayPal, local.environment, local.options.live], [false, 'sandbox', false]);
  const paypal = paymentConfiguration(credentials);
  assert.deepEqual([paypal.usePayPal, paypal.environment, paypal.options.live], [true, 'sandbox', false]);
  assert.equal(paymentConfiguration({ ...credentials, PAYPAL_ENV: 'sandbox', PAYPAL_TEST_CARD_CHECKOUT: '1' }).options.testCardCheckout, true);
  assert.equal(paymentConfiguration({ ...credentials, PAYPAL_ENV: 'live' }).options.live, true);
});

test('live mode fails closed on test cards, missing credentials, or a fake-provider fallback', () => {
  assert.throws(() => paymentConfiguration({ ...credentials, PAYPAL_ENV: 'live', PAYPAL_TEST_CARD_CHECKOUT: '1' }), /sandbox-only/);
  assert.throws(() => paymentConfiguration({ PAYPAL_ENV: 'live' }), /requires.*provider/);
  assert.throws(() => paymentConfiguration({ ...credentials, PAYPAL_ENV: 'live', PAYMENTS: 'fake' }), /requires.*provider/);
  assert.throws(() => paymentConfiguration({ PAYPAL_ENV: 'live', PAYMENTS: 'paypal', PAYPAL_CLIENT_ID: 'stub-client' }), /requires.*CLIENT_SECRET/);
  assert.throws(() => paymentConfiguration({ ...credentials, PAYPAL_ENV: 'production' }), /sandbox or live/);
  assert.throws(() => paymentConfiguration({ ...credentials, PAYMENTS: 'paypa1' }), /paypal or fake/);
});

test('approval URLs must match the exact PayPal environment and cannot carry credentials, fragments, or alternate ports', () => {
  for (const host of ['www.sandbox.paypal.com', 'sandbox.paypal.com']) {
    const url = `https://${host}/checkoutnow?token=STUB`;
    assert.equal(paypalApprovalUrl(url), url);
    assert.throws(() => paypalApprovalUrl(url, true), /environment/);
  }
  for (const host of ['www.paypal.com', 'paypal.com']) {
    const url = `https://${host}/checkoutnow?token=STUB`;
    assert.equal(paypalApprovalUrl(url, true), url);
    assert.throws(() => paypalApprovalUrl(url), /environment/);
  }
  for (const url of ['http://www.paypal.com/checkoutnow', 'https://www.paypal.com.evil.test/checkoutnow',
    'https://www.paypal.com:444/checkoutnow', 'https://name:secret@www.paypal.com/checkoutnow',
    'https://www.paypal.com/checkoutnow#fragment', 'https://www.paypal.com./checkoutnow', 'not a URL'])
    assert.throws(() => paypalApprovalUrl(url, true), Error, url);
});
