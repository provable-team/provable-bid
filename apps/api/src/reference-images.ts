import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { ReferencePhoto } from '../../../packages/agent-interface/src/index.js';
import type { components } from '../../../packages/api-client/src/schema.js';

/**
 * Buyer reference photos on a brief (e.g. the merchant's own photo of a drink for a cafe flyer). The original bytes are
 * kept exactly as uploaded; agents and the judge also get one server-made JPEG derivative that is small enough to
 * embed in a self-contained HTML page. Pure functions only: storage and access rules live in app.ts.
 */
export const REFERENCE_LIMITS = {
  /** Decoded bytes of one original. */
  maxBytes: 5 * 1024 * 1024,
  /** Decoded pixels per side of one original. */
  maxSide: 4096,
  /** Reference photos per brief. */
  maxPerBrief: 3,
} as const;

/** The derivative recipe. Change the label whenever any parameter changes: it is part of the recorded provenance. */
export const DERIVATIVE = { recipe: 'jpeg-q82-max1200-v1', maxSide: 1200, quality: 82, mime: 'image/jpeg' } as const;

export type ReferenceMime = 'image/png' | 'image/jpeg' | 'image/webp';

/** The image type by its magic bytes, or null when it is not a PNG, JPEG or WebP file. */
export function sniffImage(bytes: Uint8Array): ReferenceMime | null {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** Why an upload was refused: `too_large` maps to 413, everything else to 400. */
export class ReferenceRejected extends Error {
  constructor(readonly kind: 'too_large' | 'invalid', message: string) { super(message); }
}

export type PreparedReference = {
  mime_type: ReferenceMime; size_bytes: number; sha256: string; width: number; height: number;
  derivative: { bytes: Buffer; sha256: string; size_bytes: number; width: number; height: number };
};

const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const SHARP_FORMAT: Record<ReferenceMime, string> = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp' };

/**
 * The deterministic derivative: EXIF orientation applied, transparency flattened onto white, long side at most 1200 px
 * (never enlarged), baseline JPEG at quality 82 with 4:2:0 chroma and no metadata. The same input bytes give the same
 * output bytes on the same sharp/libvips build (no timestamps, no metadata, single-threaded encode settings fixed).
 */
export async function makeDerivative(original: Uint8Array): Promise<{ bytes: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(original, { failOn: 'error', limitInputPixels: REFERENCE_LIMITS.maxSide ** 2, animated: false })
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize({ width: DERIVATIVE.maxSide, height: DERIVATIVE.maxSide, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: DERIVATIVE.quality, chromaSubsampling: '4:2:0', progressive: false, mozjpeg: false, optimiseCoding: true })
    .toBuffer({ resolveWithObject: true });
  return { bytes: data, width: info.width, height: info.height };
}

/**
 * Validate one uploaded original and make its derivative. Throws ReferenceRejected with a buyer-readable reason:
 * not canonical base64, over 5 MiB, not PNG/JPEG/WebP by its magic bytes, a declared type that differs from the bytes,
 * undecodable, or wider/taller than 4096 px.
 */
export async function prepareReference(contentBase64: string, declared: string): Promise<PreparedReference> {
  // Cheap checks first, before decoding anything: base64 of 5 MiB is at most 6,990,508 characters.
  if (contentBase64.length > Math.ceil(REFERENCE_LIMITS.maxBytes / 3) * 4) throw new ReferenceRejected('too_large', 'Reference images are limited to 5 MiB (5,242,880 bytes).');
  const original = Buffer.from(contentBase64, 'base64');
  if (!original.length || original.toString('base64') !== contentBase64) throw new ReferenceRejected('invalid', 'content_base64 must be canonical base64 of the image file.');
  if (original.length > REFERENCE_LIMITS.maxBytes) throw new ReferenceRejected('too_large', 'Reference images are limited to 5 MiB (5,242,880 bytes).');
  const mime = sniffImage(original);
  if (!mime) throw new ReferenceRejected('invalid', 'Only PNG, JPEG and WebP images are accepted (checked by the file\'s magic bytes).');
  if (mime !== declared) throw new ReferenceRejected('invalid', `The file is ${mime} but mime_type says ${declared}.`);
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try { meta = await sharp(original, { limitInputPixels: false }).metadata(); }
  catch { throw new ReferenceRejected('invalid', 'The image could not be decoded.'); }
  if (meta.format !== SHARP_FORMAT[mime] || !meta.width || !meta.height) throw new ReferenceRejected('invalid', 'The image could not be decoded.');
  if (meta.width > REFERENCE_LIMITS.maxSide || meta.height > REFERENCE_LIMITS.maxSide) {
    throw new ReferenceRejected('invalid', `The image is ${meta.width}x${meta.height} px; each side must be at most ${REFERENCE_LIMITS.maxSide} px.`);
  }
  let derivative;
  try { derivative = await makeDerivative(original); }
  catch { throw new ReferenceRejected('invalid', 'The image could not be decoded.'); }
  return {
    mime_type: mime, size_bytes: original.length, sha256: sha256(original), width: meta.width, height: meta.height,
    derivative: { ...derivative, sha256: sha256(derivative.bytes), size_bytes: derivative.bytes.length },
  };
}

/** What a builder or judge gets for one reference: its recorded identity plus the derivative JPEG. */
export type ReferenceForModel = ReferencePhoto;

/** A fetched derivative as a ReferencePhoto, after checking its bytes against the recorded sha256. */
export function referencePhoto(meta: components['schemas']['ReferenceImage'], jpeg: Uint8Array): ReferencePhoto {
  const digest = sha256(jpeg);
  if (digest !== meta.derivative.sha256) throw new Error(`reference ${meta.id}: derivative sha256 ${digest} does not match the recorded ${meta.derivative.sha256}`);
  return { id: meta.id, sha256: meta.sha256, derivative_sha256: digest, width: meta.derivative.width, height: meta.derivative.height,
    size_bytes: meta.derivative.size_bytes, caption: meta.caption, jpeg_base64: Buffer.from(jpeg).toString('base64') };
}

/** `provable-ref:<id>` in a house agent's page stands for the derivative's data: URL (replaced before submission). */
export const REF_TOKEN = 'provable-ref:';
const dataUrl = (r: ReferenceForModel) => `data:image/jpeg;base64,${r.jpeg_base64}`;

/** Replace each `provable-ref:<id>` with that reference's data: URL. Unknown IDs are reported, not replaced. */
export function embedReferences(html: string, refs: ReferenceForModel[]): { html: string; unknown: string[]; used: string[] } {
  const unknown = new Set<string>(); const used = new Set<string>();
  const out = html.replace(/provable-ref:([A-Za-z0-9_-]+)/g, (token, refId: string) => {
    const r = refs.find(x => x.id === refId);
    if (!r) { unknown.add(refId); return token; }
    used.add(refId);
    return dataUrl(r);
  });
  return { html: out, unknown: [...unknown], used: [...used] };
}
/** The inverse, so a revision prompt carries the short tokens instead of the embedded bytes. */
export function unembedReferences(html: string, refs: ReferenceForModel[]): string {
  let out = html;
  for (const r of refs) out = out.split(dataUrl(r)).join(`${REF_TOKEN}${r.id}`);
  return out;
}

/** Long data: URLs replaced by a short note, so a page's embedded images don't flood a model prompt with base64. */
export function elideDataUrls(html: string, keep = 2048): string {
  return html.replace(/data:([a-z0-9.+-]+\/[a-z0-9.+-]+)?(;[a-z0-9=._-]+)*;base64,([A-Za-z0-9+/=\s]+)/gi, (match, type: string | undefined, _p, payload: string) => {
    if (match.length <= keep) return match;
    const bytes = Buffer.from(payload.replace(/\s+/g, ''), 'base64');
    return `data:${type ?? 'application/octet-stream'};base64,[${bytes.length} bytes elided, sha256 ${sha256(bytes)}]`;
  });
}
