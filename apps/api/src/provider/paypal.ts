import {
  ApiError, CheckoutPaymentIntent, Client, Environment, ItemCategory, OrdersController, PaymentsController,
  PaypalExperienceUserAction, PaypalWalletContextShippingPreference,
} from '@paypal/paypal-server-sdk';
import type { ApiResponse, AuthorizationWithAdditionalData, Configuration, Order, OrdersCapture, PaymentAuthorization, CapturedPayment } from '@paypal/paypal-server-sdk';
import { fromMinor, toMinor } from '../money.js';
import {
  ProviderError, type AuthorizationView, type CaptureView, type DisputeView, type Intent, type OrderView, type PaymentProvider, type PayoutView, type RefundView,
} from './types.js';

/**
 * Real PayPal (sandbox by default). Orders v2 and Payments v2 go through the APIMatic-generated PayPal Server SDK
 * (@paypal/paypal-server-sdk). Payouts v1, webhook signature verification and Log in with PayPal aren't in the SDK,
 * so they stay on REST.
 */
/**
 * testCardCheckout (sandbox only): pay with PayPal's test Visa instead of a PayPal login, so scripts can run the
 * whole money flow without a browser. The order is authorized/captured at creation; everything after uses the normal paths.
 */
export const TEST_CARDS = ['4032039317984658', '4111111111111111', '4012888888881881', '5555555555554444'];

