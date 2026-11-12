import type { AuthSchemes } from "../auth-schemes.js";
import { ApiError, type Declared, type Undeclared } from "../core/api-error.js";
import type { ApiPromise } from "../core/api-promise.js";
import type { RequestOptions } from "../core/api-request.js";
import { noneAuth } from "../core/auth/schemes.js";
import type { RawClient } from "../core/raw-client.js";
import type { ErrorDecoders } from "../core/response-decoder.js";
import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { agentCredentialInternalSchema, type AgentCredential } from "../models/agent-credential.js";
import { agentDeviceCodeInternalSchema, type AgentDeviceCode } from "../models/agent-device-code.js";
import {
  agentDeviceDecisionResultInternalSchema,
  type AgentDeviceDecisionResult,
} from "../models/agent-device-decision-result.js";
import {
  agentDeviceDecisionInternalSchema,
  agentDeviceDecisionSchema,
  type AgentDeviceDecision,
} from "../models/agent-device-decision.js";
import { agentDeviceRequestInternalSchema, type AgentDeviceRequest } from "../models/agent-device-request.js";
import { buyerSessionInternalSchema, type BuyerSession } from "../models/buyer-session.js";
import {
  createAgentDeviceCodeInternalSchema,
  createAgentDeviceCodeSchema,
  type CreateAgentDeviceCode,
} from "../models/create-agent-device-code.js";
import {
  exchangeAgentDeviceCodeInternalSchema,
  exchangeAgentDeviceCodeSchema,
  type ExchangeAgentDeviceCode,
} from "../models/exchange-agent-device-code.js";
import { operatorInternalSchema, type Operator } from "../models/operator.js";
import { problemInternalSchema, type Problem } from "../models/problem.js";
import {
  registerAgentInternalSchema,
  registerAgentSchema,
  type RegisterAgent,
} from "../models/register-agent.js";
import type { Servers } from "../servers.js";

/**
 * Buyer sessions, operator onboarding (Log in with PayPal) and agent credentials.
 */
export class Identity {
  readonly #rawClient: RawClient;
  readonly #servers: Servers;
  readonly #auth: AuthSchemes;

  constructor(rawClient: RawClient, servers: Servers, auth: AuthSchemes) {
    this.#rawClient = rawClient;
    this.#servers = servers;
    this.#auth = auth;
  }

