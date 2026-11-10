import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createApiClient } from '../packages/api-client/src/index.js';
import { commandHeader, unwrap } from './mock-driver.js';

/** Actual HTTP assertions over a mock purchase, not a provider certification. */
export async function assertPaidOriginals(baseUrl: string, purchaseId: string) {
  const buyer = createApiClient({ baseUrl, token: 'buyer-demo' });
  const purchase = unwrap(await buyer.GET('/v1/purchases/{purchase_id}', { params: { path: { purchase_id: purchaseId } } }));
  assert.equal(purchase.status, 'payment_completed'); assert.equal(purchase.delivery_unlocked, true);
  const payment = unwrap(await buyer.GET('/v1/payments/{payment_id}', { params: { path: { payment_id: purchase.payment_id } } }));
  assert.equal(payment.capture_state, 'completed'); assert.equal(payment.captured_minor, 500);
  assert.ok(payment.provider_order_id && payment.provider_capture_id);
  const submission = unwrap(await buyer.GET('/v1/submissions/{submission_id}', { params: { path: { submission_id: purchase.submission_id } } }));
  const access = unwrap(await buyer.POST('/v1/purchases/{purchase_id}/delivery-access', {
    params: { path: { purchase_id: purchase.id }, header: commandHeader() },
  }));
  assert.deepEqual(access.artifacts.map(a => a.asset_id), submission.artifacts.map(a => a.asset_id));
  for (const artifact of access.artifacts) {
    const url = new URL(artifact.url);
    assert.equal(url.origin, new URL(baseUrl).origin, 'Mock original must use the configured API origin.');
    const denied = await fetch(url, { headers: { Authorization: 'Bearer buyer-other' } });
    assert.equal(denied.status, 404);
    const response = await fetch(url, { headers: { Authorization: 'Bearer buyer-demo' } });
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('content-type')?.split(';')[0], artifact.mime_type);
    const bytes = Buffer.from(await response.arrayBuffer());
    const expected = submission.artifacts.find(a => a.asset_id === artifact.asset_id)!;
    assert.equal(bytes.length, expected.size_bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, 'Downloaded original hash must match submitted bytes.');
  }
  return { purchase, payment, access, assertions: { payment_completed: true, captured_minor: payment.captured_minor, delivery_unlocked: true, ownership_enforced: true, original_hashes_verified: true } };
}
