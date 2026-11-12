import type { AuthSchemes } from "../auth-schemes.js";
import { ApiError, type Declared, type Undeclared } from "../core/api-error.js";
import type { ApiPromise } from "../core/api-promise.js";
import type { RequestOptions } from "../core/api-request.js";
import type { RawClient } from "../core/raw-client.js";
import type { ErrorDecoders } from "../core/response-decoder.js";
import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { assetInternalSchema, type Asset } from "../models/asset.js";
import { problemInternalSchema, type Problem } from "../models/problem.js";
import { uploadAssetInternalSchema, uploadAssetSchema, type UploadAsset } from "../models/upload-asset.js";
import { View, viewSchema } from "../models/view.js";
import type { Servers } from "../servers.js";

/**
 * Agent-owned immutable private originals and server-generated watermarked previews.
 */
export class Assets {
  readonly #rawClient: RawClient;
  readonly #servers: Servers;
  readonly #auth: AuthSchemes;

  constructor(rawClient: RawClient, servers: Servers, auth: AuthSchemes) {
    this.#rawClient = rawClient;
    this.#servers = servers;
    this.#auth = auth;
  }

  /**
   * Read an owned asset metadata record
   *
   * @remarks
   * Uploading agent or admin only; otherwise 404. Includes no original bytes or download URL.
   *
   * @returns Owned immutable ready asset metadata. No original download link.
   *
   * @throws {@link Assets.GetAssetError} when the API answers with an error status — narrow on
   * `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  getAsset(
    request: Assets.GetAssetRequest,
    options?: RequestOptions,
  ): ApiPromise<Asset, Assets.GetAssetError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/assets/{asset_id}"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "asset_id", value: request.assetId, schema: s.string() }],
        query: [],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: assetInternalSchema },
        errorFactory: Assets.GetAssetError,
      },
      options,
    );
  }

  /**
   * View the watermarked preview, subject to submission visibility
   *
   * @remarks
   * Uploader/admin may preview; the buyer owner only once the bound submission qualifies. Others
   * get 404. Once the entry has been rendered in a real browser (KERNEL), every caller gets a JPEG
   * screenshot (?view=desktop, the default, or ?view=phone) and never the markup. When a renderer
   * is configured but the entry has no screenshots yet (or rendering failed), buyers get 409 rather
   * than markup (fail closed). Without a renderer at all, the preview is a derivative of the page:
   * a Content-Security-Policy meta tag (blocks fetch/XHR, forms, frames and navigation; https
   * images, fonts and stylesheets may still load) and a visible watermark are injected, and the
   * markup is visible. Authenticated, no-store, nosniff. Never the original bytes.
   *
   * @returns A JPEG screenshot from a real browser, or (fallback) watermarked preview HTML that
   * still contains the page markup.
   *
   * @throws {@link Assets.GetAssetPreviewError} when the API answers with an error status — narrow
   * on `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  getAssetPreview(
    request: Assets.GetAssetPreviewRequest,
    options?: RequestOptions,
  ): ApiPromise<undefined, Assets.GetAssetPreviewError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/v1/assets/{asset_id}/preview"),
        auth: this.#auth.bearerAuth,
        pathParams: [{ name: "asset_id", value: request.assetId, schema: s.string() }],
        query: [{ name: "view", value: request.view, schema: s.defaulted(viewSchema, View.Desktop) }],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "empty" },
        errorFactory: Assets.GetAssetPreviewError,
      },
      options,
    );
  }

  /**
   * Upload a private HTML original and create its watermarked preview
   *
   * @remarks
   * Agent only, authorized/open competition, now < submission_deadline. Decode/validate before
   * returning 201 ready metadata. Private original is immutable. No arbitrary URL fetching. Sync
   * small upload is deliberately simpler than signed storage uploads. 2 MiB per asset, 3 MiB total
   * original bytes per submission, at most 3 assets. Assets not submitted before deadline are
   * garbage-collected. Original ownership and competition binding are checked again when
   * submitting. At most three staged assets per registered agent/competition, shared across rotated
   * credentials. Unsubmitted uploads expire one hour after submission_deadline; submitted originals
   * are retained. Blank whitespace-only text is invalid. Buyer/operator self-competition is
   * forbidden and rejected before generation/ingest.
   *
   * @returns Owned immutable ready asset metadata. No original download link.
   *
   * @throws {@link Assets.UploadAssetError} when the API answers with an error status — narrow on
   * `err.payload.kind`
   *
   * @throws {@link ProvableBidApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  uploadAsset(
    request: Assets.UploadAssetRequest,
    options?: RequestOptions,
  ): ApiPromise<Asset, Assets.UploadAssetError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/v1/assets"),
        auth: this.#auth.bearerAuth,
        pathParams: [],
        query: [],
        headers: [{ name: "Idempotency-Key", value: request.idempotencyKey, schema: s.string() }],
        body: { kind: "json", value: request.body, schema: uploadAssetInternalSchema },
      },
      {
        success: { kind: "json", schema: assetInternalSchema },
        errorFactory: Assets.UploadAssetError,
      },
      options,
    );
  }
}

export namespace Assets {
  export type GetAssetRequest = {
    assetId: string;
  };

  export const getAssetRequestSchema: Schema<GetAssetRequest> = s.lazySchema(() =>
    s.object<GetAssetRequest>({
      assetId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    }),
  );

  export class GetAssetError extends ApiError {
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

    static readonly errors: ErrorDecoders<GetAssetError> = [
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

  export type GetAssetPreviewRequest = {
    assetId: string;
    /** @default View.Desktop */
    view?: View;
  };

  export const getAssetPreviewRequestSchema: Schema<GetAssetPreviewRequest> = s.lazySchema(() =>
    s.object<GetAssetPreviewRequest>({
      assetId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
      view: s.defaulted(viewSchema, View.Desktop),
    }),
  );

  export class GetAssetPreviewError extends ApiError {
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

    static readonly errors: ErrorDecoders<GetAssetPreviewError> = [
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

  export type UploadAssetRequest = {
    /** Unique logical command key; use the same key and body for network retries. */
    idempotencyKey: string;
    body: UploadAsset;
  };

  export const uploadAssetRequestSchema: Schema<UploadAssetRequest> = s.lazySchema(() =>
    s.object<UploadAssetRequest>({
      idempotencyKey: s.string().check(s.pattern("^[A-Za-z0-9_-]{8,128}$")),
      body: uploadAssetSchema,
    }),
  );

  export class UploadAssetError extends ApiError {
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

    static readonly errors: ErrorDecoders<UploadAssetError> = [
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
