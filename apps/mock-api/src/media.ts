import sharp from 'sharp';
import { createHash } from 'node:crypto';
import type { components } from '../../../packages/api-client/src/schema.js';

type S = components['schemas'];
export interface PrivateAsset {
  metadata: S['Asset'];
  original: Buffer;
  preview: Buffer;
}

/** Fixture implementation of the small-asset ingest boundary; no URL fetching. */
export async function prepareAsset(input: S['UploadAsset']): Promise<{
  original: Buffer; preview: Buffer; width: number | null; height: number | null;
  previewWidth: number | null; previewHeight: number | null; excerpt: string | null; sha256: string;
}> {
  const original = Buffer.from(input.content_base64, 'base64');
  if (original.length === 0 || original.length > 2_097_152 || original.toString('base64') !== input.content_base64) throw new Error('Asset must be canonical base64, 1 byte to 2 MiB.');
  const sha256 = createHash('sha256').update(original).digest('hex');
  if (input.type === 'text') {
    if (input.mime_type !== 'text/plain') throw new Error('Text assets require text/plain.');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(original);
    const characters = Array.from(text);
    if (!text.trim() || characters.length < 1 || characters.length > 20000 || text.includes('\0')) throw new Error('Text must be valid UTF-8, 1..20000 characters, without NUL.');
    const excerpt = characters.slice(0, Math.min(160, Math.floor(characters.length / 10))).join('');
    return { original, preview: Buffer.from(excerpt), width: null, height: null, previewWidth: null, previewHeight: null, excerpt, sha256 };
  }
  const formats: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp' };
  const format = formats[input.mime_type];
  if (!format) throw new Error('Images require PNG, JPEG, or WebP; SVG/HTML/video are not supported.');
  const image = sharp(original, { limitInputPixels: 16_000_000, failOn: 'warning' });
  const meta = await image.metadata();
  if (meta.format !== format || !meta.width || !meta.height || meta.width > 4096 || meta.height > 4096 || (meta.pages ?? 1) !== 1) throw new Error('Image format/dimensions/frame count do not meet the contract.');
  // Re-encoding strips metadata. Only a constant platform SVG is rendered; never user SVG.
  const small = await image.rotate().resize({ width: 320, height: 200, fit: 'inside', withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
  const width = small.info.width;
  const watermark = Buffer.from(`<svg width="${width}" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#161b22"/><text x="5" y="16" font-family="sans-serif" font-size="10" fill="white">PREVIEW · provable.bid</text></svg>`);
  const preview = await sharp(small.data).extend({ bottom: 24, top: 0, left: 0, right: 0, background: '#161b22' })
    .composite([{ input: watermark, gravity: 'south' }]).png().toBuffer();
  return { original, preview, width: meta.width, height: meta.height, previewWidth: width, previewHeight: small.info.height + 24, excerpt: null, sha256 };
}
