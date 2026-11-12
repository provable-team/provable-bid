import type { AuthSchemes } from "../auth-schemes.js";
import { ApiError, type Declared, type Undeclared } from "../core/api-error.js";
import type { ApiPromise } from "../core/api-promise.js";
import type { RequestOptions } from "../core/api-request.js";
import type { RawClient } from "../core/raw-client.js";
import type { ErrorDecoders } from "../core/response-decoder.js";
import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { checkoutInternalSchema, type Checkout } from "../models/checkout.js";
import { deliveryAccessInternalSchema, type DeliveryAccess } from "../models/delivery-access.js";
import { paymentInternalSchema, type Payment } from "../models/payment.js";
import { problemInternalSchema, type Problem } from "../models/problem.js";
import { purchasePageInternalSchema, type PurchasePage } from "../models/purchase-page.js";
import { purchaseInternalSchema, type Purchase } from "../models/purchase.js";
import {
  refundRequestInternalSchema,
  refundRequestSchema,
  type RefundRequest,
} from "../models/refund-request.js";
import { refundInternalSchema, type Refund } from "../models/refund.js";
import {
  selectSubmissionInternalSchema,
  selectSubmissionSchema,
  type SelectSubmission,
} from "../models/select-submission.js";
import type { Servers } from "../servers.js";

/**
 * Authorization, capture, purchases, refunds, and delivery.
 */
export class Payments {
  readonly #rawClient: RawClient;
  readonly #servers: Servers;
  readonly #auth: AuthSchemes;

  constructor(rawClient: RawClient, servers: Servers, auth: AuthSchemes) {
    this.#rawClient = rawClient;
    this.#servers = servers;
    this.#auth = auth;
  }

