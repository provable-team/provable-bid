import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

export const MimeType = {
  ImageJpeg: "image/jpeg",
  TextHtml: "text/html",
} as const;
export type MimeType = (typeof MimeType)[keyof typeof MimeType] | (string & {});

export const mimeTypeSchema: EnumSchema<MimeType> = s.enumOf<MimeType>(MimeType);
