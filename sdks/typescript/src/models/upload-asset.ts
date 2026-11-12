import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type UploadAsset = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  competitionId: string;
  /** @default "html" */
  type?: "html";
  /** @default "text/html" */
  mimeType?: "text/html";
  /**
   * Canonical base64 of one UTF-8 HTML document, max 512 KiB decoded. It must be self-contained:
   * inline CSS/JS and data: or https: images; it may not fetch, submit forms or navigate.
   */
  contentBase64: string;
};

const uploadAssetProperties: s.Shape<UploadAsset> = {
  competitionId: s.string(),
  type: s.defaulted(s.literal("html"), "html"),
  mimeType: s.defaulted(s.literal("text/html"), "text/html"),
  contentBase64: s.string(),
  _keysMap: {
    competitionId: "competition_id",
    mimeType: "mime_type",
    contentBase64: "content_base64",
  },
};

export const uploadAssetInternalSchema: Schema<UploadAsset> = s.object<UploadAsset>(uploadAssetProperties);

export const uploadAssetSchema: Schema<UploadAsset> = s.lazySchema(() =>
  s.object<UploadAsset>({
    ...uploadAssetProperties,
    competitionId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    contentBase64: s
      .string()
      .check(
        s.minLength(4),
        s.maxLength(699052),
        s.pattern("^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$"),
      ),
  }),
);