  /**
   * Verify approved order, authorize server-side, and open the competition
   *
   * @remarks
   * Buyer owner only, after approving the PayPal order. The server reads the order from PayPal,
   * authorizes it, records the authorization ID/expiry, and opens the competition. Agents are
   * notified (webhooks) once open.
   *
   * @returns Payment resource; 202 indicates accepted command, not completed payment.
   *
   * @throws {@link Payments.AuthorizeCompetitionError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  authorizeCompetition(
    request: Payments.AuthorizeCompetitionRequest,
    options?: RequestOptions,
  ): ApiPromise<Payment, Payments.AuthorizeCompetitionError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/v1/competitions/{competition_id}/authorize"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "competition_id", value: request.competitionId, schema: s.string() }],
        query: [],
        headers: [{ name: "Idempotency-Key", value: request.idempotencyKey, schema: s.string() }],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: paymentInternalSchema },
        errorFactory: Payments.AuthorizeCompetitionError,
      },
      options,
    );
  }

  /**
   * Verify checkout approval and queue capture of an additional purchase
   *
   * @remarks
   * Buyer owner only. Additional purchases only; now < decision_deadline when committing. Stored
   * order is read and verified server-side. Deadline does not stop reconciliation of an already
   * committed capture. Poll purchase for outcome.
   *
   * @returns Purchase resource; poll payment status before offering delivery.
   *
   * @throws {@link Payments.CaptureAdditionalPurchaseError} when the API answers with an error
   * status — narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  captureAdditionalPurchase(
    request: Payments.CaptureAdditionalPurchaseRequest,
    options?: RequestOptions,
  ): ApiPromise<Purchase, Payments.CaptureAdditionalPurchaseError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/v1/purchases/{purchase_id}/capture"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "purchase_id", value: request.purchaseId, schema: s.string() }],
        query: [],
        headers: [{ name: "Idempotency-Key", value: request.idempotencyKey, schema: s.string() }],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: purchaseInternalSchema },
        errorFactory: Payments.CaptureAdditionalPurchaseError,
      },
      options,
    );
  }

  /**
   * Create a full-price CAPTURE checkout for another qualified submission
   *
   * @remarks
   * Buyer owner only; first purchase must be payment_completed; now < original decision_deadline
   * even after the competition closes. One purchase per competition and submission; an existing
   * purchase is returned across keys. Creates a separate CAPTURE checkout for price + processing
   * fee. Approval alone never unlocks work.
   *
   * @returns Purchase resource; poll payment status before offering delivery.
   *
   * @throws {@link Payments.CreateAdditionalPurchaseError} when the API answers with an error
   * status — narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  createAdditionalPurchase(
    request: Payments.CreateAdditionalPurchaseRequest,
    options?: RequestOptions,
  ): ApiPromise<Purchase, Payments.CreateAdditionalPurchaseError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/v1/competitions/{competition_id}/additional-purchases"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "competition_id", value: request.competitionId, schema: s.string() }],
        query: [],
        headers: [{ name: "Idempotency-Key", value: request.idempotencyKey, schema: s.string() }],
        body: { kind: "json", value: request.body, schema: selectSubmissionInternalSchema },
      },
      {
        success: { kind: "json", schema: purchaseInternalSchema },
        errorFactory: Payments.CreateAdditionalPurchaseError,
      },
      options,
    );
  }

  /**
   * Issue buyer-bound delivery URLs for all purchased originals after payment completion
   *
   * @remarks
   * Buyer owner only, after PayPal confirms the capture. Pending/failed refunds and open/lost
   * disputes lock delivery. Returns 60-second buyer-bound URLs to the original HTML; every read
   * rechecks entitlement. Replaying the same Idempotency-Key returns the original URLs, even if
   * expired; request fresh access with a new key. No-store.
   *
   * @returns Private, expiring delivery access.
   *
   * @throws {@link Payments.CreateDeliveryAccessError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  createDeliveryAccess(
    request: Payments.CreateDeliveryAccessRequest,
    options?: RequestOptions,
  ): ApiPromise<DeliveryAccess, Payments.CreateDeliveryAccessError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/v1/purchases/{purchase_id}/delivery-access"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "purchase_id", value: request.purchaseId, schema: s.string() }],
        query: [],
        headers: [{ name: "Idempotency-Key", value: request.idempotencyKey, schema: s.string() }],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: deliveryAccessInternalSchema },
        errorFactory: Payments.CreateDeliveryAccessError,
      },
      options,
    );
  }

  /**
   * Create or return the buyer's initial AUTHORIZE checkout
   *
   * @remarks
   * Buyer owner only, draft/awaiting_authorization only. Creates (or returns) the one PayPal
   * AUTHORIZE order for price + processing fee. The PayPal-Request-Id is persisted before the
   * provider call, so a retried or concurrent command returns the same order and never creates a
   * second one. After known checkout expiry, a new command key requests a replacement order on the
   * same payment, only after reconciliation proves the old order was never authorized.
   *
   * @returns Initial PayPal approval session; opening requires server authorization.
   *
   * @throws {@link Payments.CreateInitialCheckoutError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  createInitialCheckout(
    request: Payments.CreateInitialCheckoutRequest,
    options?: RequestOptions,
  ): ApiPromise<Checkout, Payments.CreateInitialCheckoutError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/v1/competitions/{competition_id}/checkout"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "competition_id", value: request.competitionId, schema: s.string() }],
        query: [],
        headers: [{ name: "Idempotency-Key", value: request.idempotencyKey, schema: s.string() }],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: checkoutInternalSchema },
        errorFactory: Payments.CreateInitialCheckoutError,
      },
      options,
    );
  }

  /**
   * Queue an admin full remaining refund of a completed capture
   *
   * @remarks
   * Admin only. Full remaining refund of a completed capture. Refund state is independent; a
   * requested refund immediately locks delivery and blocks an unpaid payout.
   *
   * @returns Refund resource, independent from capture completion.
   *
   * @throws {@link Payments.CreateRefundError} when the API answers with an error status — narrow
   * on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  createRefund(
    request: Payments.CreateRefundRequest,
    options?: RequestOptions,
  ): ApiPromise<Refund, Payments.CreateRefundError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/v1/payments/{payment_id}/refunds"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "payment_id", value: request.paymentId, schema: s.string() }],
        query: [],
        headers: [{ name: "Idempotency-Key", value: request.idempotencyKey, schema: s.string() }],
        body: { kind: "json", value: request.body, schema: refundRequestInternalSchema },
      },
      {
        success: { kind: "json", schema: refundInternalSchema },
        errorFactory: Payments.CreateRefundError,
      },
      options,
    );
  }

  /**
   * Read one paid original artifact with a buyer-bound expiring token
   *
   * @remarks
   * Buyer owner and valid token only; every read rechecks payment entitlement.
   *
   * @returns The purchased original HTML, byte-identical to the submitted asset (sha256 matches),
   * after an entitlement recheck.
   *
   * @throws {@link Payments.DownloadDeliveryError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  downloadDelivery(
    request: Payments.DownloadDeliveryRequest,
    options?: RequestOptions,
  ): ApiPromise<undefined, Payments.DownloadDeliveryError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/deliveries/{token}"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "token", value: request.token, schema: s.string() }],
        query: [],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "empty" },
        errorFactory: Payments.DownloadDeliveryError,
      },
      options,
    );
  }

  /**
   * Read buyer-owned or admin payment, including independent state dimensions
   *
   * @remarks
   * Read buyer-owned or admin payment, including independent state dimensions.
   *
   * @returns Payment resource; 202 indicates accepted command, not completed payment.
   *
   * @throws {@link Payments.GetPaymentError} when the API answers with an error status — narrow on
   * `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  getPayment(
    request: Payments.GetPaymentRequest,
    options?: RequestOptions,
  ): ApiPromise<Payment, Payments.GetPaymentError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/payments/{payment_id}"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "payment_id", value: request.paymentId, schema: s.string() }],
        query: [],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: paymentInternalSchema },
        errorFactory: Payments.GetPaymentError,
      },
      options,
    );
  }

  /**
   * Read the buyer's purchase and delivery entitlement
   *
   * @remarks
   * Read the buyer's purchase and delivery entitlement.
   *
   * @returns Purchase resource; poll payment status before offering delivery.
   *
   * @throws {@link Payments.GetPurchaseError} when the API answers with an error status — narrow on
   * `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  getPurchase(
    request: Payments.GetPurchaseRequest,
    options?: RequestOptions,
  ): ApiPromise<Purchase, Payments.GetPurchaseError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/purchases/{purchase_id}"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "purchase_id", value: request.purchaseId, schema: s.string() }],
        query: [],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: purchaseInternalSchema },
        errorFactory: Payments.GetPurchaseError,
      },
      options,
    );
  }

  /**
   * Read refund status as buyer owner or admin
   *
   * @remarks
   * Read refund status as buyer owner or admin.
   *
   * @returns Refund resource, independent from capture completion.
   *
   * @throws {@link Payments.GetRefundError} when the API answers with an error status — narrow on
   * `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  getRefund(
    request: Payments.GetRefundRequest,
    options?: RequestOptions,
  ): ApiPromise<Refund, Payments.GetRefundError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/refunds/{refund_id}"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "refund_id", value: request.refundId, schema: s.string() }],
        query: [],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: refundInternalSchema },
        errorFactory: Payments.GetRefundError,
      },
      options,
    );
  }

  /**
   * Recover the buyer's first and additional purchases after refresh
   *
   * @remarks
   * Buyer owner only; available after deadlines, refunds, or disputes.
   *
   * @returns The buyer's purchases, including independent payment status and entitlement.
   *
   * @throws {@link Payments.ListPurchasesError} when the API answers with an error status — narrow
   * on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  listPurchases(
    request: Payments.ListPurchasesRequest,
    options?: RequestOptions,
  ): ApiPromise<PurchasePage, Payments.ListPurchasesError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/competitions/{competition_id}/purchases"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "competition_id", value: request.competitionId, schema: s.string() }],
        query: [
          { name: "cursor", value: request.cursor, schema: s.optional(s.string()) },
          { name: "limit", value: request.limit, schema: s.defaulted(s.int(), 20) },
        ],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: purchasePageInternalSchema },
        errorFactory: Payments.ListPurchasesError,
      },
      options,
    );
  }

  /**
   * Request an admin reconciliation job using existing provider operation IDs
   *
   * @remarks
   * Admin only; no fresh charge. Mock returns unchanged state unless expiry is due.
   *
   * @returns Payment resource; 202 indicates accepted command, not completed payment.
   *
   * @throws {@link Payments.ReconcilePaymentError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  reconcilePayment(
    request: Payments.ReconcilePaymentRequest,
    options?: RequestOptions,
  ): ApiPromise<Payment, Payments.ReconcilePaymentError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/v1/payments/{payment_id}/reconcile"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "payment_id", value: request.paymentId, schema: s.string() }],
        query: [],
        headers: [{ name: "Idempotency-Key", value: request.idempotencyKey, schema: s.string() }],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: paymentInternalSchema },
        errorFactory: Payments.ReconcilePaymentError,
      },
      options,
    );
  }
}

export namespace Payments {
  export type AuthorizeCompetitionRequest = {
    competitionId: string;
    /** Unique logical command key; use the same key and body for network retries. */
    idempotencyKey: string;
  };

  export const authorizeCompetitionRequestSchema: Schema<AuthorizeCompetitionRequest> = s.lazySchema(() =>
    s.object<AuthorizeCompetitionRequest>({
      competitionId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
      idempotencyKey: s.string().check(s.pattern("^[A-Za-z0-9_-]{8,128}$")),
    }),
  );

  export class AuthorizeCompetitionError extends ApiError {
    declare readonly payload:
      | Declared<"problem", Problem>
      | Declared<"problem2", Problem>
      | Declared<"problem3", Problem>
      | Declared<"problem4", Problem>
      | Declared<"problem5", Problem>
      | Declared<"problem6", Problem>
      | Declared<"problem7", Problem>
      | Declared<"problem8", Problem>
      | Declared<"problem9", Problem>
      | Undeclared;

    static readonly errors: ErrorDecoders<AuthorizeCompetitionError> = [
      { on: 400, kind: "problem", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 401, kind: "problem2", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 403, kind: "problem3", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 404, kind: "problem4", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 409, kind: "problem5", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 413, kind: "problem6", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 422, kind: "problem7", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 429, kind: "problem8", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 503, kind: "problem9", decode: { kind: "json", schema: problemInternalSchema } },
    ];
  }

  export type CaptureAdditionalPurchaseRequest = {
    purchaseId: string;
    /** Unique logical command key; use the same key and body for network retries. */
    idempotencyKey: string;
  };

  export const captureAdditionalPurchaseRequestSchema: Schema<CaptureAdditionalPurchaseRequest> =
    s.lazySchema(() =>
      s.object<CaptureAdditionalPurchaseRequest>({
        purchaseId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
        idempotencyKey: s.string().check(s.pattern("^[A-Za-z0-9_-]{8,128}$")),
      }),
    );

  export class CaptureAdditionalPurchaseError extends ApiError {
    declare readonly payload:
      | Declared<"problem", Problem>
      | Declared<"problem2", Problem>
      | Declared<"problem3", Problem>
      | Declared<"problem4", Problem>
      | Declared<"problem5", Problem>
      | Declared<"problem6", Problem>
      | Declared<"problem7", Problem>
      | Declared<"problem8", Problem>
      | Declared<"problem9", Problem>
      | Undeclared;

    static readonly errors: ErrorDecoders<CaptureAdditionalPurchaseError> = [
      { on: 400, kind: "problem", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 401, kind: "problem2", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 403, kind: "problem3", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 404, kind: "problem4", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 409, kind: "problem5", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 413, kind: "problem6", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 422, kind: "problem7", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 429, kind: "problem8", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 503, kind: "problem9", decode: { kind: "json", schema: problemInternalSchema } },
    ];
  }

  export type CreateAdditionalPurchaseRequest = {
    competitionId: string;
    /** Unique logical command key; use the same key and body for network retries. */
    idempotencyKey: string;
    body: SelectSubmission;
  };

  export const createAdditionalPurchaseRequestSchema: Schema<CreateAdditionalPurchaseRequest> = s.lazySchema(
    () =>
      s.object<CreateAdditionalPurchaseRequest>({
        competitionId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
        idempotencyKey: s.string().check(s.pattern("^[A-Za-z0-9_-]{8,128}$")),
        body: selectSubmissionSchema,
      }),
  );

  export class CreateAdditionalPurchaseError extends ApiError {
    declare readonly payload:
      | Declared<"problem", Problem>
      | Declared<"problem2", Problem>
      | Declared<"problem3", Problem>
      | Declared<"problem4", Problem>
      | Declared<"problem5", Problem>
      | Declared<"problem6", Problem>
      | Declared<"problem7", Problem>
      | Declared<"problem8", Problem>
      | Declared<"problem9", Problem>
      | Undeclared;

    static readonly errors: ErrorDecoders<CreateAdditionalPurchaseError> = [
      { on: 400, kind: "problem", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 401, kind: "problem2", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 403, kind: "problem3", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 404, kind: "problem4", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 409, kind: "problem5", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 413, kind: "problem6", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 422, kind: "problem7", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 429, kind: "problem8", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 503, kind: "problem9", decode: { kind: "json", schema: problemInternalSchema } },
    ];
  }

  export type CreateDeliveryAccessRequest = {
    purchaseId: string;
    /** Unique logical command key; use the same key and body for network retries. */
    idempotencyKey: string;
  };

  export const createDeliveryAccessRequestSchema: Schema<CreateDeliveryAccessRequest> = s.lazySchema(() =>
    s.object<CreateDeliveryAccessRequest>({
      purchaseId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
      idempotencyKey: s.string().check(s.pattern("^[A-Za-z0-9_-]{8,128}$")),
    }),
  );

  export class CreateDeliveryAccessError extends ApiError {
    declare readonly payload:
      | Declared<"problem", Problem>
      | Declared<"problem2", Problem>
      | Declared<"problem3", Problem>
      | Declared<"problem4", Problem>
      | Declared<"problem5", Problem>
      | Declared<"problem6", Problem>
      | Declared<"problem7", Problem>
      | Declared<"problem8", Problem>
      | Declared<"problem9", Problem>
      | Undeclared;

    static readonly errors: ErrorDecoders<CreateDeliveryAccessError> = [
      { on: 400, kind: "problem", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 401, kind: "problem2", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 403, kind: "problem3", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 404, kind: "problem4", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 409, kind: "problem5", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 413, kind: "problem6", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 422, kind: "problem7", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 429, kind: "problem8", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 503, kind: "problem9", decode: { kind: "json", schema: problemInternalSchema } },
    ];
  }

  export type CreateInitialCheckoutRequest = {
    competitionId: string;
    /** Unique logical command key; use the same key and body for network retries. */
    idempotencyKey: string;
  };

  export const createInitialCheckoutRequestSchema: Schema<CreateInitialCheckoutRequest> = s.lazySchema(() =>
    s.object<CreateInitialCheckoutRequest>({
      competitionId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
      idempotencyKey: s.string().check(s.pattern("^[A-Za-z0-9_-]{8,128}$")),
    }),
  );

  export class CreateInitialCheckoutError extends ApiError {
    declare readonly payload:
      | Declared<"problem", Problem>
      | Declared<"problem2", Problem>
      | Declared<"problem3", Problem>
      | Declared<"problem4", Problem>
      | Declared<"problem5", Problem>
      | Declared<"problem6", Problem>
      | Declared<"problem7", Problem>
      | Declared<"problem8", Problem>
      | Declared<"problem9", Problem>
      | Undeclared;

    static readonly errors: ErrorDecoders<CreateInitialCheckoutError> = [
      { on: 400, kind: "problem", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 401, kind: "problem2", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 403, kind: "problem3", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 404, kind: "problem4", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 409, kind: "problem5", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 413, kind: "problem6", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 422, kind: "problem7", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 429, kind: "problem8", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 503, kind: "problem9", decode: { kind: "json", schema: problemInternalSchema } },
    ];
  }

  export type CreateRefundRequest = {
    paymentId: string;
    /** Unique logical command key; use the same key and body for network retries. */
    idempotencyKey: string;
    body: RefundRequest;
  };

  export const createRefundRequestSchema: Schema<CreateRefundRequest> = s.lazySchema(() =>
    s.object<CreateRefundRequest>({
      paymentId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
      idempotencyKey: s.string().check(s.pattern("^[A-Za-z0-9_-]{8,128}$")),
      body: refundRequestSchema,
    }),
  );

  export class CreateRefundError extends ApiError {
    declare readonly payload:
      | Declared<"problem", Problem>
      | Declared<"problem2", Problem>
      | Declared<"problem3", Problem>
      | Declared<"problem4", Problem>
      | Declared<"problem5", Problem>
      | Declared<"problem6", Problem>
      | Declared<"problem7", Problem>
      | Declared<"problem8", Problem>
      | Declared<"problem9", Problem>
      | Undeclared;

    static readonly errors: ErrorDecoders<CreateRefundError> = [
      { on: 400, kind: "problem", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 401, kind: "problem2", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 403, kind: "problem3", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 404, kind: "problem4", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 409, kind: "problem5", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 413, kind: "problem6", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 422, kind: "problem7", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 429, kind: "problem8", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 503, kind: "problem9", decode: { kind: "json", schema: problemInternalSchema } },
    ];
  }

  export type DownloadDeliveryRequest = {
    token: string;
  };

  export const downloadDeliveryRequestSchema: Schema<DownloadDeliveryRequest> = s.lazySchema(() =>
    s.object<DownloadDeliveryRequest>({
      token: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    }),
  );

  export class DownloadDeliveryError extends ApiError {
    declare readonly payload:
      | Declared<"problem", Problem>
      | Declared<"problem2", Problem>
      | Declared<"problem3", Problem>
      | Declared<"problem4", Problem>
      | Declared<"problem5", Problem>
      | Declared<"problem6", Problem>
      | Declared<"problem7", Problem>
      | Declared<"problem8", Problem>
      | Declared<"problem9", Problem>
      | Undeclared;

    static readonly errors: ErrorDecoders<DownloadDeliveryError> = [
      { on: 400, kind: "problem", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 401, kind: "problem2", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 403, kind: "problem3", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 404, kind: "problem4", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 409, kind: "problem5", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 413, kind: "problem6", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 422, kind: "problem7", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 429, kind: "problem8", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 503, kind: "problem9", decode: { kind: "json", schema: problemInternalSchema } },
    ];
  }

  export type GetPaymentRequest = {
    paymentId: string;
  };

  export const getPaymentRequestSchema: Schema<GetPaymentRequest> = s.lazySchema(() =>
    s.object<GetPaymentRequest>({
      paymentId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    }),
  );

  export class GetPaymentError extends ApiError {
    declare readonly payload:
      | Declared<"problem", Problem>
      | Declared<"problem2", Problem>
      | Declared<"problem3", Problem>
      | Declared<"problem4", Problem>
      | Declared<"problem5", Problem>
      | Declared<"problem6", Problem>
      | Declared<"problem7", Problem>
      | Declared<"problem8", Problem>
      | Declared<"problem9", Problem>
      | Undeclared;

    static readonly errors: ErrorDecoders<GetPaymentError> = [
      { on: 400, kind: "problem", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 401, kind: "problem2", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 403, kind: "problem3", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 404, kind: "problem4", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 409, kind: "problem5", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 413, kind: "problem6", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 422, kind: "problem7", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 429, kind: "problem8", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 503, kind: "problem9", decode: { kind: "json", schema: problemInternalSchema } },
    ];
  }

  export type GetPurchaseRequest = {
    purchaseId: string;
  };

  export const getPurchaseRequestSchema: Schema<GetPurchaseRequest> = s.lazySchema(() =>
    s.object<GetPurchaseRequest>({
      purchaseId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    }),
  );

  export class GetPurchaseError extends ApiError {
    declare readonly payload:
      | Declared<"problem", Problem>
      | Declared<"problem2", Problem>
      | Declared<"problem3", Problem>
      | Declared<"problem4", Problem>
      | Declared<"problem5", Problem>
      | Declared<"problem6", Problem>
      | Declared<"problem7", Problem>
      | Declared<"problem8", Problem>
      | Declared<"problem9", Problem>
      | Undeclared;

    static readonly errors: ErrorDecoders<GetPurchaseError> = [
      { on: 400, kind: "problem", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 401, kind: "problem2", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 403, kind: "problem3", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 404, kind: "problem4", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 409, kind: "problem5", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 413, kind: "problem6", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 422, kind: "problem7", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 429, kind: "problem8", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 503, kind: "problem9", decode: { kind: "json", schema: problemInternalSchema } },
    ];
  }

  export type GetRefundRequest = {
    refundId: string;
  };

  export const getRefundRequestSchema: Schema<GetRefundRequest> = s.lazySchema(() =>
    s.object<GetRefundRequest>({
      refundId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    }),
  );

  export class GetRefundError extends ApiError {
    declare readonly payload:
      | Declared<"problem", Problem>
      | Declared<"problem2", Problem>
      | Declared<"problem3", Problem>
      | Declared<"problem4", Problem>
      | Declared<"problem5", Problem>
      | Declared<"problem6", Problem>
      | Declared<"problem7", Problem>
      | Declared<"problem8", Problem>
      | Declared<"problem9", Problem>
      | Undeclared;

    static readonly errors: ErrorDecoders<GetRefundError> = [
      { on: 400, kind: "problem", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 401, kind: "problem2", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 403, kind: "problem3", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 404, kind: "problem4", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 409, kind: "problem5", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 413, kind: "problem6", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 422, kind: "problem7", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 429, kind: "problem8", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 503, kind: "problem9", decode: { kind: "json", schema: problemInternalSchema } },
    ];
  }

  export type ListPurchasesRequest = {
    competitionId: string;
    cursor?: string;
    /** @default 20 */
    limit?: number;
  };

  export const listPurchasesRequestSchema: Schema<ListPurchasesRequest> = s.lazySchema(() =>
    s.object<ListPurchasesRequest>({
      competitionId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
      cursor: s.optional(s.string().check(s.minLength(1), s.maxLength(256))),
      limit: s.defaulted(s.int().check(s.gte(1), s.lte(100)), 20),
    }),
  );

  export class ListPurchasesError extends ApiError {
    declare readonly payload:
      | Declared<"problem", Problem>
      | Declared<"problem2", Problem>
      | Declared<"problem3", Problem>
      | Declared<"problem4", Problem>
      | Declared<"problem5", Problem>
      | Declared<"problem6", Problem>
      | Declared<"problem7", Problem>
      | Declared<"problem8", Problem>
      | Declared<"problem9", Problem>
      | Undeclared;

    static readonly errors: ErrorDecoders<ListPurchasesError> = [
      { on: 400, kind: "problem", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 401, kind: "problem2", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 403, kind: "problem3", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 404, kind: "problem4", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 409, kind: "problem5", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 413, kind: "problem6", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 422, kind: "problem7", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 429, kind: "problem8", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 503, kind: "problem9", decode: { kind: "json", schema: problemInternalSchema } },
    ];
  }

  export type ReconcilePaymentRequest = {
    paymentId: string;
    /** Unique logical command key; use the same key and body for network retries. */
    idempotencyKey: string;
  };

  export const reconcilePaymentRequestSchema: Schema<ReconcilePaymentRequest> = s.lazySchema(() =>
    s.object<ReconcilePaymentRequest>({
      paymentId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
      idempotencyKey: s.string().check(s.pattern("^[A-Za-z0-9_-]{8,128}$")),
    }),
  );

  export class ReconcilePaymentError extends ApiError {
    declare readonly payload:
      | Declared<"problem", Problem>
      | Declared<"problem2", Problem>
      | Declared<"problem3", Problem>
      | Declared<"problem4", Problem>
      | Declared<"problem5", Problem>
      | Declared<"problem6", Problem>
      | Declared<"problem7", Problem>
      | Declared<"problem8", Problem>
      | Declared<"problem9", Problem>
      | Undeclared;

    static readonly errors: ErrorDecoders<ReconcilePaymentError> = [
      { on: 400, kind: "problem", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 401, kind: "problem2", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 403, kind: "problem3", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 404, kind: "problem4", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 409, kind: "problem5", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 413, kind: "problem6", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 422, kind: "problem7", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 429, kind: "problem8", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 503, kind: "problem9", decode: { kind: "json", schema: problemInternalSchema } },
    ];
  }
}
