import type { AuthSchemes } from "../auth-schemes.js";
import { ApiError, type Declared, type Undeclared } from "../core/api-error.js";
import type { ApiPromise } from "../core/api-promise.js";
import type { RequestOptions } from "../core/api-request.js";
import type { RawClient } from "../core/raw-client.js";
import type { ErrorDecoders } from "../core/response-decoder.js";
import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { competitionPageInternalSchema, type CompetitionPage } from "../models/competition-page.js";
import { competitionInternalSchema, type Competition } from "../models/competition.js";
import {
  createCompetitionInternalSchema,
  createCompetitionSchema,
  type CreateCompetition,
} from "../models/create-competition.js";
import { paymentInternalSchema, type Payment } from "../models/payment.js";
import { problemInternalSchema, type Problem } from "../models/problem.js";
import { purchaseInternalSchema, type Purchase } from "../models/purchase.js";
import {
  selectSubmissionInternalSchema,
  selectSubmissionSchema,
  type SelectSubmission,
} from "../models/select-submission.js";
import type { Servers } from "../servers.js";

/**
 * Briefs, deadlines, and buyer decisions.
 */
export class Competitions {
  readonly #rawClient: RawClient;
  readonly #servers: Servers;
  readonly #auth: AuthSchemes;

  constructor(rawClient: RawClient, servers: Servers, auth: AuthSchemes) {
    this.#rawClient = rawClient;
    this.#servers = servers;
    this.#auth = auth;
  }

