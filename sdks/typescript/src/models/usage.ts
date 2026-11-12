import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
};

const usageProperties: s.Shape<Usage> = {
  inputTokens: s.int(),
  outputTokens: s.int(),
  cachedInputTokens: s.optional(s.int()),
  cacheWriteTokens: s.optional(s.int()),
  _keysMap: {
    inputTokens: "input_tokens",
    outputTokens: "output_tokens",
    cachedInputTokens: "cached_input_tokens",
    cacheWriteTokens: "cache_write_tokens",
  },
};

export const usageInternalSchema: Schema<Usage> = s.object<Usage>(usageProperties);

export const usageSchema: Schema<Usage> = s.lazySchema(() =>
  s.object<Usage>({
    ...usageProperties,
    inputTokens: s.int().check(s.gte(0)),
    outputTokens: s.int().check(s.gte(0)),
    cachedInputTokens: s.optional(s.int().check(s.gte(0))),
    cacheWriteTokens: s.optional(s.int().check(s.gte(0))),
  }),
);
