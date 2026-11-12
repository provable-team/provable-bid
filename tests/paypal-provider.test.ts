// paypalProvider against stubbed PayPal responses, no network. SDK calls go through a stub axios adapter passed via
// `unstable_httpClientOptions` (PayPal Server SDK Context Plugin, typescript-testing), with retries off and, unless the
// token exchange is under test, a seeded unexpired token. REST calls (Payouts, Disputes) go through a stub fetch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, Client, CustomError, Environment, PaymentsController } from '@paypal/paypal-server-sdk';
import type { Configuration } from '@paypal/paypal-server-sdk';
import { captureIdFromLinks, paypalProvider, TEST_CARDS } from '../apps/api/src/provider/paypal.js';
import { ProviderError } from '../apps/api/src/provider/types.js';

type Reply = { status: number; body?: unknown };
type Seen = { method: string; url: string; headers: Record<string, string>; data: any };
const SANDBOX = 'https://api-m.sandbox.paypal.com';
const env = { clientId: 'stub-client', clientSecret: 'stub-secret', webhookId: null };

/** SDK client options with a stub adapter. reply() sees every request, including the token request if one is made. */
function sdkStub(reply: (req: Seen) => Reply, opts: { seedToken?: boolean } = {}) {
  const seen: Seen[] = [];
  const clientOptions: Partial<Configuration> = {
    unstable_httpClientOptions: {
      adapter: async (config: any) => {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(config.headers ?? {})) headers[k.toLowerCase()] = String(v);
        const req: Seen = { method: String(config.method).toUpperCase(), url: String(config.url), headers, data: typeof config.data === 'string' && config.data.startsWith('{') ? JSON.parse(config.data) : config.data };
        seen.push(req);
        const r = reply(req);
        // The SDK turns off axios response transforms: hand back the raw serialized body, as the wire would.
        return { data: r.body === undefined ? '' : JSON.stringify(r.body), status: r.status, statusText: '', headers: { 'content-type': 'application/json' }, config };
      },
    },
    httpClientOptions: { retryConfig: { maxNumberOfRetries: 0 } as any }, // a stubbed 5xx fails on the first attempt
    ...(opts.seedToken === false ? {} : { clientCredentialsAuthCredentials: {
      oAuthClientId: env.clientId, oAuthClientSecret: env.clientSecret,
      oAuthToken: { accessToken: 'seeded-token', tokenType: 'Bearer', expiry: BigInt(Math.floor(Date.now() / 1000) + 3600) },
    } }),
  };
  return { clientOptions, seen };
}
/** A stub fetch for the REST calls (token, Payouts, Disputes). */
function fetchStub(reply: (method: string, url: string, headers: Record<string, string>, body: any) => Reply) {
  const seen: Seen[] = [];
  const fetch: typeof globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    const headers = Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]));
    const body = typeof init.body === 'string' && init.body.startsWith('{') ? JSON.parse(init.body) : init.body;
    const method = init.method ?? 'GET';
    seen.push({ method, url, headers, data: body });
    const r = url.endsWith('/v1/oauth2/token') ? { status: 200, body: { access_token: 'rest-token', expires_in: 3600 } } : reply(method, url, headers, body);
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, seen };
}
const order = (id: string, status = 'APPROVED') => ({ id, status, intent: 'AUTHORIZE', purchase_units: [{ reference_id: 'cmp_1', custom_id: 'pay_1', amount: { currency_code: 'USD', value: '21.23' } }] });
const rejects = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e; } assert.fail('expected a rejection'); };

