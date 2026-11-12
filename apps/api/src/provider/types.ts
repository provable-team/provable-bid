/**
 * The payment provider boundary. Every call that can move money takes a requestId that the caller
 * persisted in its operation journal BEFORE the call, so a retry after a timeout or crash reuses it and
 * PayPal returns the original result instead of creating a second order/capture/void/payout.
 */
export type Intent = 'AUTHORIZE' | 'CAPTURE';

/**
 * definitive: PayPal refused (4xx with an issue); retrying the same request can't succeed.
 * unknown: network error, timeout or 5xx; the outcome is unknown, so reconcile (GET) and retry with the SAME requestId.
 */
export class ProviderError extends Error {
  constructor(message: string, readonly kind: 'definitive' | 'unknown', readonly issue: string | null = null, readonly status: number | null = null,
    /** HATEOAS links from PayPal's error body (e.g. the original batch on a duplicate sender_batch_id). */
    readonly links: { href: string; rel?: string }[] = []) {
    super(message);
  }
}

export interface OrderView {
  id: string;
  status: string; // CREATED | APPROVED | COMPLETED | VOIDED | PAYER_ACTION_REQUIRED
  intent: Intent;
  amountMinor: number;
  referenceId: string | null;
  customId: string | null;
  payerCountry: string | null;
  authorization: AuthorizationView | null;
  capture: CaptureView | null;
}
export interface AuthorizationView { id: string; status: string; createTime: string; expirationTime: string | null; }
export interface CaptureView { id: string; status: string; amountMinor: number; feeMinor: number | null; }
export interface PayoutView { batchId: string; batchStatus: string; itemStatus: string | null; feeMinor: number | null; error: string | null; /** PayPal transaction ID of the payout item, once PayPal assigns one. */ transactionId?: string | null; }
/** A refund (or a reversal, which PayPal reports as a refund resource) re-read from PayPal. */
export interface RefundView { id: string; status: string; amountMinor: number; captureId: string | null; totalRefundedMinor: number | null; }
/** A dispute re-read from the Disputes API. outcome is dispute_outcome.outcome_code once RESOLVED. */
export interface DisputeView { id: string; status: string; outcome: string | null; captureIds: string[]; }
export interface PayPalIdentity { payerId: string; name: string; email: string | null; }

export interface PaymentProvider {
  readonly mode: 'mock' | 'paypal_sandbox' | 'paypal_live';
  createOrder(o: { intent: Intent; amountMinor: number; referenceId: string; customId: string; description: string; requestId: string; returnUrl: string; cancelUrl: string }): Promise<{ orderId: string; approvalUrl: string }>;
  getOrder(orderId: string): Promise<OrderView>;
  authorizeOrder(orderId: string, requestId: string): Promise<AuthorizationView>;
  getAuthorization(authorizationId: string): Promise<AuthorizationView>;
  captureAuthorization(authorizationId: string, amountMinor: number, requestId: string): Promise<CaptureView>;
  captureOrder(orderId: string, requestId: string): Promise<CaptureView>;
  getCapture(captureId: string): Promise<CaptureView>;
  voidAuthorization(authorizationId: string, requestId: string): Promise<AuthorizationView>;
  refundCapture(captureId: string, amountMinor: number, requestId: string): Promise<{ id: string; status: string }>;
  getRefund(refundId: string): Promise<RefundView>;
  /** batchId is our sender_batch_id. existing = PayPal already had a batch with it (an earlier attempt's response was lost). */
  sendPayout(o: { batchId: string; payerId: string; amountMinor: number; subject: string; note: string }): Promise<{ batchId: string; status: string; existing?: boolean }>;
  getPayout(batchId: string): Promise<PayoutView>;
  getDispute(disputeId: string): Promise<DisputeView>;
  /** Every dispute PayPal has on one capture (GET /v1/customer/disputes?disputed_transaction_id=). */
  listDisputes(captureId: string): Promise<DisputeView[]>;
  /** Ask PayPal whether a webhook delivery is genuine (POST /v1/notifications/verify-webhook-signature). */
  verifyWebhook(headers: Record<string, string | undefined>, event: unknown): Promise<boolean>;
  /** Log in with PayPal (operators). */
  identityAuthorizeUrl(redirectUri: string, state: string): string;
  identityFromCode(code: string, redirectUri: string): Promise<PayPalIdentity>;
}
