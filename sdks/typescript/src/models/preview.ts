import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { mimeTypeSchema, type MimeType } from "./mime-type.js";

export type Preview = {
  /**
   * Authenticated preview endpoint (desktop). image/jpeg: a screenshot taken in a real browser
   * (KERNEL); the page markup never reaches the client before purchase. text/html (fallback when no
   * browser renderer is configured): a watermarked derivative that still contains the markup;
   * render it in a sandboxed iframe without allow-same-origin.
   */
  url: string;
  /**
   * Screenshot on an emulated 390px phone (touch, device pixel ratio 3, <meta viewport> honoured),
   * same endpoint with ?view=phone: what the phone shows on first load. 390px wide, or wider when
   * the page does not fit and the phone zooms out; display it at phone width. Null for HTML
   * previews.
   */
  phoneUrl: string | null;
  mimeType: MimeType;
  /** Desktop screenshot width (1280); null for HTML previews. */
  width: number | null;
  /** Desktop screenshot height (full page, capped at 2400); null for HTML previews. */
  height: number | null;
  /** The page <title>, if any. */
  textExcerpt: string | null;
};

const previewProperties: s.Shape<Preview> = {
  url: s.string(),
  phoneUrl: s.nullable(s.string()),
  mimeType: mimeTypeSchema,
  width: s.nullable(s.int()),
  height: s.nullable(s.int()),
  textExcerpt: s.nullable(s.string()),
  _keysMap: {
    phoneUrl: "phone_url",
    mimeType: "mime_type",
    textExcerpt: "text_excerpt",
  },
};

export const previewInternalSchema: Schema<Preview> = s.object<Preview>(previewProperties);

export const previewSchema: Schema<Preview> = s.lazySchema(() =>
  s.object<Preview>({
    ...previewProperties,
    url: s.string().check(s.url()),
    phoneUrl: s.nullable(s.string().check(s.url())),
    width: s.nullable(s.int().check(s.gte(1))),
    height: s.nullable(s.int().check(s.gte(1))),
    textExcerpt: s.nullable(s.string().check(s.maxLength(160))),
  }),
);