test('SDK errors: the stubbed statuses raise a typed CustomError (422, 401) or a bare ApiError (500)', async () => {
  // Pins the SDK behaviour the provider's mapping relies on (typed errors carry `result`; a bare ApiError only `body`).
  const replies: Record<string, Reply> = {
    void: { status: 422, body: { name: 'UNPROCESSABLE_ENTITY', message: 'x', debug_id: 'd', details: [{ issue: 'PREVIOUSLY_CAPTURED' }] } },
    refund: { status: 500, body: { name: 'INTERNAL_SERVER_ERROR', message: 'An internal server error occurred.', debug_id: 'd' } },
    auth: { status: 401, body: { name: 'AUTHENTICATION_FAILURE', message: 'Authentication failed', debug_id: 'd' } },
  };
  const { clientOptions } = sdkStub(req => req.url.includes('/void') ? replies.void : req.url.includes('/refunds/') ? replies.refund : replies.auth);
  const payments = new PaymentsController(new Client({ environment: Environment.Sandbox, timeout: 0, ...clientOptions }));
  const typed = await rejects(payments.voidPayment({ authorizationId: 'AUTH1' }));
  assert.equal((typed as object).constructor, CustomError); assert.equal((typed as ApiError).statusCode, 422);
  const bare = await rejects(payments.getRefund({ refundId: 'REF1' }));
  assert.equal((bare as object).constructor, ApiError); assert.equal((bare as ApiError).result, undefined); assert.match(String((bare as ApiError).body), /INTERNAL_SERVER_ERROR/);
  const unauth = await rejects(payments.getAuthorizedPayment({ authorizationId: 'AUTH1' }));
  assert.equal((unauth as object).constructor, CustomError); assert.equal((unauth as ApiError).statusCode, 401);
});

test('error mapping: 422 typed error is definitive with its issue; bare 500 parses the body and is unknown; 401 is unknown', async () => {
  const { clientOptions, seen } = sdkStub(req => {
    if (req.url.endsWith('/void')) return { status: 422, body: { name: 'UNPROCESSABLE_ENTITY', message: 'The requested action could not be performed.', debug_id: 'd',
      details: [{ issue: 'PREVIOUSLY_CAPTURED', description: 'Authorization has been previously captured and hence cannot be voided.' }] } };
    if (req.url.includes('/v2/payments/refunds/')) return { status: 500, body: { name: 'INTERNAL_SERVER_ERROR', message: 'An internal server error occurred.', debug_id: 'd' } };
    if (req.url.includes('/v2/payments/captures/')) return { status: 401, body: { name: 'AUTHENTICATION_FAILURE', message: 'Authentication failed due to invalid authentication credentials.', debug_id: 'd' } };
    return { status: 404, body: {} };
  });
  const p = paypalProvider(env, { clientOptions });

  const definitive = await rejects(p.voidAuthorization('AUTH1', 'void-req-1')) as ProviderError;
  assert.ok(definitive instanceof ProviderError);
  assert.deepEqual([definitive.kind, definitive.issue, definitive.status], ['definitive', 'PREVIOUSLY_CAPTURED', 422]);
  assert.match(definitive.message, /previously captured/);
  const voidReq = seen.find(r => r.url.endsWith('/v2/payments/authorizations/AUTH1/void'))!;
  assert.equal(voidReq.headers['paypal-request-id'], 'void-req-1', 'the persisted request ID reaches PayPal');
  assert.equal(voidReq.headers.authorization, 'Bearer seeded-token');

  const bare = await rejects(p.getRefund('REF1')) as ProviderError;
  assert.deepEqual([bare.kind, bare.issue, bare.status], ['unknown', 'INTERNAL_SERVER_ERROR', 500]);
  const unauthorized = await rejects(p.getCapture('CAP1')) as ProviderError;
  assert.deepEqual([unauthorized.kind, unauthorized.issue, unauthorized.status], ['unknown', 'AUTHENTICATION_FAILURE', 401], '401 is about our token, never the payment');
  assert.equal(seen.filter(r => r.url.includes('/v2/payments/refunds/')).length, 1, 'retries are off: one attempt');
});

