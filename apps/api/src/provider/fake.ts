import { randomUUID } from 'node:crypto';
import { paypalCheckoutFee } from '../money.js';
import { ProviderError, type AuthorizationView, type CaptureView, type OrderView, type PaymentProvider } from './types.js';

type Call = { op: string; requestId: string | null; target: string; amountMinor?: number };

/**
 * In-memory stand-in for PayPal used by tests and local development (config mode "mock").
 * Honors PayPal-Request-Id the way PayPal does: the same request ID replays the first result.
 * `controls` lets tests approve orders, fail the next call, or leave a capture PENDING.
 */
export function fakeProvider(options: { webOrigin: string; autoApprove?: boolean; now?: () => number } = { webOrigin: 'http://127.0.0.1:3000' }) {
  const now = () => options.now?.() ?? Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const orders = new Map<string, OrderView & { approved: boolean; payerCountry: string | null }>();
  const auths = new Map<string, AuthorizationView & { orderId: string; amountMinor: number }>();
  const captures = new Map<string, CaptureView>();
  const payouts = new Map<string, { status: string; polls: number; amountMinor: number }>();
  const replay = new Map<string, unknown>();
  const calls: Call[] = [];
  const controls = {
    calls,
    failNext: null as null | { op: string; error: ProviderError },
    captureStatus: 'COMPLETED' as 'COMPLETED' | 'PENDING' | 'DECLINED',
    payerCountry: 'US' as string | null,
    approve(orderId: string) { const o = orders.get(orderId); if (o) { o.approved = true; o.status = 'APPROVED'; } },
    settleCapture(captureId: string, status = 'COMPLETED') { const c = captures.get(captureId); if (c) c.status = status; },
  };
  const id = (prefix: string) => `${prefix}${randomUUID().replace(/-/g, '').slice(0, 15).toUpperCase()}`;

  async function step<T>(op: string, requestId: string | null, target: string, fn: () => T, amountMinor?: number): Promise<T> {
    if (requestId && replay.has(`${op}:${requestId}`)) return structuredClone(replay.get(`${op}:${requestId}`)) as T;
    if (controls.failNext && controls.failNext.op === op) { const e = controls.failNext.error; controls.failNext = null; throw e; }
    calls.push({ op, requestId, target, ...(amountMinor !== undefined ? { amountMinor } : {}) });
    const result = fn();
    if (requestId) replay.set(`${op}:${requestId}`, structuredClone(result));
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
    getAuthorization: async (authId) => { const { orderId: _o, amountMinor: _m, ...a } = auth(authId); return structuredClone(a); },
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
      const c = captures.get(captureId);
      if (!c) throw new ProviderError('Capture not found', 'definitive', 'RESOURCE_NOT_FOUND', 404);
      if (c.status === 'COMPLETED' && c.feeMinor === null) c.feeMinor = paypalCheckoutFee(c.amountMinor);
      return structuredClone(c);
    },
    voidAuthorization: (authId, requestId) => step('voidAuthorization', requestId, authId, () => {
      const a = auth(authId);
      if (a.status === 'CAPTURED') throw new ProviderError('Already captured', 'definitive', 'PREVIOUSLY_CAPTURED', 422);
      a.status = 'VOIDED';
      const { orderId: _o, amountMinor: _m, ...v } = a; return structuredClone(v);
    }),
    refundCapture: (captureId, amountMinor, requestId) => step('refundCapture', requestId, captureId, () => {
      const c = captures.get(captureId);
      if (!c) throw new ProviderError('Capture not found', 'definitive', 'RESOURCE_NOT_FOUND', 404);
      c.status = 'REFUNDED';
      return { id: id('REF'), status: 'COMPLETED' };
    }, amountMinor),
    sendPayout: (o) => step('sendPayout', o.batchId, o.payerId, () => {
      const batchId = id('BATCH'); payouts.set(batchId, { status: 'PENDING', polls: 0, amountMinor: o.amountMinor });
      return { batchId, status: 'PENDING' };
    }, o.amountMinor),
    async getPayout(batchId) {
      const p = payouts.get(batchId);
      if (!p) throw new ProviderError('Payout not found', 'definitive', 'RESOURCE_NOT_FOUND', 404);
      if (++p.polls >= 1 && p.status === 'PENDING') p.status = 'SUCCESS';
      return { batchId, batchStatus: p.status, itemStatus: p.status, feeMinor: p.status === 'SUCCESS' ? 25 : null, error: null };
    },
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
