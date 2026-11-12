import type { AuthSchemes } from "../auth-schemes.js";
import { ApiError, type Declared, type Undeclared } from "../core/api-error.js";
import type { ApiPromise } from "../core/api-promise.js";
import type { RequestOptions } from "../core/api-request.js";
import type { RawClient } from "../core/raw-client.js";
import type { ErrorDecoders } from "../core/response-decoder.js";
import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { problemInternalSchema, type Problem } from "../models/problem.js";
import {
  studioAiTurnRequestInternalSchema,
  studioAiTurnRequestSchema,
  type StudioAiTurnRequest,
} from "../models/studio-ai-turn-request.js";
import { studioAiTurnInternalSchema, type StudioAiTurn } from "../models/studio-ai-turn.js";
import {
  studioDashboardSaveInternalSchema,
  studioDashboardSaveSchema,
  type StudioDashboardSave,
} from "../models/studio-dashboard-save.js";
import {
  studioDashboardSavedInternalSchema,
  type StudioDashboardSaved,
} from "../models/studio-dashboard-saved.js";
import { studioDashboardInternalSchema, type StudioDashboard } from "../models/studio-dashboard.js";
import type { Servers } from "../servers.js";

/**
 * The operator dashboard: its saved AG Studio layout, and its AI assistant (AG Studio Agent
 * Framework) relayed to Claude.
 */
export class Studio {
  readonly #rawClient: RawClient;
  readonly #servers: Servers;
  readonly #auth: AuthSchemes;

  constructor(rawClient: RawClient, servers: Servers, auth: AuthSchemes) {
    this.#rawClient = rawClient;
    this.#servers = servers;
    this.#auth = auth;
  }