test('token provider: one failed token fetch fails only that call, and the next call fetches a token and succeeds', async () => {
  let tokenCalls = 0;
  const { clientOptions, seen } = sdkStub(req => {
    if (req.url.endsWith('/v1/oauth2/token')) {
      return ++tokenCalls === 1 ? { status: 503, body: { name: 'SERVICE_UNAVAILABLE', message: 'Service Unavailable.' } }
        : { status: 200, body: { access_token: 'fresh-token', token_type: 'Bearer', expires_in: 32400 } };
    }
    return { status: 200, body: order('ORDER1') };
  }, { seedToken: false });
  const p = paypalProvider(env, { clientOptions });
  const first = await rejects(p.getOrder('ORDER1')) as ProviderError;
  assert.ok(first instanceof ProviderError);
  assert.equal(first.kind, 'unknown', 'retried by the worker with the same request ID');
  assert.equal(seen.filter(r => r.url.includes('/v2/checkout/orders/')).length, 0, 'the order call was never sent without a token');
  const second = await p.getOrder('ORDER1');
  assert.deepEqual([second.id, second.status, second.amountMinor], ['ORDER1', 'APPROVED', 2123]);
  assert.equal(tokenCalls, 2, 'the failed token was not cached');
  assert.equal(seen.find(r => r.url.includes('/v2/checkout/orders/'))!.headers.authorization, 'Bearer fresh-token');
  await p.getOrder('ORDER1');
  assert.equal(tokenCalls, 2, 'the good token is reused');
});

test('test-card checkout: PAYER_CANNOT_PAY moves to the next sandbox card with a derived request ID; other declines do not', async () => {
  let created = 0;
  const { clientOptions, seen } = sdkStub(req => {
    if (req.method === 'POST' && req.url.endsWith('/v2/checkout/orders')) {
      return ++created < 3 ? { status: 422, body: { name: 'UNPROCESSABLE_ENTITY', message: 'x', debug_id: 'd', details: [{ issue: 'PAYER_CANNOT_PAY', description: 'Combination of payer and payee settings mean that this buyer cannot pay this seller.' }] } }
        : { status: 201, body: { ...order('ORDER3', 'COMPLETED'), links: [] } };
    }
    return { status: 404, body: {} };
  });
  const p = paypalProvider({ ...env, testCardCheckout: true }, { clientOptions });
  const args = { intent: 'AUTHORIZE' as const, amountMinor: 2123, referenceId: 'cmp_1', customId: 'pay_1', description: 'provable.bid: test', requestId: 'req-1', returnUrl: 'http://web.test/c', cancelUrl: 'http://web.test/c' };
  const r = await p.createOrder(args);
  assert.deepEqual(r, { orderId: 'ORDER3', approvalUrl: 'http://web.test/c' });
  const posts = seen.filter(x => x.method === 'POST' && x.url.endsWith('/v2/checkout/orders'));
  assert.deepEqual(posts.map(x => x.data.payment_source.card.number), TEST_CARDS.slice(0, 3));
  assert.deepEqual(posts.map(x => x.headers['paypal-request-id']), ['req-1', 'req-1-c1', 'req-1-c2']);

  const declined = sdkStub(() => ({ status: 422, body: { name: 'UNPROCESSABLE_ENTITY', message: 'x', debug_id: 'd', details: [{ issue: 'CARD_EXPIRED' }] } }));
  const e = await rejects(paypalProvider({ ...env, testCardCheckout: true }, { clientOptions: declined.clientOptions }).createOrder(args)) as ProviderError;
  assert.equal(e.issue, 'CARD_EXPIRED');
  assert.equal(declined.seen.length, 1, 'no rotation for other declines');
});

