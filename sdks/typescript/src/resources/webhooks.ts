import { ApiError, type Declared, type Undeclared } from "../core/api-error.js";
import type { ApiPromise } from "../core/api-promise.js";
import type { RequestOptions } from "../core/api-request.js";
import { noneAuth } from "../core/auth/schemes.js";
import type { RawClient } from "../core/raw-client.js";
import type { ErrorDecoders } from "../core/response-decoder.js";
import { uuid } from "../core/uuid.js";
import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { acknowledgementSchema, type Acknowledgement } from "../models/acknowledgement.js";
import { payPalEventInternalSchema, payPalEventSchema, type PayPalEvent } from "../models/pay-pal-event.js";
import { problemInternalSchema, type Problem } from "../models/problem.js";
import type { Servers } from "../servers.js";

/**
 * Verified provider notifications.
 */
export class Webhooks {
  readonly #rawClient: RawClient;
  readonly #servers: Servers;

  constructor(rawClient: RawClient, servers: Servers) {
    this.#rawClient = rawClient;
    this.#servers = servers;
  }

  /**
   * Verify and durably record a PayPal event before reconciliation
   *
   * @remarks
   * No bearer auth. Verify raw bytes and all transmission headers against stored webhook
   * ID/environment; event ID alone is not authentication. Deduplicate event ID, enqueue canonical
   * GET reconciliation, then acknowledge 200. Invalid signatures return 400;
   * persistence/verification availability failures return 503 to retry. Unknown verified events are
   * acknowledged without financial effects. Never rely on browser callbacks or delivery order.
   * Local mock requires exact mock headers.
   *
   * @returns Verified event durably accepted or previously recorded.
   *
   * @throws {@link Webhooks.ReceivePayPalWebhookError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  receivePayPalWebhook(
    request: Webhooks.ReceivePayPalWebhookRequest,
    options?: RequestOptions,
  ): ApiPromise<Acknowledgement, Webhooks.ReceivePayPalWebhookError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/v1/webhooks/paypal"),
        auth: noneAuth,
        pathParams: [],
        query: [],
        headers: [
          { name: "PAYPAL-TRANSMISSION-ID", value: request.paypalTransmissionId, schema: s.string() },
          { name: "PAYPAL-TRANSMISSION-TIME", value: request.paypalTransmissionTime, schema: s.dateTime() },
          { name: "PAYPAL-TRANSMISSION-SIG", value: request.paypalTransmissionSig, schema: s.string() },
          { name: "PAYPAL-CERT-URL", value: request.paypalCertUrl, schema: s.string() },
          { name: "PAYPAL-AUTH-ALGO", value: request.paypalAuthAlgo, schema: s.string() },
          { name: "Idempotency-Key", value: uuid(), schema: s.string() },
        ],
        body: { kind: "json", value: request.body, schema: payPalEventInternalSchema },
      },
      {
        success: { kind: "json", schema: acknowledgementSchema },
        errorFactory: Webhooks.ReceivePayPalWebhookError,
      },
      options,
    );
  }
}

export namespace Webhooks {
  export type ReceivePayPalWebhookRequest = {
    paypalTransmissionId: string;
    paypalTransmissionTime: Date;
    paypalTransmissionSig: string;
    paypalCertUrl: string;
    paypalAuthAlgo: string;
    body: PayPalEvent;
  };

  export const receivePayPalWebhookRequestSchema: Schema<ReceivePayPalWebhookRequest> = s.lazySchema(() =>
    s.object<ReceivePayPalWebhookRequest>({
      paypalTransmissionId: s.string().check(s.minLength(1)),
      paypalTransmissionTime: s.dateTime(),
      paypalTransmissionSig: s.string().check(s.minLength(1)),
      paypalCertUrl: s.string().check(s.url()),
      paypalAuthAlgo: s.string().check(s.minLength(1)),
      body: payPalEventSchema,
    }),
  );

  export class ReceivePayPalWebhookError extends ApiError {
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

    static readonly errors: ErrorDecoders<ReceivePayPalWebhookError> = [
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