  /**
   * Read the operator's saved dashboard layout
   *
   * @remarks
   * Operator credential only. The AG Studio dashboard state this operator last saved, with its
   * version. When nothing is saved, 200 with state null and version 0 (the page then shows the
   * default layout).
   *
   * @returns The saved dashboard, or state null.
   *
   * @throws {@link Studio.GetStudioDashboardError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  getStudioDashboard(options?: RequestOptions): ApiPromise<StudioDashboard, Studio.GetStudioDashboardError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/operators/me/studio-dashboard"),
        auth: this.#auth.bearerAuth,
        pathParams: [],
        query: [],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: studioDashboardInternalSchema },
        errorFactory: Studio.GetStudioDashboardError,
      },
      options,
    );
  }

  /**
   * Answer one turn of the operator dashboard's AI assistant
   *
   * @remarks
   * Operator credential only; requires config.capabilities.studio_ai. Answers one model turn for AG
   * Studio's Agent Framework running in the operator's browser: the agent loop and its tools run in
   * the page, which resends the conversation with tool results for the next turn. The model is
   * fixed server-side (Claude Haiku 5.5) and each turn is capped in output tokens. Rate-limited per
   * operator (RATE_LIMITED, 429). Send a fresh Idempotency-Key per turn: a retry with the same key
   * and body replays the answered turn instead of asking the model again.
   *
   * @returns The model's turn.
   *
   * @throws {@link Studio.RunStudioAiTurnError} when the API answers with an error status — narrow
   * on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  runStudioAiTurn(
    request: Studio.RunStudioAiTurnRequest,
    options?: RequestOptions,
  ): ApiPromise<StudioAiTurn, Studio.RunStudioAiTurnError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/v1/operators/me/studio-ai/turns"),
        auth: this.#auth.bearerAuth,
        pathParams: [],
        query: [],
        headers: [{ name: "Idempotency-Key", value: request.idempotencyKey, schema: s.string() }],
        body: { kind: "json", value: request.body, schema: studioAiTurnRequestInternalSchema },
      },
      {
        success: { kind: "json", schema: studioAiTurnInternalSchema },
        errorFactory: Studio.RunStudioAiTurnError,
      },
      options,
    );
  }

  /**
   * Save the operator's dashboard layout
   *
   * @remarks
   * Operator credential only. Replaces the saved AG Studio dashboard state (layout, widgets,
   * format; never data rows). version must equal the stored version (0 for the first save), else
   * 409 INVALID_STATE: reload and save again. State larger than 200,000 bytes as JSON: 413
   * PAYLOAD_TOO_LARGE. Requires an Idempotency-Key: retrying the latest save with the same key and
   * body returns its result again; the same key with a different body is 409 IDEMPOTENCY_CONFLICT.
   *
   * @returns Saved.
   *
   * @throws {@link Studio.SaveStudioDashboardError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  saveStudioDashboard(
    request: Studio.SaveStudioDashboardRequest,
    options?: RequestOptions,
  ): ApiPromise<StudioDashboardSaved, Studio.SaveStudioDashboardError> {
    return this.#rawClient.execute(
      {
        method: "PUT",
        urlTemplate: this.#servers.default("/v1/operators/me/studio-dashboard"),
        auth: this.#auth.bearerAuth,
        pathParams: [],
        query: [],
        headers: [{ name: "Idempotency-Key", value: request.idempotencyKey, schema: s.string() }],
        body: { kind: "json", value: request.body, schema: studioDashboardSaveInternalSchema },
      },
      {
        success: { kind: "json", schema: studioDashboardSavedInternalSchema },
        errorFactory: Studio.SaveStudioDashboardError,
      },
      options,
    );
  }
}

export namespace Studio {
  export class GetStudioDashboardError extends ApiError {
    declare readonly payload:
      | Declared<"problem", Problem>
      | Declared<"problem2", Problem>
      | Declared<"problem3", Problem>
      | Declared<"problem4", Problem>
      | Declared<"problem5", Problem>
      | Declared<"problem6", Problem>
      | Declared<"problem7", Problem>
      | Declared<"problem8", Problem>
      | Undeclared;

    static readonly errors: ErrorDecoders<GetStudioDashboardError> = [
      { on: 400, kind: "problem", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 401, kind: "problem2", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 403, kind: "problem3", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 404, kind: "problem4", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 409, kind: "problem5", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 422, kind: "problem6", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 429, kind: "problem7", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 503, kind: "problem8", decode: { kind: "json", schema: problemInternalSchema } },
    ];
  }

  export type RunStudioAiTurnRequest = {
    /** Unique logical command key; use the same key and body for network retries. */
    idempotencyKey: string;
    body: StudioAiTurnRequest;
  };

  export const runStudioAiTurnRequestSchema: Schema<RunStudioAiTurnRequest> = s.lazySchema(() =>
    s.object<RunStudioAiTurnRequest>({
      idempotencyKey: s.string().check(s.pattern("^[A-Za-z0-9_-]{8,128}$")),
      body: studioAiTurnRequestSchema,
    }),
  );

  export class RunStudioAiTurnError extends ApiError {
    declare readonly payload:
      | Declared<"problem", Problem>
      | Declared<"problem2", Problem>
      | Declared<"problem3", Problem>
      | Declared<"problem4", Problem>
      | Declared<"problem5", Problem>
      | Declared<"problem6", Problem>
      | Declared<"problem7", Problem>
      | Declared<"problem8", Problem>
      | Undeclared;

    static readonly errors: ErrorDecoders<RunStudioAiTurnError> = [
      { on: 400, kind: "problem", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 401, kind: "problem2", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 403, kind: "problem3", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 404, kind: "problem4", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 409, kind: "problem5", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 422, kind: "problem6", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 429, kind: "problem7", decode: { kind: "json", schema: problemInternalSchema } },
      { on: 503, kind: "problem8", decode: { kind: "json", schema: problemInternalSchema } },
    ];
  }

  export type SaveStudioDashboardRequest = {
    /** Unique logical command key; use the same key and body for network retries. */
    idempotencyKey: string;
    body: StudioDashboardSave;
  };

  export const saveStudioDashboardRequestSchema: Schema<SaveStudioDashboardRequest> = s.lazySchema(() =>
    s.object<SaveStudioDashboardRequest>({
      idempotencyKey: s.string().check(s.pattern("^[A-Za-z0-9_-]{8,128}$")),
      body: studioDashboardSaveSchema,
    }),
  );

  export class SaveStudioDashboardError extends ApiError {
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

    static readonly errors: ErrorDecoders<SaveStudioDashboardError> = [
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