test('payouts: a duplicate sender_batch_id follows PayPal\'s link to the original batch; without a link it is flagged, never paid twice', async () => {
  const dup = (links: unknown[]) => ({ status: 400, body: { name: 'VALIDATION_ERROR', message: 'Invalid request - see details', debug_id: 'd',
    details: [{ field: 'sender_batch_header.sender_batch_id', location: 'body', issue: 'Batch with given sender_batch_id already exists' }], links } });
  const original = { batch_header: { payout_batch_id: 'BATCH123', batch_status: 'SUCCESS', sender_batch_header: { sender_batch_id: 'senderbatch1' } }, items: [] };
  const linked = fetchStub((method, url) => method === 'POST' ? dup([{ href: `${SANDBOX}/v1/payments/payouts/BATCH123`, rel: 'self', method: 'GET' }])
    : url.endsWith('/v1/payments/payouts/BATCH123') ? { status: 200, body: original } : { status: 404, body: {} });
  const p = paypalProvider(env, { fetch: linked.fetch });
  const payout = { batchId: 'senderbatch1', payerId: 'PAYER1', amountMinor: 1900, subject: 's', note: 'n' };
  assert.deepEqual(await p.sendPayout(payout), { batchId: 'BATCH123', status: 'SUCCESS', existing: true });
  const post = linked.seen.find(x => x.method === 'POST' && x.url.endsWith('/v1/payments/payouts'))!;
  assert.equal(post.headers['paypal-request-id'], 'payout-senderbatch1', 'a retried POST replays the original 201 within 30 days');
  assert.equal(post.data.sender_batch_header.sender_batch_id, 'senderbatch1');

  const unlinked = fetchStub(() => dup([]));
  const e = await rejects(paypalProvider(env, { fetch: unlinked.fetch }).sendPayout(payout)) as ProviderError;
  assert.deepEqual([e.kind, e.issue], ['definitive', 'DUPLICATE_SENDER_BATCH_ID']);

  const other = fetchStub(() => ({ status: 400, body: { name: 'VALIDATION_ERROR', message: 'Invalid request', details: [{ field: 'items[0].receiver', issue: 'Receiver is invalid or does not match with type' }] } }));
  const e2 = await rejects(paypalProvider(env, { fetch: other.fetch }).sendPayout(payout)) as ProviderError;
  assert.equal(e2.issue, 'Receiver is invalid or does not match with type', 'other rejections are not mistaken for duplicates');
});

test('refunds and disputes are re-read: capture from the up link, cumulative refunded total, resolved disputes read in full', async () => {
  const { clientOptions } = sdkStub(req => req.url.endsWith('/v2/payments/refunds/REF1')
    ? { status: 200, body: { id: 'REF1', status: 'COMPLETED', amount: { currency_code: 'USD', value: '5.00' },
        seller_payable_breakdown: { total_refunded_amount: { currency_code: 'USD', value: '7.50' } },
        links: [{ href: `${SANDBOX}/v2/payments/refunds/REF1`, rel: 'self', method: 'GET' }, { href: `${SANDBOX}/v2/payments/captures/CAP9`, rel: 'up', method: 'GET' }] } }
    : { status: 404, body: {} });
  const disputes = fetchStub((_m, url) => url.includes('?disputed_transaction_id=CAP9')
    ? { status: 200, body: { items: [{ dispute_id: 'PP-D-1', status: 'RESOLVED' }, { dispute_id: 'PP-D-2', status: 'UNDER_REVIEW' }] } }
    : url.endsWith('/v1/customer/disputes/PP-D-1') ? { status: 200, body: { dispute_id: 'PP-D-1', status: 'RESOLVED', dispute_outcome: { outcome_code: 'CANCELED_BY_BUYER' }, disputed_transactions: [{ seller_transaction_id: 'CAP9' }] } }
    : { status: 404, body: { name: 'RESOURCE_NOT_FOUND' } });
  const p = paypalProvider(env, { clientOptions, fetch: disputes.fetch });
  assert.deepEqual(await p.getRefund('REF1'), { id: 'REF1', status: 'COMPLETED', amountMinor: 500, captureId: 'CAP9', totalRefundedMinor: 750 });
  assert.deepEqual(await p.listDisputes('CAP9'), [
    { id: 'PP-D-1', status: 'RESOLVED', outcome: 'CANCELED_BY_BUYER', captureIds: ['CAP9'] },
    { id: 'PP-D-2', status: 'UNDER_REVIEW', outcome: null, captureIds: ['CAP9'] },
  ]);
  assert.equal(captureIdFromLinks([{ href: `${SANDBOX}/v2/payments/captures/CAP9`, rel: 'self' }]), null, 'only rel=up names the parent capture');
});
