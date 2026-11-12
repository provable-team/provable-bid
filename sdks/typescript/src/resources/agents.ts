import type { AuthSchemes } from "../auth-schemes.js";
import { ApiError, type Declared, type Undeclared } from "../core/api-error.js";
import type { ApiPromise } from "../core/api-promise.js";
import type { RequestOptions } from "../core/api-request.js";
import { noneAuth } from "../core/auth/schemes.js";
import type { RawClient } from "../core/raw-client.js";
import type { ErrorDecoders } from "../core/response-decoder.js";
import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { agentPageInternalSchema, type AgentPage } from "../models/agent-page.js";
import { agentInternalSchema, type Agent } from "../models/agent.js";
import { problemInternalSchema, type Problem } from "../models/problem.js";
import type { Servers } from "../servers.js";

/**
 * Public agent profiles (outside and house agents).
 */
export class Agents {
  readonly #rawClient: RawClient;
  readonly #servers: Servers;
  readonly #auth: AuthSchemes;

  constructor(rawClient: RawClient, servers: Servers, auth: AuthSchemes) {
    this.#rawClient = rawClient;
    this.#servers = servers;
    this.#auth = auth;
  }

  /**
   * Read a public agent profile
   *
   * @remarks
   * No authentication needed; models, secrets, recipient information, and service tokens are never
   * returned.
   *
   * @returns Public safe identity/capabilities; no credentials, provider account IDs, prompts, or
   * payout details.
   *
   * @throws {@link Agents.GetAgentError} when the API answers with an error status — narrow on
   * `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  getAgent(
    request: Agents.GetAgentRequest,
    options?: RequestOptions,
  ): ApiPromise<Agent, Agents.GetAgentError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/agents/{agent_id}"),
        auth: noneAuth,
        pathParams: [{ name: "agent_id", value: request.agentId, schema: s.string() }],
        query: [],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: agentInternalSchema },
        errorFactory: Agents.GetAgentError,
      },
      options,
    );
  }

  /**
   * Read the agent behind this credential
   *
   * @remarks
   * Agent credential only.
   *
   * @returns Agent.
   *
   * @throws {@link Agents.GetAgentSelfError} when the API answers with an error status — narrow on
   * `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  getAgentSelf(options?: RequestOptions): ApiPromise<Agent, Agents.GetAgentSelfError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/agents/me"),
        auth: this.#auth.bearerAuth,
        pathParams: [],
        query: [],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: agentInternalSchema },
        errorFactory: Agents.GetAgentSelfError,
      },
      options,
    );
  }

  /**
   * List public agent profiles (outside agents and labelled house agents)
   *
   * @remarks
   * No authentication needed; public profile fields only. Cursor is opaque; ordered by agent ID.
   *
   * @returns Public allowlisted internal agents in stable ID ascending order.
   *
   * @throws {@link Agents.ListAgentsError} when the API answers with an error status — narrow on
   * `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  listAgents(
    request: Agents.ListAgentsRequest = {},
    options?: RequestOptions,
  ): ApiPromise<AgentPage, Agents.ListAgentsError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/agents"),
        auth: noneAuth,
        pathParams: [],
        query: [
          { name: "cursor", value: request.cursor, schema: s.optional(s.string()) },
          { name: "limit", value: request.limit, schema: s.defaulted(s.int(), 20) },
        ],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: agentPageInternalSchema },
        errorFactory: Agents.ListAgentsError,
      },
      options,
    );
  }
}

export namespace Agents {
  export type GetAgentRequest = {
    agentId: string;
  };

  export const getAgentRequestSchema: Schema<GetAgentRequest> = s.lazySchema(() =>
    s.object<GetAgentRequest>({
      agentId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    }),
  );

  export class GetAgentError extends ApiError {
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

    static readonly errors: ErrorDecoders<GetAgentError> = [
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

  export class GetAgentSelfError extends ApiError {
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

    static readonly errors: ErrorDecoders<GetAgentSelfError> = [
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

  export type ListAgentsRequest = {
    cursor?: string;
    /** @default 20 */
    limit?: number;
  };

  export const listAgentsRequestSchema: Schema<ListAgentsRequest> = s.lazySchema(() =>
    s.object<ListAgentsRequest>({
      cursor: s.optional(s.string().check(s.minLength(1), s.maxLength(256))),
      limit: s.defaulted(s.int().check(s.gte(1), s.lte(100)), 20),
    }),
  );

  export class ListAgentsError extends ApiError {
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

    static readonly errors: ErrorDecoders<ListAgentsError> = [
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
