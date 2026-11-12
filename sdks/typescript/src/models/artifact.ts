import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { previewInternalSchema, previewSchema, type Preview } from "./preview.js";

export type Artifact = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  assetId: string;
  /** @default "html" */
  type?: "html";
  /** @default "text/html" */
  mimeType?: "text/html";
  sizeBytes: number;
  sha256: string;
  width: string | null;
  height: string | null;
  preview: Preview;
};

const artifactProperties: s.Shape<Artifact> = {
  assetId: s.string(),
  type: s.defaulted(s.literal("html"), "html"),
  mimeType: s.defaulted(s.literal("text/html"), "text/html"),
  sizeBytes: s.int(),
  sha256: s.string(),
  width: s.nullable(s.string()),
  height: s.nullable(s.string()),
  preview: previewInternalSchema,
  _keysMap: {
    assetId: "asset_id",
    mimeType: "mime_type",
    sizeBytes: "size_bytes",
  },
};

export const artifactInternalSchema: Schema<Artifact> = s.object<Artifact>(artifactProperties);

export const artifactSchema: Schema<Artifact> = s.lazySchema(() =>
  s.object<Artifact>({
    ...artifactProperties,
    assetId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    sizeBytes: s.int().check(s.gte(1), s.lte(524288)),
    sha256: s.string().check(s.pattern("^[a-f0-9]{64}$")),
    preview: previewSchema,
  }),
);
