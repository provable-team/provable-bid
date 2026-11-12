import { createHash } from 'node:crypto';

export const MAX_HTML_BYTES = 524_288;

export interface PreparedHtml {
  original: Buffer;
  sha256: string;
  title: string | null;
  preview: Buffer;
}

/** Decode and fingerprint one submitted HTML document. Throws on anything that isn't canonical, UTF-8 HTML. */
export function prepareHtml(contentBase64: string): PreparedHtml {
  const original = Buffer.from(contentBase64, 'base64');
  if (original.length === 0 || original.length > MAX_HTML_BYTES || original.toString('base64') !== contentBase64) {
    throw new Error('HTML must be canonical base64, 1 byte to 512 KiB.');
  }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(original);
  if (text.includes('\0') || !/<html[\s>]/i.test(text) || !/<body[\s>]/i.test(text)) throw new Error('Not an HTML document with <html> and <body>.');
  return { original, sha256: createHash('sha256').update(original).digest('hex'), title: titleOf(text), preview: Buffer.from(previewHtml(text), 'utf8') };
}

export function titleOf(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const t = m?.[1].replace(/\s+/g, ' ').trim();
  return t ? decodeEntities(t).slice(0, 160) : null;
}

const decodeEntities = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

// No network, forms, frames or navigation; inline CSS/JS and data:/https: images and fonts still work.
export const PREVIEW_CSP = "default-src 'none'; img-src data: blob: https:; media-src data: blob: https:; font-src data: https:; style-src 'unsafe-inline' https:; script-src 'unsafe-inline'; form-action 'none'; base-uri 'none'; frame-src 'none'";

const WATERMARK = `<div aria-hidden="true" style="position:fixed;inset:0;pointer-events:none;z-index:2147483647;background-image:url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='160'%3E%3Ctext x='10' y='90' transform='rotate(-24 130 80)' font-family='sans-serif' font-size='16' fill='rgba(20,20,20,0.13)'%3EPREVIEW · provable.bid%3C/text%3E%3C/svg%3E&quot;)"></div>`;

/** The buyer-visible derivative: the same page with a strict CSP as the very first thing in <head> and a watermark. */
export function previewHtml(html: string): string {
  // A CSP meta tag only governs content after it, so it goes before anything the agent wrote:
  // right after the doctype (the parser hoists it into <head>). The iframe sandbox is the other layer.
  const meta = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`;
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  let out = doctype ? `${doctype[0]}${meta}${html.slice(doctype[0].length)}` : `<!doctype html>${meta}${html}`;
  out =/<\/body>/i.test(out) ? out.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${WATERMARK}</body>`) : `${out}${WATERMARK}`;
  return out;
}

/** Visible text, roughly: what a reader (or the fallback evaluator) sees. */
export function visibleText(html: string): string {
  return decodeEntities(html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/**
 * Objective gates that run before any requirement is judged. They map to QualificationResult.failure_code.
 * The preview CSP already blocks network access; these reject pages that depend on it or are empty.
 */
export function gateHtml(html: string): { code: 'invalid_output' | 'spam'; reason: string } | null {
  if (/<script[^>]+\bsrc\s*=\s*["']?(?!data:)/i.test(html)) return { code: 'invalid_output', reason: 'Loads external scripts; pages must be self-contained.' };
  if (/<(iframe|frame|object|embed)[\s>]/i.test(html)) return { code: 'invalid_output', reason: 'Embeds frames or plugins.' };
  if (/<form[^>]+\baction\s*=\s*["']?https?:/i.test(html)) return { code: 'invalid_output', reason: 'Submits a form to another site.' };
  if (/<meta[^>]+http-equiv\s*=\s*["']?refresh/i.test(html)) return { code: 'invalid_output', reason: 'Redirects with meta refresh.' };
  const text = visibleText(html);
  // Flyers and other fixed-format designs can be complete with very little copy.
  if (text.length < 20) return { code: 'invalid_output', reason: 'Has almost no visible content.' };
  const words = text.toLowerCase().split(/\s+/);
  if (words.length > 40 && new Set(words).size / words.length < 0.12) return { code: 'spam', reason: 'Repeats the same words over and over.' };
  return null;
}
