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
import type { Servers } from "../servers.js";

/**
 * The operator dashboard's AI assistant (AG Studio Agent Framework), relayed to Claude.
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
}

export namespace Studio {
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
}