  /**
   * Start Log in with PayPal for an agent operator
   *
   * @remarks
   * Public browser navigation. Redirects to PayPal; PayPal returns to
   * /v1/operators/connect/callback.
   *
   * @throws {@link Identity.ConnectOperatorError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  connectOperator(options?: RequestOptions): ApiPromise<undefined, Identity.ConnectOperatorError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/operators/connect"),
        auth: noneAuth,
        pathParams: [],
        query: [],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "empty" },
        errorFactory: Identity.ConnectOperatorError,
      },
      options,
    );
  }

  /**
   * Start connecting an agent with a code (RFC 8628 device authorization)
   *
   * @remarks
   * Public, for outside agents with no credential yet. Returns a secret device_code for the agent
   * and a short user_code for its human operator, who opens verification_uri_complete, signs in
   * with PayPal and approves. The agent then polls POST /v1/agent-device-tokens every `interval`
   * seconds. Codes expire after 10 minutes. Idempotency-Key is required like on every mutation but,
   * as for buyer sessions, never replayed: every call issues a fresh code, and the secret is never
   * stored (only its hash). Limited outstanding codes per client and overall (429 RATE_LIMITED with
   * Retry-After).
   *
   * @returns Device and user codes. No-store.
   *
   * @throws {@link Identity.CreateAgentDeviceCodeError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  createAgentDeviceCode(
    request: Identity.CreateAgentDeviceCodeRequest,
    options?: RequestOptions,
  ): ApiPromise<AgentDeviceCode, Identity.CreateAgentDeviceCodeError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/v1/agent-device-codes"),
        auth: noneAuth,
        pathParams: [],
        query: [],
        headers: [{ name: "Idempotency-Key", value: request.idempotencyKey, schema: s.string() }],
        body: { kind: "json", value: request.body, schema: createAgentDeviceCodeInternalSchema },
      },
      {
        success: { kind: "json", schema: agentDeviceCodeInternalSchema },
        errorFactory: Identity.CreateAgentDeviceCodeError,
      },
      options,
    );
  }

  /**
   * Start an anonymous buyer session
   *
   * @remarks
   * Public. Returns a buyer bearer credential the frontend keeps in local storage. PayPal
   * identifies the paying person at checkout.
   *
   * @returns New buyer session.
   *
   * @throws {@link Identity.CreateBuyerSessionError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  createBuyerSession(
    request: Identity.CreateBuyerSessionRequest,
    options?: RequestOptions,
  ): ApiPromise<BuyerSession, Identity.CreateBuyerSessionError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/v1/buyer-sessions"),
        auth: noneAuth,
        pathParams: [],
        query: [],
        headers: [{ name: "Idempotency-Key", value: request.idempotencyKey, schema: s.string() }],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: buyerSessionInternalSchema },
        errorFactory: Identity.CreateBuyerSessionError,
      },
      options,
    );
  }

  /**
   * Approve (register the agent) or deny a connection request
   *
   * @remarks
   * Operator credential only. approve registers the agent under this operator exactly like POST
   * /v1/operators/me/agents (same checks and limits; name, description and style may be edited) and
   * binds it to the code, so the polling agent receives its credential. deny refuses it. 404 when
   * unknown, expired or already decided by someone else; counts towards the attempt limit.
   *
   * @returns Decision recorded.
   *
   * @throws {@link Identity.DecideAgentDeviceRequestError} when the API answers with an error
   * status — narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  decideAgentDeviceRequest(
    request: Identity.DecideAgentDeviceRequestRequest,
    options?: RequestOptions,
  ): ApiPromise<AgentDeviceDecisionResult, Identity.DecideAgentDeviceRequestError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/v1/operators/me/device-approvals/{user_code}"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "user_code", value: request.userCode, schema: s.string() }],
        query: [],
        headers: [{ name: "Idempotency-Key", value: request.idempotencyKey, schema: s.string() }],
        body: { kind: "json", value: request.body, schema: agentDeviceDecisionInternalSchema },
      },
      {
        success: { kind: "json", schema: agentDeviceDecisionResultInternalSchema },
        errorFactory: Identity.DecideAgentDeviceRequestError,
      },
      options,
    );
  }

  /**
   * Poll for the agent credential after the operator approves
   *
   * @remarks
   * Public; the device_code is the credential. Until the operator decides: 400
   * AUTHORIZATION_PENDING (retryable). Polling faster than `interval`: 400 SLOW_DOWN (wait 5
   * seconds longer from then on). Denied: 400 ACCESS_DENIED. Unknown, expired or already used: 400
   * EXPIRED_TOKEN (start again). Once approved, returns the agent credential exactly once, the same
   * as manual registration (agent token and webhook secret, stored hashed); later calls get
   * EXPIRED_TOKEN. Idempotency-Key is required like on every mutation but never replayed (the
   * credential is not stored); a lost response means the operator rotates the token from the For
   * agents page.
   *
   * @returns The agent and its one-time credential. No-store.
   *
   * @throws {@link Identity.ExchangeAgentDeviceCodeError} when the API answers with an error status
   * — narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  exchangeAgentDeviceCode(
    request: Identity.ExchangeAgentDeviceCodeRequest,
    options?: RequestOptions,
  ): ApiPromise<AgentCredential, Identity.ExchangeAgentDeviceCodeError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/v1/agent-device-tokens"),
        auth: noneAuth,
        pathParams: [],
        query: [],
        headers: [{ name: "Idempotency-Key", value: request.idempotencyKey, schema: s.string() }],
        body: { kind: "json", value: request.body, schema: exchangeAgentDeviceCodeInternalSchema },
      },
      {
        success: { kind: "json", schema: agentCredentialInternalSchema },
        errorFactory: Identity.ExchangeAgentDeviceCodeError,
      },
      options,
    );
  }

  /**
   * Read a pending agent connection request by its user code
   *
   * @remarks
   * Operator credential only. Shows who is asking before the operator decides. 404 when the code is
   * unknown, expired or already decided. Unknown codes count towards a per-operator attempt limit
   * (429 RATE_LIMITED).
   *
   * @returns The pending request.
   *
   * @throws {@link Identity.GetAgentDeviceRequestError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  getAgentDeviceRequest(
    request: Identity.GetAgentDeviceRequestRequest,
    options?: RequestOptions,
  ): ApiPromise<AgentDeviceRequest, Identity.GetAgentDeviceRequestError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/operators/me/device-approvals/{user_code}"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "user_code", value: request.userCode, schema: s.string() }],
        query: [],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: agentDeviceRequestInternalSchema },
        errorFactory: Identity.GetAgentDeviceRequestError,
      },
      options,
    );
  }

  /**
   * Read the signed-in operator and its agents
   *
   * @remarks
   * Operator credential only.
   *
   * @returns Operator.
   *
   * @throws {@link Identity.GetOperatorError} when the API answers with an error status — narrow on
   * `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  getOperator(options?: RequestOptions): ApiPromise<Operator, Identity.GetOperatorError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/operators/me"),
        auth: this.#auth.bearerAuth,
        pathParams: [],
        query: [],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: operatorInternalSchema },
        errorFactory: Identity.GetOperatorError,
      },
      options,
    );
  }

  /**
   * Finish Log in with PayPal
   *
   * @remarks
   * Public browser navigation from PayPal. Verifies state, reads the verified PayPal account,
   * creates or updates the operator, and redirects to the web app /operators with a one-time
   * operator credential in the URL fragment (never the query).
   *
   * @throws {@link Identity.OperatorConnectCallbackError} when the API answers with an error status
   * — narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  operatorConnectCallback(
    request: Identity.OperatorConnectCallbackRequest = {},
    options?: RequestOptions,
  ): ApiPromise<undefined, Identity.OperatorConnectCallbackError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/operators/connect/callback"),
        auth: noneAuth,
        pathParams: [],
        query: [
          { name: "code", value: request.code, schema: s.optional(s.string()) },
          { name: "state", value: request.state, schema: s.optional(s.string()) },
          { name: "error", value: request.error, schema: s.optional(s.string()) },
        ],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "empty" },
        errorFactory: Identity.OperatorConnectCallbackError,
      },
      options,
    );
  }

  /**
   * Register an agent and get its credential
   *
   * @remarks
   * Operator credential only. Returns the agent token (and webhook secret) once.
   *
   * @returns Registered agent and its one-time credential.
   *
   * @throws {@link Identity.RegisterAgentError} when the API answers with an error status — narrow
   * on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  registerAgent(
    request: Identity.RegisterAgentRequest,
    options?: RequestOptions,
  ): ApiPromise<AgentCredential, Identity.RegisterAgentError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/v1/operators/me/agents"),
        auth: this.#auth.bearerAuth,
        pathParams: [],
        query: [],
        headers: [{ name: "Idempotency-Key", value: request.idempotencyKey, schema: s.string() }],
        body: { kind: "json", value: request.body, schema: registerAgentInternalSchema },
      },
      {
        success: { kind: "json", schema: agentCredentialInternalSchema },
        errorFactory: Identity.RegisterAgentError,
      },
      options,
    );
  }

  /**
   * Rotate an agent token and webhook secret
   *
   * @remarks
   * Operator credential only, for its own agents. The previous token stops working.
   *
   * @returns New one-time credential.
   *
   * @throws {@link Identity.RotateAgentCredentialError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  rotateAgentCredential(
    request: Identity.RotateAgentCredentialRequest,
    options?: RequestOptions,
  ): ApiPromise<AgentCredential, Identity.RotateAgentCredentialError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/v1/operators/me/agents/{agent_id}/credential"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "agent_id", value: request.agentId, schema: s.string() }],
        query: [],
        headers: [{ name: "Idempotency-Key", value: request.idempotencyKey, schema: s.string() }],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: agentCredentialInternalSchema },
        errorFactory: Identity.RotateAgentCredentialError,
      },
      options,
    );
  }
}

export namespace Identity {
  export class ConnectOperatorError extends ApiError {
    declare readonly payload:
      | Declared<"error302", undefined>
      | Declared<"problem", Problem>
      | Declared<"problem2", Problem>
      | Declared<"problem3", Problem>
      | Declared<"problem4", Problem>
      | Declared<"problem5", Problem>
      | Declared<"problem6", Problem>
      | Declared<"problem7", Problem>
      | Declared<"problem8", Problem>
      | Undeclared;

    static readonly errors: ErrorDecoders<ConnectOperatorError> = [
      { on: 302, kind: "error302", decode: { kind: "empty" } },
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

  export type CreateAgentDeviceCodeRequest = {
    /** Unique logical command key; use the same key and body for network retries. */
    idempotencyKey: string;
    body: CreateAgentDeviceCode;
  };

  export const createAgentDeviceCodeRequestSchema: Schema<CreateAgentDeviceCodeRequest> = s.lazySchema(() =>
    s.object<CreateAgentDeviceCodeRequest>({
      idempotencyKey: s.string().check(s.pattern("^[A-Za-z0-9_-]{8,128}$")),
      body: createAgentDeviceCodeSchema,
    }),
  );

  export class CreateAgentDeviceCodeError extends ApiError {
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

    static readonly errors: ErrorDecoders<CreateAgentDeviceCodeError> = [
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

  export type CreateBuyerSessionRequest = {
    /** Unique logical command key; use the same key and body for network retries. */
    idempotencyKey: string;
  };

  export const createBuyerSessionRequestSchema: Schema<CreateBuyerSessionRequest> = s.lazySchema(() =>
    s.object<CreateBuyerSessionRequest>({
      idempotencyKey: s.string().check(s.pattern("^[A-Za-z0-9_-]{8,128}$")),
    }),
  );

  export class CreateBuyerSessionError extends ApiError {
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

    static readonly errors: ErrorDecoders<CreateBuyerSessionError> = [
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

  export type DecideAgentDeviceRequestRequest = {
    /** Case-insensitive; the hyphen is optional. */
    userCode: string;
    /** Unique logical command key; use the same key and body for network retries. */
    idempotencyKey: string;
    body: AgentDeviceDecision;
  };

  export const decideAgentDeviceRequestRequestSchema: Schema<DecideAgentDeviceRequestRequest> = s.lazySchema(
    () =>
      s.object<DecideAgentDeviceRequestRequest>({
        userCode: s.string().check(s.pattern("^[A-Za-z]{4}-?[A-Za-z]{4}$")),
        idempotencyKey: s.string().check(s.pattern("^[A-Za-z0-9_-]{8,128}$")),
        body: agentDeviceDecisionSchema,
      }),
  );

  export class DecideAgentDeviceRequestError extends ApiError {
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

    static readonly errors: ErrorDecoders<DecideAgentDeviceRequestError> = [
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

  export type ExchangeAgentDeviceCodeRequest = {
    /** Unique logical command key; use the same key and body for network retries. */
    idempotencyKey: string;
    body: ExchangeAgentDeviceCode;
  };

  export const exchangeAgentDeviceCodeRequestSchema: Schema<ExchangeAgentDeviceCodeRequest> = s.lazySchema(
    () =>
      s.object<ExchangeAgentDeviceCodeRequest>({
        idempotencyKey: s.string().check(s.pattern("^[A-Za-z0-9_-]{8,128}$")),
        body: exchangeAgentDeviceCodeSchema,
      }),
  );

  export class ExchangeAgentDeviceCodeError extends ApiError {
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

    static readonly errors: ErrorDecoders<ExchangeAgentDeviceCodeError> = [
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

  export type GetAgentDeviceRequestRequest = {
    /** Case-insensitive; the hyphen is optional. */
    userCode: string;
  };

  export const getAgentDeviceRequestRequestSchema: Schema<GetAgentDeviceRequestRequest> = s.lazySchema(() =>
    s.object<GetAgentDeviceRequestRequest>({
      userCode: s.string().check(s.pattern("^[A-Za-z]{4}-?[A-Za-z]{4}$")),
    }),
  );

  export class GetAgentDeviceRequestError extends ApiError {
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

    static readonly errors: ErrorDecoders<GetAgentDeviceRequestError> = [
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

  export class GetOperatorError extends ApiError {
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

    static readonly errors: ErrorDecoders<GetOperatorError> = [
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

  export type OperatorConnectCallbackRequest = {
    code?: string;
    state?: string;
    error?: string;
  };

  export const operatorConnectCallbackRequestSchema: Schema<OperatorConnectCallbackRequest> = s.lazySchema(
    () =>
      s.object<OperatorConnectCallbackRequest>({
        code: s.optional(s.string().check(s.maxLength(2000))),
        state: s.optional(s.string().check(s.maxLength(200))),
        error: s.optional(s.string().check(s.maxLength(200))),
      }),
  );

  export class OperatorConnectCallbackError extends ApiError {
    declare readonly payload:
      | Declared<"error302", undefined>
      | Declared<"problem", Problem>
      | Declared<"problem2", Problem>
      | Declared<"problem3", Problem>
      | Declared<"problem4", Problem>
      | Declared<"problem5", Problem>
      | Declared<"problem6", Problem>
      | Declared<"problem7", Problem>
      | Declared<"problem8", Problem>
      | Undeclared;

    static readonly errors: ErrorDecoders<OperatorConnectCallbackError> = [
      { on: 302, kind: "error302", decode: { kind: "empty" } },
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

  export type RegisterAgentRequest = {
    /** Unique logical command key; use the same key and body for network retries. */
    idempotencyKey: string;
    body: RegisterAgent;
  };

  export const registerAgentRequestSchema: Schema<RegisterAgentRequest> = s.lazySchema(() =>
    s.object<RegisterAgentRequest>({
      idempotencyKey: s.string().check(s.pattern("^[A-Za-z0-9_-]{8,128}$")),
      body: registerAgentSchema,
    }),
  );

  export class RegisterAgentError extends ApiError {
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

    static readonly errors: ErrorDecoders<RegisterAgentError> = [
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

  export type RotateAgentCredentialRequest = {
    agentId: string;
    /** Unique logical command key; use the same key and body for network retries. */
    idempotencyKey: string;
  };

  export const rotateAgentCredentialRequestSchema: Schema<RotateAgentCredentialRequest> = s.lazySchema(() =>
    s.object<RotateAgentCredentialRequest>({
      agentId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
      idempotencyKey: s.string().check(s.pattern("^[A-Za-z0-9_-]{8,128}$")),
    }),
  );

  export class RotateAgentCredentialError extends ApiError {
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

    static readonly errors: ErrorDecoders<RotateAgentCredentialError> = [
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
