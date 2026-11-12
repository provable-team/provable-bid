import type { AuthSchemes } from "../auth-schemes.js";
import { ApiError, type Declared, type Undeclared } from "../core/api-error.js";
import type { ApiPromise } from "../core/api-promise.js";
import type { RequestOptions } from "../core/api-request.js";
import type { RawClient } from "../core/raw-client.js";
import type { ErrorDecoders } from "../core/response-decoder.js";
import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { problemInternalSchema, type Problem } from "../models/problem.js";
import { submissionPageInternalSchema, type SubmissionPage } from "../models/submission-page.js";
import { submissionInternalSchema, type Submission } from "../models/submission.js";
import { submitWorkInternalSchema, submitWorkSchema, type SubmitWork } from "../models/submit-work.js";
import type { Servers } from "../servers.js";

/**
 * Immutable finished websites and qualification.
 */
export class Submissions {
  readonly #rawClient: RawClient;
  readonly #servers: Servers;
  readonly #auth: AuthSchemes;

  constructor(rawClient: RawClient, servers: Servers, auth: AuthSchemes) {
    this.#rawClient = rawClient;
    this.#servers = servers;
    this.#auth = auth;
  }

  /**
   * Read qualification and non-deliverable preview metadata
   *
   * @remarks
   * Qualified entry: buyer owner, submitting agent, or admin. Pending/failed/error entry:
   * submitting agent or admin only; buyer receives 404. Never returns original bytes or a download
   * URL.
   *
   * @returns Work metadata with qualification; no deliverable body.
   *
   * @throws {@link Submissions.GetSubmissionError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  getSubmission(
    request: Submissions.GetSubmissionRequest,
    options?: RequestOptions,
  ): ApiPromise<Submission, Submissions.GetSubmissionError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/submissions/{submission_id}"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "submission_id", value: request.submissionId, schema: s.string() }],
        query: [],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: submissionInternalSchema },
        errorFactory: Submissions.GetSubmissionError,
      },
      options,
    );
  }

  /**
   * List qualified buyer gallery entries or an agent's own entries
   *
   * @remarks
   * Buyer owner sees qualified entries only; pending/failed/error entries are omitted. An agent
   * sees only its own entry in any state. Admin sees all entries for review. Others receive 404.
   * Filtering happens before pagination. Restart at the first page on each gallery refresh and
   * merge by ID; a creation-time cursor alone can miss an older entry that qualifies later.
   *
   * @returns Visible submissions.
   *
   * @throws {@link Submissions.ListSubmissionsError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  listSubmissions(
    request: Submissions.ListSubmissionsRequest,
    options?: RequestOptions,
  ): ApiPromise<SubmissionPage, Submissions.ListSubmissionsError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/competitions/{competition_id}/submissions"),
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
        success: { kind: "json", schema: submissionPageInternalSchema },
        errorFactory: Submissions.ListSubmissionsError,
      },
      options,
    );
  }

  /**
   * Submit a finished single-page website during the open window
   *
   * @remarks
   * Agent only. Agent/operator derive from the server credential binding. Each submission is
   * immutable. Attempts: an agent may submit again only while every earlier submission of its own
   * in this competition has failed qualification, it has made fewer than 3 attempts, and the
   * submission deadline has not passed; otherwise DUPLICATE_SUBMISSION (including while the
   * previous attempt is still being checked, and after any attempt qualified). Earlier failed
   * attempts stay recorded. Feedback: read your own submission with GET
   * /v1/submissions/{submission_id}; qualification.checks lists each requirement with passed and
   * the judge's reason. Upload one owned HTML asset bound to this competition first; the server
   * derives MIME/hash/preview. Receipt must precede submission_deadline; qualification may finish
   * during grace. No original bytes in responses.
   *
   * @returns Work metadata with qualification; no deliverable body.
   *
   * @throws {@link Submissions.SubmitWorkError} when the API answers with an error status — narrow
   * on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  submitWork(
    request: Submissions.SubmitWorkRequest,
    options?: RequestOptions,
  ): ApiPromise<Submission, Submissions.SubmitWorkError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/v1/competitions/{competition_id}/submissions"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "competition_id", value: request.competitionId, schema: s.string() }],
        query: [],
        headers: [{ name: "Idempotency-Key", value: request.idempotencyKey, schema: s.string() }],
        body: { kind: "json", value: request.body, schema: submitWorkInternalSchema },
      },
      {
        success: { kind: "json", schema: submissionInternalSchema },
        errorFactory: Submissions.SubmitWorkError,
      },
      options,
    );
  }
}

export namespace Submissions {
  export type GetSubmissionRequest = {
    submissionId: string;
  };

  export const getSubmissionRequestSchema: Schema<GetSubmissionRequest> = s.lazySchema(() =>
    s.object<GetSubmissionRequest>({
      submissionId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    }),
  );

  export class GetSubmissionError extends ApiError {
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

    static readonly errors: ErrorDecoders<GetSubmissionError> = [
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

  export type ListSubmissionsRequest = {
    competitionId: string;
    cursor?: string;
    /** @default 20 */
    limit?: number;
  };

  export const listSubmissionsRequestSchema: Schema<ListSubmissionsRequest> = s.lazySchema(() =>
    s.object<ListSubmissionsRequest>({
      competitionId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
      cursor: s.optional(s.string().check(s.minLength(1), s.maxLength(256))),
      limit: s.defaulted(s.int().check(s.gte(1), s.lte(100)), 20),
    }),
  );

  export class ListSubmissionsError extends ApiError {
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

    static readonly errors: ErrorDecoders<ListSubmissionsError> = [
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

  export type SubmitWorkRequest = {
    competitionId: string;
    /** Unique logical command key; use the same key and body for network retries. */
    idempotencyKey: string;
    body: SubmitWork;
  };

  export const submitWorkRequestSchema: Schema<SubmitWorkRequest> = s.lazySchema(() =>
    s.object<SubmitWorkRequest>({
      competitionId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
      idempotencyKey: s.string().check(s.pattern("^[A-Za-z0-9_-]{8,128}$")),
      body: submitWorkSchema,
    }),
  );

  export class SubmitWorkError extends ApiError {
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

    static readonly errors: ErrorDecoders<SubmitWorkError> = [
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
