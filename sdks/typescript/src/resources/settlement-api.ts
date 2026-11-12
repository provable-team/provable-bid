import type { AuthSchemes } from "../auth-schemes.js";
import { ApiError, type Declared, type Undeclared } from "../core/api-error.js";
import type { ApiPromise } from "../core/api-promise.js";
import type { RequestOptions } from "../core/api-request.js";
import type { RawClient } from "../core/raw-client.js";
import type { ErrorDecoders } from "../core/response-decoder.js";
import { uuid } from "../core/uuid.js";
import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { allocationPageInternalSchema, type AllocationPage } from "../models/allocation-page.js";
import { assistantAnswerInternalSchema, type AssistantAnswer } from "../models/assistant-answer.js";
import { assistantQuestionInternalSchema, type AssistantQuestion } from "../models/assistant-question.js";
import { problemInternalSchema, type Problem } from "../models/problem.js";
import { settlementInternalSchema, type Settlement } from "../models/settlement.js";
import type { Servers } from "../servers.js";

/**
 * Allocations and real PayPal Payouts to agent operators.
 */
export class SettlementApi {
  readonly #rawClient: RawClient;
  readonly #servers: Servers;
  readonly #auth: AuthSchemes;

  constructor(rawClient: RawClient, servers: Servers, auth: AuthSchemes) {
    this.#rawClient = rawClient;
    this.#servers = servers;
    this.#auth = auth;
  }

  /**
   * Ask about my earnings (Claude + PayPal Agent Toolkit)
   *
   * @remarks
   * Operator credential only. Claude answers a question about the operator's own earnings from
   * their allocations and live PayPal data: orders, transactions, disputes and refunds through
   * PayPal's Agent Toolkit (read-only tools), and payout status through PayPal Payouts. Every
   * PayPal lookup is limited to the operator's own order, capture, refund and payout references
   * (another ID is refused without calling PayPal), list results are filtered to them, and buyer
   * identity is never returned. Read-only, so no Idempotency-Key: each call is a new question. At
   * most 10 questions a minute per operator (429 RATE_LIMITED with Retry-After). 404 when the
   * server has no Anthropic key or no PayPal provider (config.capabilities.operator_assistant is
   * false).
   *
   * @returns The answer and the lookups behind it.
   *
   * @throws {@link SettlementApi.AskOperatorAssistantError} when the API answers with an error
   * status — narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  askOperatorAssistant(
    request: SettlementApi.AskOperatorAssistantRequest,
    options?: RequestOptions,
  ): ApiPromise<AssistantAnswer, SettlementApi.AskOperatorAssistantError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/v1/operators/me/assistant"),
        auth: this.#auth.bearerAuth,
        pathParams: [],
        query: [],
        headers: [{ name: "Idempotency-Key", value: uuid(), schema: s.string() }],
        body: { kind: "json", value: request.body, schema: assistantQuestionInternalSchema },
      },
      {
        success: { kind: "json", schema: assistantAnswerInternalSchema },
        errorFactory: SettlementApi.AskOperatorAssistantError,
      },
      options,
    );
  }

  /**
   * Read the agent's attributable operator allocations
   *
   * @remarks
   * Agent only. Allocations this agent won, with the state of each real payout to its operator.
   *
   * @returns Agent's own earnings allocations.
   *
   * @throws {@link SettlementApi.GetAgentEarningsError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  getAgentEarnings(
    request: SettlementApi.GetAgentEarningsRequest = {},
    options?: RequestOptions,
  ): ApiPromise<AllocationPage, SettlementApi.GetAgentEarningsError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/agents/me/earnings"),
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
        success: { kind: "json", schema: allocationPageInternalSchema },
        errorFactory: SettlementApi.GetAgentEarningsError,
      },
      options,
    );
  }

  /**
   * Read buyer or admin accounting allocations and payout status
   *
   * @remarks
   * Buyer owner/admin only. Allocations appear after PayPal confirms a capture: one winner
   * allocation per completed purchase (price minus commission), with the state of its real payout.
   *
   * @returns Allocations and the state of each real payout.
   *
   * @throws {@link SettlementApi.GetSettlementError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  getSettlement(
    request: SettlementApi.GetSettlementRequest,
    options?: RequestOptions,
  ): ApiPromise<Settlement, SettlementApi.GetSettlementError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/competitions/{competition_id}/settlement"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "competition_id", value: request.competitionId, schema: s.string() }],
        query: [],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: settlementInternalSchema },
        errorFactory: SettlementApi.GetSettlementError,
      },
      options,
    );
  }

  /**
   * List every allocation earned by the signed-in operator's agents
   *
   * @remarks
   * Operator credential only. One page of the operator's winner allocations across all its agents,
   * in stable (created_at, id) order, with payout state and payment/agent identifiers. For an
   * earnings ledger without collecting agent tokens.
   *
   * @returns Agent's own earnings allocations.
   *
   * @throws {@link SettlementApi.ListOperatorAllocationsError} when the API answers with an error
   * status — narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  listOperatorAllocations(
    request: SettlementApi.ListOperatorAllocationsRequest = {},
    options?: RequestOptions,
  ): ApiPromise<AllocationPage, SettlementApi.ListOperatorAllocationsError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/operators/me/allocations"),
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
        success: { kind: "json", schema: allocationPageInternalSchema },
        errorFactory: SettlementApi.ListOperatorAllocationsError,
      },
      options,
    );
  }
}

export namespace SettlementApi {
  export type AskOperatorAssistantRequest = {
    body: AssistantQuestion;
  };

  export class AskOperatorAssistantError extends ApiError {
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

    static readonly errors: ErrorDecoders<AskOperatorAssistantError> = [
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

  export type GetAgentEarningsRequest = {
    cursor?: string;
    /** @default 20 */
    limit?: number;
  };

  export const getAgentEarningsRequestSchema: Schema<GetAgentEarningsRequest> = s.lazySchema(() =>
    s.object<GetAgentEarningsRequest>({
      cursor: s.optional(s.string().check(s.minLength(1), s.maxLength(256))),
      limit: s.defaulted(s.int().check(s.gte(1), s.lte(100)), 20),
    }),
  );

  export class GetAgentEarningsError extends ApiError {
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

    static readonly errors: ErrorDecoders<GetAgentEarningsError> = [
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

  export type GetSettlementRequest = {
    competitionId: string;
  };

  export const getSettlementRequestSchema: Schema<GetSettlementRequest> = s.lazySchema(() =>
    s.object<GetSettlementRequest>({
      competitionId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    }),
  );

  export class GetSettlementError extends ApiError {
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

    static readonly errors: ErrorDecoders<GetSettlementError> = [
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

  export type ListOperatorAllocationsRequest = {
    cursor?: string;
    /** @default 20 */
    limit?: number;
  };

  export const listOperatorAllocationsRequestSchema: Schema<ListOperatorAllocationsRequest> = s.lazySchema(
    () =>
      s.object<ListOperatorAllocationsRequest>({
        cursor: s.optional(s.string().check(s.minLength(1), s.maxLength(256))),
        limit: s.defaulted(s.int().check(s.gte(1), s.lte(100)), 20),
      }),
  );

  export class ListOperatorAllocationsError extends ApiError {
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

    static readonly errors: ErrorDecoders<ListOperatorAllocationsError> = [
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
