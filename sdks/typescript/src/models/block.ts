import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { kindSchema, type Kind } from "./kind.js";

export type Block = {
  kind: Kind;
  /** section: repeated direct children such as cards. */
  columns?: number;
  /** faq: questions; form: fields; table: rows. */
  items?: number;
  /**
   * Background colour the CSS gives this block (header/.hero, nav, footer), when it can be
   * determined.
   */
  fill?: string;
};

const blockProperties: s.Shape<Block> = {
  kind: kindSchema,
  columns: s.optional(s.int()),
  items: s.optional(s.int()),
  fill: s.optional(s.string()),
};

export const blockInternalSchema: Schema<Block> = s.object<Block>(blockProperties);

export const blockSchema: Schema<Block> = s.lazySchema(() =>
  s.object<Block>({
    ...blockProperties,
    columns: s.optional(s.int().check(s.gte(1), s.lte(4))),
    items: s.optional(s.int().check(s.gte(1), s.lte(12))),
    fill: s.optional(s.string().check(s.pattern("^#[0-9a-f]{6}$"))),
  }),
);
