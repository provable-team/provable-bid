import { randomUUID } from 'node:crypto';
import { paypalCheckoutFee } from '../money.js';
import { ProviderError, type AuthorizationView, type CaptureView, type DisputeView, type OrderView, type PaymentProvider, type RefundView } from './types.js';

type Call = { op: string; requestId: string | null; target: string; amountMinor?: number };

/**
 * In-memory stand-in for PayPal used by tests and local development (config mode "mock").
 * Honors PayPal-Request-Id the way PayPal does: the same request ID replays the first result.
 * `controls` lets tests approve orders, fail the next call, leave a capture PENDING, and play out what happens
 * on PayPal's side later (refunds and reversals outside the app, disputes, payout outcomes).
 */
export function fakeProvider(options: { webOrigin: string; autoApprove?: boolean; now?: () => number } = { webOrigin: 'http://127.0.0.1:3000' }) {
  const now = () => options.now?.() ?? Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const orders = new Map<string, OrderView & { approved: boolean; payerCountry: string | null }>();
  const auths = new Map<string, AuthorizationView & { orderId: string; amountMinor: number }>();
  const captures = new Map<string, CaptureView>();
  const refunds = new Map<string, RefundView>();
  const disputes = new Map<string, DisputeView>();
  const payouts = new Map<string, { status: string; polls: number; amountMinor: number; senderBatchId: string; fixed: boolean; error: string | null }>();
  const replay = new Map<string, unknown>();
  const calls: Call[] = [];
  const id = (prefix: string) => `${prefix}${randomUUID().replace(/-/g, '').slice(0, 15).toUpperCase()}`;
  /** A refund (or a reversal, which PayPal also reports as a refund resource) against a capture. */
  function refundOf(captureId: string, amountMinor: number, status = 'COMPLETED'): RefundView {
    const c = captures.get(captureId);
    if (!c) throw new ProviderError('Capture not found', 'definitive', 'RESOURCE_NOT_FOUND', 404);
    const before = [...refunds.values()].filter(r => r.captureId === captureId && r.status === 'COMPLETED').reduce((s, r) => s + r.amountMinor, 0);
    const total = before + (status === 'COMPLETED' ? amountMinor : 0);
    const r: RefundView = { id: id('REF'), status, amountMinor, captureId, totalRefundedMinor: total };
    refunds.set(r.id, r);
    if (status === 'COMPLETED') c.status = total >= c.amountMinor ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    return r;
  }
  const controls = {
    calls,
    failNext: null as null | { op: string; error: ProviderError },
    captureStatus: 'COMPLETED' as 'COMPLETED' | 'PENDING' | 'DECLINED',
    payerCountry: 'US' as string | null,
    approve(orderId: string) { const o = orders.get(orderId); if (o) { o.approved = true; o.status = 'APPROVED'; } },
    settleCapture(captureId: string, status = 'COMPLETED') { const c = captures.get(captureId); if (c) c.status = status; },
    /** A refund made outside the app (PayPal dashboard). Returns the refund ID a PAYMENT.CAPTURE.REFUNDED event would carry. */
    refundOutside(captureId: string, amountMinor: number) { return refundOf(captureId, amountMinor).id; },
    /** A chargeback/reversal: the capture becomes REVERSED; returns the refund-resource ID of the PAYMENT.CAPTURE.REVERSED event. */
    reverseCapture(captureId: string) {
      const c = captures.get(captureId)!; const r = refundOf(captureId, c.amountMinor); c.status = 'REVERSED'; return r.id;
    },
    openDispute(captureId: string) { const d: DisputeView = { id: id('PP-D-'), status: 'OPEN', outcome: null, captureIds: [captureId] }; disputes.set(d.id, d); return d.id; },
    resolveDispute(disputeId: string, outcome: string) { const d = disputes.get(disputeId)!; d.status = 'RESOLVED'; d.outcome = outcome; },
    setAuthorizationStatus(authId: string, status: string) { const a = auths.get(authId); if (a) a.status = status; },
    /** Fix a payout's status at PayPal (RETURNED, BLOCKED, REFUNDED, REVERSED, …). */
    setPayoutStatus(batchId: string, status: string, error: string | null = null) { const p = payouts.get(batchId); if (p) { p.status = status; p.fixed = true; p.error = error; } },
    payouts,
    /** PayPal does the next call of this op, then the response is lost (timeout); a retry with the same request ID replays it. */
    loseNextResponse: null as null | string,
  };

  /** failNext for read calls (getCapture, getRefund, getDispute, listDisputes, getAuthorization, getPayout). */
  function readable(op: string) {
    if (controls.failNext && controls.failNext.op === op) { const e = controls.failNext.error; controls.failNext = null; throw e; }
  }
  async function step<T>(op: string, requestId: string | null, target: string, fn: () => T, amountMinor?: number): Promise<T> {
    if (requestId && replay.has(`${op}:${requestId}`)) return structuredClone(replay.get(`${op}:${requestId}`)) as T;
    if (controls.failNext && controls.failNext.op === op) { const e = controls.failNext.error; controls.failNext = null; throw e; }
    calls.push({ op, requestId, target, ...(amountMinor !== undefined ? { amountMinor } : {}) });
    const result = fn();
    if (requestId) replay.set(`${op}:${requestId}`, structuredClone(result));
    if (controls.loseNextResponse === op) { controls.loseNextResponse = null; throw new ProviderError(`PayPal ${op} unreachable: timeout`, 'unknown'); }
    return result;
  }
  const order = (orderId: string) => {
    const o = orders.get(orderId);
    if (!o) throw new ProviderError('Order not found', 'definitive', 'RESOURCE_NOT_FOUND', 404);
    return o;
  };
  const auth = (authId: string) => {
    const a = auths.get(authId);
    if (!a) throw new ProviderError('Authorization not found', 'definitive', 'RESOURCE_NOT_FOUND', 404);
    return a;
  };
  const view = (o: OrderView & { approved: boolean }) => { const { approved: _a, ...rest } = o; return structuredClone(rest); };
  const capture = (amountMinor: number): CaptureView => {
    const c: CaptureView = { id: id('CAP'), status: controls.captureStatus, amountMinor, feeMinor: controls.captureStatus === 'COMPLETED' ? paypalCheckoutFee(amountMinor) : null };
    captures.set(c.id, c);
    return c;
  };

  const provider: PaymentProvider = {
    mode: 'mock',
    createOrder: (o) => step('createOrder', o.requestId, o.referenceId, () => {
      const orderId = id('ORDER');
      orders.set(orderId, { id: orderId, status: options.autoApprove ? 'APPROVED' : 'CREATED', approved: !!options.autoApprove, intent: o.intent, amountMinor: o.amountMinor,
        referenceId: o.referenceId, customId: o.customId, payerCountry: controls.payerCountry, authorization: null, capture: null });
      return { orderId, approvalUrl: `${options.webOrigin}/checkout/fake?order_id=${orderId}&return_url=${encodeURIComponent(o.returnUrl)}` };
    }, o.amountMinor),
    getOrder: async (orderId) => view(order(orderId)),
    authorizeOrder: (orderId, requestId) => step('authorizeOrder', requestId, orderId, () => {
      const o = order(orderId);
      if (o.authorization) throw new ProviderError('Order already authorized', 'definitive', 'ORDER_ALREADY_AUTHORIZED', 422);
      if (!o.approved) throw new ProviderError('Payer has not approved the order', 'definitive', 'ORDER_NOT_APPROVED', 422);
      const a = { id: id('AUTH'), status: 'CREATED', createTime: iso(now()), expirationTime: iso(now() + 29 * 86_400_000), orderId, amountMinor: o.amountMinor };
      auths.set(a.id, a); o.authorization = { id: a.id, status: a.status, createTime: a.createTime, expirationTime: a.expirationTime }; o.status = 'COMPLETED';
      return structuredClone(o.authorization);
    }),
    getAuthorization: async (authId) => { readable('getAuthorization'); const { orderId: _o, amountMinor: _m, ...a } = auth(authId); return structuredClone(a); },
    captureAuthorization: (authId, amountMinor, requestId) => step('captureAuthorization', requestId, authId, () => {
      const a = auth(authId);
      if (a.status === 'CAPTURED') throw new ProviderError('Already captured', 'definitive', 'AUTHORIZATION_ALREADY_CAPTURED', 422);
      if (a.status === 'VOIDED') throw new ProviderError('Authorization voided', 'definitive', 'AUTHORIZATION_VOIDED', 422);
      if (amountMinor > a.amountMinor) throw new ProviderError('Capture exceeds authorization', 'definitive', 'MAX_CAPTURE_AMOUNT_EXCEEDED', 422);
      const c = capture(amountMinor);
      if (c.status !== 'DECLINED') a.status = 'CAPTURED';
      return structuredClone(c);
    }, amountMinor),
    captureOrder: (orderId, requestId) => step('captureOrder', requestId, orderId, () => {
      const o = order(orderId);
      if (!o.approved) throw new ProviderError('Payer has not approved the order', 'definitive', 'ORDER_NOT_APPROVED', 422);
      if (o.capture) throw new ProviderError('Order already captured', 'definitive', 'ORDER_ALREADY_CAPTURED', 422);
      const c = capture(o.amountMinor); o.capture = c; o.status = 'COMPLETED';
      return structuredClone(c);
    }),
    getCapture: async (captureId) => {
      readable('getCapture');
      const c = captures.get(captureId);
      if (!c) throw new ProviderError('Capture not found', 'definitive', 'RESOURCE_NOT_FOUND', 404);
      if (c.status === 'COMPLETED' && c.feeMinor === null) c.feeMinor = paypalCheckoutFee(c.amountMinor);
      return structuredClone(c);
    },
    voidAuthorization: (authId, requestId) => step('voidAuthorization', requestId, authId, () => {
      const a = auth(authId);
      if (a.status === 'CAPTURED') throw new ProviderError('Already captured', 'definitive', 'PREVIOUSLY_CAPTURED', 422);
      if (a.status === 'EXPIRED') throw new ProviderError('Authorization expired', 'definitive', 'AUTHORIZATION_EXPIRED', 422);
      if (a.status === 'VOIDED') throw new ProviderError('Authorization already voided', 'definitive', 'PREVIOUSLY_VOIDED', 422);
      a.status = 'VOIDED';
      const { orderId: _o, amountMinor: _m, ...v } = a; return structuredClone(v);
    }),
    refundCapture: (captureId, amountMinor, requestId) => step('refundCapture', requestId, captureId, () => {
      const r = refundOf(captureId, amountMinor);
      return { id: r.id, status: r.status };
    }, amountMinor),
    async getRefund(refundId) {
      readable('getRefund');
      const r = refunds.get(refundId);
      if (!r) throw new ProviderError('Refund not found', 'definitive', 'RESOURCE_NOT_FOUND', 404);
      return structuredClone(r);
    },
    // Like PayPal: a reused sender_batch_id is never paid twice; the provider follows the rejection's link to the original batch.
    sendPayout: async (o) => {
      const original = [...payouts.entries()].find(([, p]) => p.senderBatchId === o.batchId);
      if (original) return { batchId: original[0], status: original[1].status, existing: true };
      return step('sendPayout', o.batchId, o.payerId, () => {
        const batchId = id('BATCH'); payouts.set(batchId, { status: 'PENDING', polls: 0, amountMinor: o.amountMinor, senderBatchId: o.batchId, fixed: false, error: null });
        return { batchId, status: 'PENDING' };
      }, o.amountMinor);
    },
    async getPayout(batchId) {
      readable('getPayout');
      const p = payouts.get(batchId);
      if (!p) throw new ProviderError('Payout not found', 'definitive', 'RESOURCE_NOT_FOUND', 404);
      if (++p.polls >= 1 && p.status === 'PENDING' && !p.fixed) p.status = 'SUCCESS';
      return { batchId, batchStatus: ['PENDING', 'PROCESSING'].includes(p.status) ? p.status : 'SUCCESS', itemStatus: p.status, feeMinor: p.status === 'SUCCESS' ? 25 : null, error: p.error };
    },
    async getDispute(disputeId) {
      readable('getDispute');
      const d = disputes.get(disputeId);
      if (!d) throw new ProviderError('Dispute not found', 'definitive', 'RESOURCE_NOT_FOUND', 404);
      return structuredClone(d);
    },
    listDisputes: async (captureId) => { readable('listDisputes'); return [...disputes.values()].filter(d => d.captureIds.includes(captureId)).map(d => structuredClone(d)); },
    verifyWebhook: async (headers) => headers['paypal-transmission-sig'] === 'FAKE_VERIFIED',
    identityAuthorizeUrl: (redirectUri, state) => `${options.webOrigin}/operators/fake-login?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`,
    async identityFromCode(code) {
      const m = /^fake:([A-Z0-9]{8,20}):(.+)$/.exec(code);
      if (!m) throw new ProviderError('Bad login code', 'definitive', 'LOGIN_FAILED', 400);
      return { payerId: m[1], name: m[2], email: null };
    },
  };
  return { provider, controls, orders, auths, captures };
}