/** The capture ID in a HATEOAS `up` link (refund and reversal resources point up to their capture). */
export function captureIdFromLinks(links: { href?: string; rel?: string }[] | undefined): string | null {
  for (const l of links ?? []) {
    const m = l.rel === 'up' ? /\/v2\/payments\/captures\/([^/?#]+)/.exec(l.href ?? '') : null;
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

/**
 * PayPal's rejection of a reused sender_batch_id. Documented (Payouts v1, sender_batch_id): "the API rejects the request
 * with an error message that shows the duplicate sender_batch_id and includes a HATEOAS link to the original payout".
 * The error name isn't documented, so match the wording and take the batch from the link.
 */
export function duplicateBatchOf(e: unknown): { batchId: string | null } | null {
  if (!(e instanceof ProviderError) || e.kind !== 'definitive' || (e.status !== 400 && e.status !== 422)) return null;
  const linked = e.links.map(l => /\/v1\/payments\/payouts\/([^/?#]+)$/.exec(l.href.split('?')[0])?.[1]).find(Boolean);
  if (!/sender_batch_id|duplicate|already (?:been )?(?:used|exists?)/i.test(`${e.issue ?? ''} ${e.message}`)) return null;
  return { batchId: linked ? decodeURIComponent(linked) : null };
}

const linksOf = (links: { href?: unknown; rel?: string }[] | undefined) =>
  (links ?? []).filter((l): l is { href: string; rel?: string } => typeof l?.href === 'string').map(l => ({ href: l.href, rel: l.rel }));

/**
 * Test seams. clientOptions is merged into the SDK Client configuration (a stub adapter through
 * `unstable_httpClientOptions`, retries off, a seeded `oAuthToken`); fetch replaces global fetch for the REST calls.
 */
export interface PayPalSeams { clientOptions?: Partial<Configuration>; fetch?: typeof fetch }

export function paypalProvider(env: { clientId: string; clientSecret: string; webhookId: string | null; live?: boolean; testCardCheckout?: boolean }, seams: PayPalSeams = {}): PaymentProvider {
  const fetch = seams.fetch ?? globalThis.fetch;
  if (env.live && env.testCardCheckout) throw new Error('testCardCheckout is sandbox-only');
  const base = env.live ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const connectBase = env.live ? 'https://www.paypal.com/connect' : 'https://www.sandbox.paypal.com/connect';
  const basic = Buffer.from(`${env.clientId}:${env.clientSecret}`).toString('base64');
  let token: { value: string; expires: number } | null = null;

  async function accessToken(): Promise<string> {
    if (token && Date.now() < token.expires) return token.value;
    const res = await fetch(`${base}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials', signal: AbortSignal.timeout(30_000) })
      .catch((e) => { throw new ProviderError(`PayPal OAuth unreachable: ${e.message}`, 'unknown'); });
    const body = await res.json().catch(() => ({})) as { access_token?: string; expires_in?: number };
    if (!res.ok || !body.access_token) throw new ProviderError(`PayPal OAuth failed (${res.status})`, res.status >= 500 ? 'unknown' : 'definitive', 'OAUTH', res.status);
    token = { value: body.access_token, expires: Date.now() + Math.max(60, (body.expires_in ?? 3000) - 120) * 1000 };
    return token.value;
  }

  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, requestId?: string): Promise<T> {
    const headers: Record<string, string> = { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
    if (requestId) headers['PayPal-Request-Id'] = requestId;
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
    } catch (e) {
      throw new ProviderError(`PayPal ${method} ${path} unreachable: ${(e as Error).message}`, 'unknown');
    }
    const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
    if (res.ok) return data as T;
    const d = data as { name?: string; message?: string; details?: { issue?: string; description?: string }[]; links?: { href?: unknown; rel?: string }[] };
    const issue = d.details?.[0]?.issue ?? d.name ?? `HTTP_${res.status}`;
    const message = `PayPal ${res.status} ${issue}${d.details?.[0]?.description ? `: ${d.details[0].description}` : d.message ? `: ${d.message}` : ''}`;
    // 401 is our token, never a decision about the payment (same rule as the SDK path).
    throw new ProviderError(message, res.status >= 500 || res.status === 429 || res.status === 401 ? 'unknown' : 'definitive', issue, res.status, linksOf(d.links));
  }

  // One long-lived SDK client. Its generated defaults are timeout 0 (no limit) and no retries; we set a timeout and
  // keep retries off, because the API retries money calls itself with the same PayPal-Request-Id.
  const client = new Client({
    environment: env.live ? Environment.Production : Environment.Sandbox,
    timeout: 30_000,
    ...seams.clientOptions,
    clientCredentialsAuthCredentials: {
      oAuthClientId: env.clientId, oAuthClientSecret: env.clientSecret, oAuthClockSkew: 120,
      // The SDK caches a failed token request and replays that rejection on every later call (Context Plugin,
      // typescript-authentication: "Your oAuthTokenProvider must never reject"). Return an already-expired token
      // instead: the SDK then refuses to send this one call ("OAuth token is expired", a plain Error mapped to
      // 'unknown' and retried with the same request ID), and since the cached token is expired the next call fetches afresh.
      oAuthTokenProvider: async (last, manager) => {
        try { return await manager.fetchToken(); }
        catch { return { ...(last ?? { accessToken: '', tokenType: 'Bearer' }), expiry: 0n }; }
      },
      ...seams.clientOptions?.clientCredentialsAuthCredentials,
    },
  });
  const orders = new OrdersController(client);
  const payments = new PaymentsController(client);
  const PREFER = 'return=representation';

  /** Runs an SDK call and maps failures to ProviderError, as `call` does: 5xx/429/network = unknown, other 4xx = definitive. */
  async function sdk<T>(label: string, run: (o: { abortSignal: AbortSignal }) => Promise<ApiResponse<T>>): Promise<T> {
    try {
      return (await run({ abortSignal: AbortSignal.timeout(45_000) })).result;
    } catch (e) {
      if (e instanceof ApiError) {
        // Typed errors carry the parsed payload on `result` (wire field names); a bare ApiError only has `body`.
        let d = e.result as { name?: string; message?: string; error?: string; error_description?: string; details?: { issue?: string; description?: string }[]; links?: { href?: unknown; rel?: string }[] } | undefined;
        if (!d && typeof e.body === 'string') try { d = JSON.parse(e.body); } catch { /* not JSON */ }
        const issue = d?.details?.[0]?.issue ?? d?.name ?? d?.error ?? `HTTP_${e.statusCode}`;
        const detail = d?.details?.[0]?.description ?? d?.message ?? d?.error_description;
        const message = `PayPal ${e.statusCode} ${issue}${detail ? `: ${detail}` : ''}`;
        // 401 means our credentials or token failed, never a decision about the payment, so it is retried.
        const unknown = e.statusCode >= 500 || e.statusCode === 429 || e.statusCode === 401;
        throw new ProviderError(message, unknown ? 'unknown' : 'definitive', issue, e.statusCode, linksOf(d?.links));
      }
      throw new ProviderError(`PayPal ${label} unreachable: ${(e as Error).message}`, 'unknown');
    }
  }

  const authView = (a: PaymentAuthorization | AuthorizationWithAdditionalData): AuthorizationView =>
    ({ id: a.id!, status: a.status ?? 'UNKNOWN', createTime: a.createTime ?? '', expirationTime: a.expirationTime ?? null });
  const captureView = (c: CapturedPayment | OrdersCapture): CaptureView => ({
    id: c.id!, status: c.status ?? 'UNKNOWN', amountMinor: toMinor(c.amount?.value ?? '0'),
    feeMinor: c.sellerReceivableBreakdown?.paypalFee?.value ? toMinor(c.sellerReceivableBreakdown.paypalFee.value) : null,
  });
  const orderView = (o: Order): OrderView => {
    const unit = o.purchaseUnits?.[0];
    const auth = unit?.payments?.authorizations?.[0];
    const cap = unit?.payments?.captures?.[0];
    return {
      id: o.id!, status: o.status ?? 'UNKNOWN', intent: o.intent as Intent, amountMinor: toMinor(unit?.amount?.value ?? '0'),
      referenceId: unit?.referenceId ?? null, customId: unit?.customId ?? null,
      payerCountry: o.payer?.address?.countryCode ?? o.paymentSource?.paypal?.address?.countryCode ?? null,
      authorization: auth ? authView(auth) : null, capture: cap ? captureView(cap) : null,
    };
  };
  const disputeView = (d: any): DisputeView => ({
    id: d.dispute_id, status: d.status ?? 'OTHER', outcome: d.dispute_outcome?.outcome_code ?? null,
    captureIds: (d.disputed_transactions ?? []).map((t: any) => t.seller_transaction_id).filter(Boolean),
  });
  const getOrder = async (id: string) => orderView(await sdk('get order', (r) => orders.getOrder({ id }, r)));
  const getAuthorization = async (authorizationId: string) =>
    authView(await sdk('get authorization', (r) => payments.getAuthorizedPayment({ authorizationId }, r)));

  return {
    mode: 'paypal_sandbox',

    async createOrder(o) {
      const value = fromMinor(o.amountMinor);
      const usd = { currencyCode: 'USD', value };
      // Sandbox test cards: PayPal sometimes starts declining one (PAYER_CANNOT_PAY), so scripted runs try the next.
      const cards = env.testCardCheckout ? TEST_CARDS : [''];
      let order!: Awaited<ReturnType<typeof orders.createOrder>>['result'];
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        try {
          order = await sdk('create order', (r) => orders.createOrder({ paypalRequestId: i ? `${o.requestId}-c${i}` : o.requestId, prefer: PREFER, body: {
        intent: o.intent === 'AUTHORIZE' ? CheckoutPaymentIntent.Authorize : CheckoutPaymentIntent.Capture,
        purchaseUnits: [{
          referenceId: o.referenceId, customId: o.customId, description: o.description.slice(0, 127),
          amount: { ...usd, breakdown: { itemTotal: usd } },
          items: [{ name: o.description.slice(0, 127), sku: o.referenceId.slice(0, 127), quantity: '1', category: ItemCategory.DigitalGoods, unitAmount: usd }],
        }],
        paymentSource: env.testCardCheckout
          ? { card: { number: card, expiry: '2030-12', securityCode: '123', name: 'Sandbox Tester',
              billingAddress: { addressLine1: '1 Main St', adminArea2: 'San Jose', adminArea1: 'CA', postalCode: '95131', countryCode: 'US' } } }
          : { paypal: { experienceContext: {
              brandName: 'provable.bid', shippingPreference: PaypalWalletContextShippingPreference.NoShipping,
              userAction: o.intent === 'AUTHORIZE' ? PaypalExperienceUserAction.Continue : PaypalExperienceUserAction.PayNow,
              returnUrl: o.returnUrl, cancelUrl: o.cancelUrl,
            } } },
      } }, r));
          break;
        } catch (e) {
          if (!(e instanceof ProviderError) || e.issue !== 'PAYER_CANNOT_PAY' || i === cards.length - 1) throw e;
        }
      }
      if (env.testCardCheckout) return { orderId: order.id!, approvalUrl: o.returnUrl };
      const approval = order.links?.find((l) => l.rel === 'payer-action' || l.rel === 'approve')?.href;
      if (!approval) throw new ProviderError('PayPal order has no approval link', 'definitive', 'NO_APPROVAL_LINK');
      return { orderId: order.id!, approvalUrl: approval };
    },

    getOrder,

    async authorizeOrder(id, requestId) {
      const o = await sdk('authorize order', (r) => orders.authorizeOrder({ id, paypalRequestId: requestId, prefer: PREFER, body: {} }, r));
      const auth = o.purchaseUnits?.[0]?.payments?.authorizations?.[0];
      if (!auth) throw new ProviderError('Authorize returned no authorization', 'unknown');
      return authView(auth);
    },

    getAuthorization,

    captureAuthorization: async (authorizationId, amountMinor, requestId) => captureView(await sdk('capture authorization', (r) =>
      payments.captureAuthorizedPayment({ authorizationId, paypalRequestId: requestId, prefer: PREFER,
        body: { amount: { currencyCode: 'USD', value: fromMinor(amountMinor) }, finalCapture: true } }, r))),

    async captureOrder(id, requestId) {
      const existing = await getOrder(id);
      if (existing.capture) return existing.capture; // already captured (e.g. test-card checkout, or a lost response)
      const o = orderView(await sdk('capture order', (r) => orders.captureOrder({ id, paypalRequestId: requestId, prefer: PREFER, body: {} }, r)));
      if (!o.capture) throw new ProviderError('Capture returned no capture', 'unknown');
      return o.capture;
    },

    getCapture: async (captureId) => captureView(await sdk('get capture', (r) => payments.getCapturedPayment({ captureId }, r))),

    async voidAuthorization(authorizationId, requestId) {
      await sdk('void authorization', (r) => payments.voidPayment({ authorizationId, paypalRequestId: requestId, prefer: PREFER }, r));
      return getAuthorization(authorizationId);
    },

    async refundCapture(captureId, amountMinor, requestId) {
      const refund = await sdk('refund capture', (r) => payments.refundCapturedPayment({ captureId, paypalRequestId: requestId, prefer: PREFER,
        body: { amount: { currencyCode: 'USD', value: fromMinor(amountMinor) } } }, r));
      return { id: refund.id!, status: refund.status ?? 'UNKNOWN' };
    },

    async getRefund(refundId): Promise<RefundView> {
      const r = await sdk('get refund', (q) => payments.getRefund({ refundId }, q));
      const total = r.sellerPayableBreakdown?.totalRefundedAmount?.value;
      return { id: r.id ?? refundId, status: r.status ?? 'UNKNOWN', amountMinor: toMinor(r.amount?.value ?? '0'),
        captureId: captureIdFromLinks(r.links), totalRefundedMinor: total ? toMinor(total) : null };
    },

    async sendPayout(o) {
      try {
        // PayPal-Request-Id (kept 30 days) makes a retried POST replay the original 201; sender_batch_id is the backstop.
        const r = await call<any>('POST', '/v1/payments/payouts', {
          sender_batch_header: { sender_batch_id: o.batchId, email_subject: o.subject.slice(0, 255), email_message: o.note.slice(0, 1000) },
          items: [{ recipient_type: 'PAYPAL_ID', receiver: o.payerId, amount: { value: fromMinor(o.amountMinor), currency: 'USD' }, note: o.note.slice(0, 4000), sender_item_id: o.batchId }],
        }, `payout-${o.batchId}`);
        return { batchId: r.batch_header.payout_batch_id, status: r.batch_header.batch_status };
      } catch (e) {
        // An earlier attempt created the batch but its response was lost: follow PayPal's link to it and keep tracking it.
        const dup = duplicateBatchOf(e);
        if (!dup) throw e;
        const status = (e as ProviderError).status;
        if (!dup.batchId) throw new ProviderError(`PayPal already has payout batch ${o.batchId} but did not link it. ${(e as Error).message}`, 'definitive', 'DUPLICATE_SENDER_BATCH_ID', status);
        const existing = await call<any>('GET', `/v1/payments/payouts/${encodeURIComponent(dup.batchId)}`);
        const sender = existing.batch_header?.sender_batch_header?.sender_batch_id;
        if (sender && sender !== o.batchId) throw new ProviderError(`PayPal linked batch ${dup.batchId}, which is ${sender}, not ${o.batchId}`, 'definitive', 'DUPLICATE_SENDER_BATCH_ID', status);
        return { batchId: dup.batchId, status: existing.batch_header?.batch_status ?? 'UNKNOWN', existing: true };
      }
    },

    async getPayout(batchId): Promise<PayoutView> {
      const r = await call<any>('GET', `/v1/payments/payouts/${encodeURIComponent(batchId)}`);
      const item = r.items?.[0];
      return {
        batchId, batchStatus: r.batch_header?.batch_status ?? 'UNKNOWN', itemStatus: item?.transaction_status ?? null,
        feeMinor: item?.payout_item_fee?.value ? toMinor(item.payout_item_fee.value) : null,
        error: item?.errors ? `${item.errors.name}: ${item.errors.message}` : null,
      };
    },

    // Disputes API (REST; not in the server SDK). The app's own client-credentials token reads it: no extra scope needed.
    getDispute: async (disputeId) => disputeView(await call<any>('GET', `/v1/customer/disputes/${encodeURIComponent(disputeId)}`)),

    async listDisputes(captureId) {
      const r = await call<{ items?: any[] }>('GET', `/v1/customer/disputes?disputed_transaction_id=${encodeURIComponent(captureId)}&page_size=50`);
      // The list returns summaries without outcomes, so read each resolved dispute in full.
      return Promise.all((r.items ?? []).map(async (d): Promise<DisputeView> => d.status === 'RESOLVED'
        ? disputeView(await call<any>('GET', `/v1/customer/disputes/${encodeURIComponent(d.dispute_id)}`))
        : { id: d.dispute_id, status: d.status ?? 'OTHER', outcome: null, captureIds: [captureId] }));
    },

    async verifyWebhook(headers, event) {
      if (!env.webhookId) return false;
      const r = await call<{ verification_status?: string }>('POST', '/v1/notifications/verify-webhook-signature', {
        auth_algo: headers['paypal-auth-algo'], cert_url: headers['paypal-cert-url'], transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'], transmission_time: headers['paypal-transmission-time'],
        webhook_id: env.webhookId, webhook_event: event,
      });
      return r.verification_status === 'SUCCESS';
    },

    identityAuthorizeUrl(redirectUri, state) {
      const q = new URLSearchParams({ flowEntry: 'static', client_id: env.clientId, response_type: 'code',
        scope: 'openid profile email https://uri.paypal.com/services/paypalattributes', redirect_uri: redirectUri, state, fullPage: 'true' });
      return `${connectBase}?${q.toString().replace(/\+/g, '%20')}`;
    },

    async identityFromCode(code, redirectUri) {
      const res = await fetch(`${base}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }), signal: AbortSignal.timeout(30_000) });
      const tok = await res.json().catch(() => ({})) as { access_token?: string; error_description?: string; error?: string };
      if (!res.ok || !tok.access_token) throw new ProviderError(`PayPal login failed: ${tok.error_description ?? tok.error ?? res.status}`, 'definitive', 'LOGIN_FAILED', res.status);
      const infoRes = await fetch(`${base}/v1/identity/oauth2/userinfo?schema=paypalv1.1`, { headers: { Authorization: `Bearer ${tok.access_token}` }, signal: AbortSignal.timeout(30_000) });
      const info = await infoRes.json().catch(() => ({})) as { payer_id?: string; name?: string; emails?: { value: string; primary?: boolean }[] };
      if (!infoRes.ok || !info.payer_id) throw new ProviderError('PayPal did not share the account ID. Enable "PayPal account ID" under Log in with PayPal.', 'definitive', 'NO_PAYER_ID', infoRes.status);
      const email = info.emails?.find((e) => e.primary)?.value ?? info.emails?.[0]?.value ?? null;
      return { payerId: info.payer_id, name: info.name || email || 'PayPal user', email };
    },
  };
}

export type { Intent };
