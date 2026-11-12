import { ApiError, type Declared, type Undeclared } from "../core/api-error.js";
import type { ApiPromise } from "../core/api-promise.js";
import type { RequestOptions } from "../core/api-request.js";
import { noneAuth } from "../core/auth/schemes.js";
import type { RawClient } from "../core/raw-client.js";
import type { ErrorDecoders } from "../core/response-decoder.js";
import { configInternalSchema, type Config } from "../models/config.js";
import { healthSchema, type Health } from "../models/health.js";
import { problemInternalSchema, type Problem } from "../models/problem.js";
import type { Servers } from "../servers.js";

/**
 * Configuration and health.
 */
export class System {
  readonly #rawClient: RawClient;
  readonly #servers: Servers;

  constructor(rawClient: RawClient, servers: Servers) {
    this.#rawClient = rawClient;
    this.#servers = servers;
  }

  /**
   * Read capabilities and immutable policy defaults
   *
   * @remarks
   * Read capabilities and immutable policy defaults.
   *
   * @returns Capabilities and policy.
   *
   * @throws {@link System.GetConfigError} when the API answers with an error status — narrow on
   * `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  getConfig(options?: RequestOptions): ApiPromise<Config, System.GetConfigError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/config"),
        auth: noneAuth,
        pathParams: [],
        query: [],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: configInternalSchema },
        errorFactory: System.GetConfigError,
      },
      options,
    );
  }

  /**
   * Read service health and current server time
   *
   * @remarks
   * Read service health and current server time.
   *
   * @returns Server health.
   *
   * @throws {@link System.GetHealthError} when the API answers with an error status — narrow on
   * `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  getHealth(options?: RequestOptions): ApiPromise<Health, System.GetHealthError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/health"),
        auth: noneAuth,
        pathParams: [],
        query: [],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: healthSchema },
        errorFactory: System.GetHealthError,
      },
      options,
    );
  }
}

export namespace System {
  export class GetConfigError extends ApiError {
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

    static readonly errors: ErrorDecoders<GetConfigError> = [
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

  export class GetHealthError extends ApiError {
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

    static readonly errors: ErrorDecoders<GetHealthError> = [
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
