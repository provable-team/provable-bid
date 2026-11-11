import { fromMinor, toMinor } from '../money.js';
import { ProviderError, type AuthorizationView, type CaptureView, type Intent, type OrderView, type PaymentProvider, type PayoutView } from './types.js';

/** Real PayPal REST (sandbox by default). Raw fetch: Orders v2, Payments v2, Payouts v1, webhooks, identity. */
/**
 * testCardCheckout (sandbox only): pay with PayPal's test Visa instead of a PayPal login, so scripts can run the
 * whole money flow without a browser. The order is authorized/captured at creation; everything after uses the normal paths.
 */
export function paypalProvider(env: { clientId: string; clientSecret: string; webhookId: string | null; live?: boolean; testCardCheckout?: boolean }): PaymentProvider {
  if (env.live && env.testCardCheckout) throw new Error('testCardCheckout is sandbox-only');
  const base = env.live ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const connectBase = env.live ? 'https://www.paypal.com/connect' : 'https://www.sandbox.paypal.com/connect';
  const basic = Buffer.from(`${env.clientId}:${env.clientSecret}`).toString('base64');
  let token: { value: string; expires: number } | null = null;

  async function accessToken(): Promise<string> {
    if (token && Date.now() < token.expires) return token.value;
    const res = await fetch(`${base}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' })
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
    const d = data as { name?: string; message?: string; details?: { issue?: string; description?: string }[] };
    const issue = d.details?.[0]?.issue ?? d.name ?? `HTTP_${res.status}`;
    const message = `PayPal ${res.status} ${issue}${d.details?.[0]?.description ? `: ${d.details[0].description}` : d.message ? `: ${d.message}` : ''}`;
    throw new ProviderError(message, res.status >= 500 || res.status === 429 ? 'unknown' : 'definitive', issue, res.status);
  }

  const authView = (a: any): AuthorizationView => ({ id: a.id, status: a.status, createTime: a.create_time, expirationTime: a.expiration_time ?? null });
  const captureView = (c: any): CaptureView => ({
    id: c.id, status: c.status, amountMinor: toMinor(c.amount?.value ?? '0'),
    feeMinor: c.seller_receivable_breakdown?.paypal_fee?.value ? toMinor(c.seller_receivable_breakdown.paypal_fee.value) : null,
  });
  const orderView = (o: any): OrderView => {
    const unit = o.purchase_units?.[0] ?? {};
    const auth = unit.payments?.authorizations?.[0];
    const cap = unit.payments?.captures?.[0];
    return {
      id: o.id, status: o.status, intent: o.intent, amountMinor: toMinor(unit.amount?.value ?? '0'),
      referenceId: unit.reference_id ?? null, customId: unit.custom_id ?? null,
      payerCountry: o.payer?.address?.country_code ?? o.payment_source?.paypal?.address?.country_code ?? null,
      authorization: auth ? authView(auth) : null, capture: cap ? captureView(cap) : null,
    };
  };

  return {
    mode: 'paypal_sandbox',

    async createOrder(o) {
      const value = fromMinor(o.amountMinor);
      const order = await call<any>('POST', '/v2/checkout/orders', {
        intent: o.intent,
        purchase_units: [{
          reference_id: o.referenceId, custom_id: o.customId, description: o.description.slice(0, 127),
          amount: { currency_code: 'USD', value, breakdown: { item_total: { currency_code: 'USD', value } } },
          items: [{ name: o.description.slice(0, 127), sku: o.referenceId.slice(0, 127), quantity: '1', category: 'DIGITAL_GOODS', unit_amount: { currency_code: 'USD', value } }],
        }],
        payment_source: env.testCardCheckout
          ? { card: { number: '4032039317984658', expiry: '2030-12', security_code: '123', name: 'Sandbox Tester',
              billing_address: { address_line_1: '1 Main St', admin_area_2: 'San Jose', admin_area_1: 'CA', postal_code: '95131', country_code: 'US' } } }
          : { paypal: { experience_context: {
              brand_name: 'provable.bid', shipping_preference: 'NO_SHIPPING', user_action: o.intent === 'AUTHORIZE' ? 'CONTINUE' : 'PAY_NOW',
              return_url: o.returnUrl, cancel_url: o.cancelUrl,
            } } },
      }, o.requestId);
      if (env.testCardCheckout) return { orderId: order.id, approvalUrl: o.returnUrl };
      const approval = order.links?.find((l: any) => l.rel === 'payer-action' || l.rel === 'approve')?.href;
      if (!approval) throw new ProviderError('PayPal order has no approval link', 'definitive', 'NO_APPROVAL_LINK');
      return { orderId: order.id, approvalUrl: approval };
    },

    getOrder: async (orderId) => orderView(await call('GET', `/v2/checkout/orders/${encodeURIComponent(orderId)}`)),

    async authorizeOrder(orderId, requestId) {
      const o = orderView(await call('POST', `/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`, {}, requestId));
      if (!o.authorization) throw new ProviderError('Authorize returned no authorization', 'unknown');
      return o.authorization;
    },

    getAuthorization: async (id) => authView(await call('GET', `/v2/payments/authorizations/${encodeURIComponent(id)}`)),

    captureAuthorization: async (id, amountMinor, requestId) => captureView(await call('POST', `/v2/payments/authorizations/${encodeURIComponent(id)}/capture`,
      { amount: { currency_code: 'USD', value: fromMinor(amountMinor) }, final_capture: true }, requestId)),

    async captureOrder(orderId, requestId) {
      const existing = orderView(await call('GET', `/v2/checkout/orders/${encodeURIComponent(orderId)}`));
      if (existing.capture) return existing.capture; // already captured (e.g. test-card checkout, or a lost response)
      const o = orderView(await call('POST', `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {}, requestId));
      if (!o.capture) throw new ProviderError('Capture returned no capture', 'unknown');
      return o.capture;
    },

    getCapture: async (id) => captureView(await call('GET', `/v2/payments/captures/${encodeURIComponent(id)}`)),

    async voidAuthorization(id, requestId) {
      await call('POST', `/v2/payments/authorizations/${encodeURIComponent(id)}/void`, undefined, requestId);
      return authView(await call('GET', `/v2/payments/authorizations/${encodeURIComponent(id)}`));
    },

    async refundCapture(captureId, amountMinor, requestId) {
      const r = await call<any>('POST', `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, { amount: { currency_code: 'USD', value: fromMinor(amountMinor) } }, requestId);
      return { id: r.id, status: r.status };
    },

    async sendPayout(o) {
      const r = await call<any>('POST', '/v1/payments/payouts', {
        sender_batch_header: { sender_batch_id: o.batchId, email_subject: o.subject.slice(0, 255), email_message: o.note.slice(0, 1000) },
        items: [{ recipient_type: 'PAYPAL_ID', receiver: o.payerId, amount: { value: fromMinor(o.amountMinor), currency: 'USD' }, note: o.note.slice(0, 4000), sender_item_id: o.batchId }],
      });
      return { batchId: r.batch_header.payout_batch_id, status: r.batch_header.batch_status };
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
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }) });
      const tok = await res.json().catch(() => ({})) as { access_token?: string; error_description?: string; error?: string };
      if (!res.ok || !tok.access_token) throw new ProviderError(`PayPal login failed: ${tok.error_description ?? tok.error ?? res.status}`, 'definitive', 'LOGIN_FAILED', res.status);
      const infoRes = await fetch(`${base}/v1/identity/oauth2/userinfo?schema=paypalv1.1`, { headers: { Authorization: `Bearer ${tok.access_token}` } });
      const info = await infoRes.json().catch(() => ({})) as { payer_id?: string; name?: string; emails?: { value: string; primary?: boolean }[] };
      if (!infoRes.ok || !info.payer_id) throw new ProviderError('PayPal did not share the account ID. Enable "PayPal account ID" under Log in with PayPal.', 'definitive', 'NO_PAYER_ID', infoRes.status);
      const email = info.emails?.find((e) => e.primary)?.value ?? info.emails?.[0]?.value ?? null;
      return { payerId: info.payer_id, name: info.name || email || 'PayPal user', email };
    },
  };
}

export type { Intent };