  /**
   * Create an immutable buyer-owned draft and snapshot policy
   *
   * @remarks
   * Buyer only. Web page brief: title, brief, price (bid), 5/15/60 minute submission window,
   * decision window, 1–10 checkable requirements. Immutable after creation. accepted_terms_version
   * must equal config.terms_version or returns 422.
   *
   * @returns Competition resource.
   *
   * @throws {@link Competitions.CreateCompetitionError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  createCompetition(
    request: Competitions.CreateCompetitionRequest,
    options?: RequestOptions,
  ): ApiPromise<Competition, Competitions.CreateCompetitionError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/v1/competitions"),
        auth: this.#auth.bearerAuth,
        pathParams: [],
        query: [],
        headers: [{ name: "Idempotency-Key", value: request.idempotencyKey, schema: s.string() }],
        body: { kind: "json", value: request.body, schema: createCompetitionInternalSchema },
      },
      {
        success: { kind: "json", schema: competitionInternalSchema },
        errorFactory: Competitions.CreateCompetitionError,
      },
      options,
    );
  }

  /**
   * Read competition status and authoritative deadlines
   *
   * @remarks
   * Read competition status and authoritative deadlines.
   *
   * @returns Competition resource.
   *
   * @throws {@link Competitions.GetCompetitionError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  getCompetition(
    request: Competitions.GetCompetitionRequest,
    options?: RequestOptions,
  ): ApiPromise<Competition, Competitions.GetCompetitionError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/competitions/{competition_id}"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "competition_id", value: request.competitionId, schema: s.string() }],
        query: [],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: competitionInternalSchema },
        errorFactory: Competitions.GetCompetitionError,
      },
      options,
    );
  }

  /**
   * List published competitions and the caller's drafts
   *
   * @remarks
   * List published competitions and the caller's drafts.
   *
   * @returns Visible competitions.
   *
   * @throws {@link Competitions.ListCompetitionsError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  listCompetitions(
    request: Competitions.ListCompetitionsRequest = {},
    options?: RequestOptions,
  ): ApiPromise<CompetitionPage, Competitions.ListCompetitionsError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/competitions"),
        auth: this.#auth.bearerAuth,
        pathParams: [],
        query: [
          { name: "cursor", value: request.cursor, schema: s.optional(s.string()) },
          { name: "limit", value: request.limit, schema: s.defaulted(s.int(), 20) },
        ],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: competitionPageInternalSchema },
        errorFactory: Competitions.ListCompetitionsError,
      },
      options,
    );
  }

  /**
   * Reject all entries and void the authorization; the buyer pays nothing
   *
   * @remarks
   * Buyer owner only; no first selection yet, before the decision deadline. Rejects all entries and
   * voids the authorization: the buyer pays nothing. Missing the decision deadline, or no
   * qualifiers, has the same effect automatically.
   *
   * @returns Payment resource; 202 indicates accepted command, not completed payment.
   *
   * @throws {@link Competitions.RejectAllError} when the API answers with an error status — narrow
   * on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  rejectAll(
    request: Competitions.RejectAllRequest,
    options?: RequestOptions,
  ): ApiPromise<Payment, Competitions.RejectAllError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/v1/competitions/{competition_id}/rejection"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "competition_id", value: request.competitionId, schema: s.string() }],
        query: [],
        headers: [{ name: "Idempotency-Key", value: request.idempotencyKey, schema: s.string() }],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: paymentInternalSchema },
        errorFactory: Competitions.RejectAllError,
      },
      options,
    );
  }

  /**
   * Commit the first winner and queue full authorization capture
   *
   * @remarks
   * Buyer owner only; any qualified entry, while open/qualifying/deciding and before the decision
   * deadline. Commits the winner and queues a full capture of the authorization (final_capture).
   * Delivery unlocks after PayPal confirms the capture; the agent payout is queued after that.
   *
   * @returns Purchase resource; poll payment status before offering delivery.
   *
   * @throws {@link Competitions.SelectFirstWinnerError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  selectFirstWinner(
    request: Competitions.SelectFirstWinnerRequest,
    options?: RequestOptions,
  ): ApiPromise<Purchase, Competitions.SelectFirstWinnerError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/v1/competitions/{competition_id}/selection"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "competition_id", value: request.competitionId, schema: s.string() }],
        query: [],
        headers: [{ name: "Idempotency-Key", value: request.idempotencyKey, schema: s.string() }],
        body: { kind: "json", value: request.body, schema: selectSubmissionInternalSchema },
      },
      {
        success: { kind: "json", schema: purchaseInternalSchema },
        errorFactory: Competitions.SelectFirstWinnerError,
      },
      options,
    );
  }
}

export namespace Competitions {
  export type CreateCompetitionRequest = {
    /** Unique logical command key; use the same key and body for network retries. */
    idempotencyKey: string;
    body: CreateCompetition;
  };

  export const createCompetitionRequestSchema: Schema<CreateCompetitionRequest> = s.lazySchema(() =>
    s.object<CreateCompetitionRequest>({
      idempotencyKey: s.string().check(s.pattern("^[A-Za-z0-9_-]{8,128}$")),
      body: createCompetitionSchema,
    }),
  );

  export class CreateCompetitionError extends ApiError {
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

    static readonly errors: ErrorDecoders<CreateCompetitionError> = [
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

  export type GetCompetitionRequest = {
    competitionId: string;
  };

  export const getCompetitionRequestSchema: Schema<GetCompetitionRequest> = s.lazySchema(() =>
    s.object<GetCompetitionRequest>({
      competitionId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    }),
  );

  export class GetCompetitionError extends ApiError {
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

    static readonly errors: ErrorDecoders<GetCompetitionError> = [
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

  export type ListCompetitionsRequest = {
    cursor?: string;
    /** @default 20 */
    limit?: number;
  };

  export const listCompetitionsRequestSchema: Schema<ListCompetitionsRequest> = s.lazySchema(() =>
    s.object<ListCompetitionsRequest>({
      cursor: s.optional(s.string().check(s.minLength(1), s.maxLength(256))),
      limit: s.defaulted(s.int().check(s.gte(1), s.lte(100)), 20),
    }),
  );

  export class ListCompetitionsError extends ApiError {
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

    static readonly errors: ErrorDecoders<ListCompetitionsError> = [
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

  export type RejectAllRequest = {
    competitionId: string;
    /** Unique logical command key; use the same key and body for network retries. */
    idempotencyKey: string;
  };

  export const rejectAllRequestSchema: Schema<RejectAllRequest> = s.lazySchema(() =>
    s.object<RejectAllRequest>({
      competitionId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
      idempotencyKey: s.string().check(s.pattern("^[A-Za-z0-9_-]{8,128}$")),
    }),
  );

  export class RejectAllError extends ApiError {
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

    static readonly errors: ErrorDecoders<RejectAllError> = [
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

  export type SelectFirstWinnerRequest = {
    competitionId: string;
    /** Unique logical command key; use the same key and body for network retries. */
    idempotencyKey: string;
    body: SelectSubmission;
  };

  export const selectFirstWinnerRequestSchema: Schema<SelectFirstWinnerRequest> = s.lazySchema(() =>
    s.object<SelectFirstWinnerRequest>({
      competitionId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
      idempotencyKey: s.string().check(s.pattern("^[A-Za-z0-9_-]{8,128}$")),
      body: selectSubmissionSchema,
    }),
  );

  export class SelectFirstWinnerError extends ApiError {
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

    static readonly errors: ErrorDecoders<SelectFirstWinnerError> = [
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
