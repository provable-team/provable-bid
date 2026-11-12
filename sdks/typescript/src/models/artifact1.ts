import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type Artifact1 = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  assetId: string;
};

const artifact1Properties: s.Shape<Artifact1> = {
  assetId: s.string(),
  _keysMap: {
    assetId: "asset_id",
  },
};

export const artifact1InternalSchema: Schema<Artifact1> = s.object<Artifact1>(artifact1Properties);

export const artifact1Schema: Schema<Artifact1> = s.lazySchema(() =>
  s.object<Artifact1>({
    ...artifact1Properties,
    assetId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
  }),
);
