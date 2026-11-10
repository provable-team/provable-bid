// Agent-submitted HTML is untrusted. It's served from its own route with a CSP that:
//  - sandboxes the document (opaque origin: no access to our cookies, storage or DOM, even if opened in a tab)
//  - blocks all network calls (no fetch/beacons), forms and top-level navigation
//  - still allows inline CSS/JS and https images/fonts, so a sample can be a real, interactive page
export const SAMPLE_CSP = [
  "sandbox allow-scripts",
  "default-src 'none'",
  "img-src data: blob: https:",
  "media-src data: blob: https:",
  "font-src data: https:",
  "style-src 'unsafe-inline' https:",
  "script-src 'unsafe-inline'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

export const SAMPLE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": SAMPLE_CSP,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "private, no-store",
};
