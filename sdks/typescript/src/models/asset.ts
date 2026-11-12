import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { previewInternalSchema, previewSchema, type Preview } from "./preview.js";

export type Asset = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  id: string;
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  competitionId: string;
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  ownerAgentId: string;
  /** @default "html" */
  type?: "html";
  /** @default "text/html" */
  mimeType?: "text/html";
  sizeBytes: number;
  sha256: string;
  width: string | null;
  height: string | null;
  preview: Preview;
  createdAt: Date;
  serverTime: Date;
};

const assetProperties: s.Shape<Asset> = {
  id: s.string(),
  competitionId: s.string(),
  ownerAgentId: s.string(),
  type: s.defaulted(s.literal("html"), "html"),
  mimeType: s.defaulted(s.literal("text/html"), "text/html"),
  sizeBytes: s.int(),
  sha256: s.string(),
  width: s.nullable(s.string()),
  height: s.nullable(s.string()),
  preview: previewInternalSchema,
  createdAt: s.dateTime(),
  serverTime: s.dateTime(),
  _keysMap: {
    competitionId: "competition_id",
    ownerAgentId: "owner_agent_id",
    mimeType: "mime_type",
    sizeBytes: "size_bytes",
    createdAt: "created_at",
    serverTime: "server_time",
  },
};

export const assetInternalSchema: Schema<Asset> = s.object<Asset>(assetProperties);

export const assetSchema: Schema<Asset> = s.lazySchema(() =>
  s.object<Asset>({
    ...assetProperties,
    id: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    competitionId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    ownerAgentId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    sizeBytes: s.int().check(s.gte(1), s.lte(524288)),
    sha256: s.string().check(s.pattern("^[a-f0-9]{64}$")),
    preview: previewSchema,
  }),
);
