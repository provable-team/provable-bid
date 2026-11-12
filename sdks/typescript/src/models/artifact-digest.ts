import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type ArtifactDigest = {
  /** Opaque ID; clients must not infer chronology or ownership from it. */
  assetId: string;
  sha256: string;
};

const artifactDigestProperties: s.Shape<ArtifactDigest> = {
  assetId: s.string(),
  sha256: s.string(),
  _keysMap: {
    assetId: "asset_id",
  },
};

export const artifactDigestInternalSchema: Schema<ArtifactDigest> =
  s.object<ArtifactDigest>(artifactDigestProperties);

export const artifactDigestSchema: Schema<ArtifactDigest> = s.lazySchema(() =>
  s.object<ArtifactDigest>({
    ...artifactDigestProperties,
    assetId: s.string().check(s.pattern("^[A-Za-z0-9_-]{3,128}$")),
    sha256: s.string().check(s.pattern("^[a-f0-9]{64}$")),
  }),
);
