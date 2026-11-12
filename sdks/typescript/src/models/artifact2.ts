import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type Artifact2 = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  assetId: string;
  url: string;
  /** @default "text/html" */
  mimeType?: "text/html";
  sizeBytes: number;
};

const artifact2Properties: s.Shape<Artifact2> = {
  assetId: s.string(),
  url: s.string(),
  mimeType: s.defaulted(s.literal("text/html"), "text/html"),
  sizeBytes: s.int(),
  _keysMap: {
    assetId: "asset_id",
    mimeType: "mime_type",
    sizeBytes: "size_bytes",
  },
};

export const artifact2InternalSchema: Schema<Artifact2> = s.object<Artifact2>(artifact2Properties);

export const artifact2Schema: Schema<Artifact2> = s.lazySchema(() =>
  s.object<Artifact2>({
    ...artifact2Properties,
    assetId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    url: s.string().check(s.url()),
    sizeBytes: s.int().check(s.gte(1), s.lte(2097152)),
  }),
);
