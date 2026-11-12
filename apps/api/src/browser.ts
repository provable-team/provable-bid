import Kernel from '@onkernel/sdk';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { chromium } from 'playwright-core';
import type { PrintMeasurement } from '../../../packages/agent-interface/src/index.js';

export type { PrintMeasurement };

/** Keyboard focus as measured in a real browser: Tab through the page and check each stop for a visible indicator. */
export interface FocusMeasurement {
  tabStops: number;           // distinct elements reached with Tab (0 when nothing is focusable)
  visibleIndicators: number;  // of those, how many look different when focused (outline, shadow, border, background, underline, colour)
  /** true when Tab went through every focusable element (focus left the page or came back to the first); false at the 20-press cap. */
  complete: boolean;
  /** Tag names and booleans only: in the site navigation (nav/header), an FAQ/disclosure control (summary, details, aria-expanded). */
  samples: { tag: string; visible: boolean; nav: boolean; faq: boolean }[];
}

/** How the page laid out on an emulated 390px phone (touch, device pixel ratio 3, <meta viewport> honoured, overlay scrollbars). */
export interface PhoneLayout {
  /** Layout viewport width in CSS px: 390 when the page sets a phone viewport; wider (980 without a viewport meta tag) means the phone zooms out. */
  layoutWidth: number;
  /** Widest content in CSS px (document scrollWidth). */
  contentWidth: number;
  /** Initial zoom the phone applies to fit the page (1 = not zoomed out). */
  scale: number;
}

/** What a real browser saw when it loaded a submitted page. */
export interface RenderResult {
  desktop: Buffer;            // JPEG, 1280px wide, full page up to MAX_HEIGHT
  /** JPEG of what the phone shows on first load: 390px wide, or the wider zoomed-out layout (display it at phone width). */
  phone: Buffer;
  desktopHeight: number;      // pixel height of the desktop screenshot
  phoneHeight: number;
  /** CSS px the page is wider than a 390px phone: content that scrolls sideways, or a layout the phone has to zoom out. 0 fits. */
  phoneOverflowPx: number;
  phoneLayout?: PhoneLayout;
  consoleErrors: string[];
  blockedRequests: string[];  // fetch/XHR/scripts/frames to other sites, blocked while rendering
  focus?: FocusMeasurement;
  /** Print media, only for pages with print CSS (@page / @media print); `{ checked: false }` otherwise. */
  print?: PrintMeasurement;
  /** Navigation start to the load event (HTML, images, fonts) in the desktop pass, ms. */
  loadMs?: number;
  /** The whole check (browser start to last measurement), ms. */
  renderMs?: number;
  /** Video replay of the check (KERNEL_REPLAYS=1 only): kept by KERNEL for retentionMs after recording. */
  replay?: { id: string; url: string; retentionMs: number };
}

const MAX_TABS = 20;

// Runs in the page. Kept as source text: bundlers that rename or wrap functions must not touch browser-side code.
const FOCUS_PROBE = `(() => {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  window.__pbSeen = window.__pbSeen || new Set();
  if (window.__pbSeen.has(el)) return { repeat: true, tag: '', visible: false, nav: false, faq: false };
  window.__pbSeen.add(el);
  const look = function () {
    const c = getComputedStyle(el);
    const outline = c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0 ? c.outlineStyle + ' ' + c.outlineWidth + ' ' + c.outlineColor : 'none';
    return [outline, c.boxShadow, c.borderColor, c.backgroundColor, c.textDecorationLine, c.color].join('|');
  };
  const focused = look();
  el.blur();
  const plain = look();
  el.focus({ preventScroll: true }); // keyboard modality is kept, so :focus-visible still applies
  const nav = !!el.closest('nav, header');
  const faq = el.tagName === 'SUMMARY' || !!el.closest('details') || el.hasAttribute('aria-expanded');
  return { repeat: false, tag: el.tagName.toLowerCase(), visible: focused !== plain, nav: nav, faq: faq };
})()`;

/**
 * Presses Tab up to 20 times. For each focused element, compares its computed outline, box-shadow, border colour,
 * background colour, text decoration and colour while focused with the same element unfocused (transitions off, so
 * nothing is caught mid-animation). Stops when focus leaves the page or comes back to an element already seen.
 */
export async function measureFocus(page: Page): Promise<FocusMeasurement> {
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
  await page.evaluate('document.activeElement && document.activeElement.blur && document.activeElement.blur(); window.scrollTo(0, 0);');
  const samples: FocusMeasurement['samples'] = [];
  let complete = false;
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(FOCUS_PROBE) as { repeat: boolean; tag: string; visible: boolean; nav: boolean; faq: boolean } | null;
    if (!r || r.repeat) { complete = true; break; }
    samples.push({ tag: r.tag.slice(0, 20), visible: !!r.visible, nav: !!r.nav, faq: !!r.faq });
  }
  return { tabStops: samples.length, visibleIndicators: samples.filter(x => x.visible).length, complete, samples };
}

// ---------------------------------------------------------------- print

/** Cheap test on the markup: no print CSS anywhere in it means no print pass (and no extra browser context). */
export const mayHavePrintCss = (html: string) => /@page\b|@media[^{]*\bprint\b|\bmedia\s*=\s*["']?[^"'>]*\bprint\b/i.test(html);

/** Named @page sizes (CSS Paged Media), portrait, mm. */
const PAGE_SIZES: Record<string, [number, number]> = {
  a5: [148, 210], a4: [210, 297], a3: [297, 420], b5: [176, 250], b4: [250, 353], 'jis-b5': [182, 257], 'jis-b4': [257, 364],
  letter: [215.9, 279.4], legal: [215.9, 355.6], ledger: [279.4, 431.8],
};
const UNIT_MM: Record<string, number> = { mm: 1, cm: 10, q: 0.25, in: 25.4, pt: 25.4 / 72, pc: 25.4 / 6, px: 25.4 / 96 };
const round1 = (n: number) => Math.round(n * 10) / 10;

/** The `size` of an @page rule in mm (width, height), or null for auto/unknown. */
export function parsePageSize(size: string | null | undefined): [number, number] | null {
  const words = (size ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length || words[0] === 'auto') return null;
  const lengths: number[] = [];
  let named: [number, number] | null = null;
  let orientation: 'portrait' | 'landscape' | null = null;
  for (const w of words) {
    if (w === 'portrait' || w === 'landscape') { orientation = w; continue; }
    if (PAGE_SIZES[w]) { named = PAGE_SIZES[w]; continue; }
    const m = /^(\d*\.?\d+)(mm|cm|q|in|pt|pc|px)$/.exec(w);
    if (!m) return null;
    lengths.push(Number(m[1]) * UNIT_MM[m[2]]);
  }
  let wh: [number, number] | null = lengths.length === 2 ? [lengths[0], lengths[1]] : lengths.length === 1 ? [lengths[0], lengths[0]] : named ?? (orientation ? PAGE_SIZES.a4 : null);
  if (!wh) return null;
  if (orientation && !lengths.length) wh = orientation === 'landscape' ? [Math.max(...wh), Math.min(...wh)] : [Math.min(...wh), Math.max(...wh)];
  return [round1(wh[0]), round1(wh[1])];
}

// Runs in the page. Whether it has print CSS (an @page rule, @media print, a print-only stylesheet), and the last @page size.
const PRINT_CSS_PROBE = `(() => {
  let print = false, size = null;
  const walk = (rules) => {
    for (const r of rules) {
      if (r.type === 6) { print = true; const s = r.style && r.style.getPropertyValue('size'); if (s && !r.selectorText) size = s.trim(); else if (s && size === null) size = s.trim(); }
      else if (r.type === 4) { if (/\\bprint\\b/i.test(r.media.mediaText)) print = true; walk(r.cssRules); }
      else if (r.type === 3) { if (r.media && /\\bprint\\b/i.test(r.media.mediaText)) print = true; try { if (r.styleSheet) walk(r.styleSheet.cssRules); } catch (e) {} }
      else if (r.cssRules) { try { walk(r.cssRules); } catch (e) {} }
    }
  };
  for (const sheet of document.styleSheets) {
    if (sheet.media && /\\bprint\\b/i.test(sheet.media.mediaText)) print = true;
    try { walk(sheet.cssRules); } catch (e) {} // a cross-origin stylesheet (web fonts) cannot be read
  }
  return { print, size };
})()`;

/**
 * Runs in the page with print media emulated and the viewport at the page size. For every run of visible text: cut off
 * by an ancestor that clips (overflow not visible), crossing a drawn frame (an empty bordered box) it overlaps, within
 * 3 mm of the edge of the page-sized box holding it (or past it), and its font size. Also fixed-size clipping boxes
 * whose content is bigger than the box, and the page-sized boxes themselves (outermost only: one per printed page).
 * The preview watermark (a fixed overlay at the top z-index) is ignored.
 */
const PRINT_SCAN = `(({ pageW, pageH }) => {
  const MM = 96 / 25.4;
  const hint = el => { if (!el) return ''; const c = typeof el.className === 'string' ? el.className.trim().split(/\\s+/)[0] : '';
    return (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (c ? '.' + c : '')).replace(/[^A-Za-z0-9#._-]/g, '').slice(0, 40); };
  const cs = el => getComputedStyle(el);
  const clips = el => { const s = cs(el); return s.overflowX !== 'visible' || s.overflowY !== 'visible'; };
  const bordered = el => { const s = cs(el); return ['Top', 'Right', 'Bottom', 'Left'].some(k => parseFloat(s['border' + k + 'Width']) > 0 && s['border' + k + 'Style'] !== 'none' && s['border' + k + 'Style'] !== 'hidden'); };
  const inner = el => { const r = el.getBoundingClientRect(), s = cs(el); return { left: r.left + parseFloat(s.borderLeftWidth), right: r.right - parseFloat(s.borderRightWidth), top: r.top + parseFloat(s.borderTopWidth), bottom: r.bottom - parseFloat(s.borderBottomWidth) }; };
  const beyond = (r, b) => Math.max(b.left - r.left, r.right - b.right, b.top - r.top, r.bottom - b.bottom);
  const overlaps = (r, b) => r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top;
  const overlay = el => { const s = cs(el); return s.position === 'fixed' && s.zIndex === '2147483647'; };
  const all = [...document.body.querySelectorAll('*')].filter(el => !el.closest('script,style,template,noscript') && !overlay(el));
  const shown = el => { const s = cs(el); return s.display !== 'none' && s.visibility !== 'hidden'; };
  const frames = all.filter(el => bordered(el) && !/\\S/.test(el.textContent || '') && el.getBoundingClientRect().width > 40 && el.getBoundingClientRect().height > 30);
  const sized = pageW ? [document.body, ...all].filter(el => { const r = el.getBoundingClientRect(); return Math.abs(r.width - pageW) < 3 && Math.abs(r.height - pageH) < 3; }) : [];
  const pageBoxes = sized.filter(el => !sized.some(o => o !== el && o.contains(el)));
  const clipped = [], frameHits = [], safe = [], small = [], seen = new Set();
  let minPx = null;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!/\\S/.test(n.data)) continue;
    const el = n.parentElement;
    if (!el || el.closest('script,style,template,noscript') || overlay(el)) continue;
    const st = cs(el);
    if (st.visibility === 'hidden' || parseFloat(st.opacity) === 0) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter(r => r.width > 0.5 && r.height > 0.5);
    if (!rects.length) continue;
    const text = n.data.trim().replace(/\\s+/g, ' ').slice(0, 60);
    const px = parseFloat(st.fontSize);
    if (minPx === null || px < minPx) minPx = px;
    if (px < 7 * 96 / 72 - 0.05) small.push({ hint: hint(el), text, pt: Math.round(px * 72 / 96 * 10) / 10 });
    const key = hint(el) + '|' + text;
    if (seen.has(key)) continue; seen.add(key);
    let done = { clip: false, frame: false, safe: false };
    for (const r of rects) {
      if (!done.clip) for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
        if (a !== document.body && clips(a)) { const d = beyond(r, inner(a)); if (d > 1) { clipped.push({ hint: hint(el), text, by: hint(a), px: Math.round(d) }); done.clip = true; break; } }
      }
      if (!done.frame) for (const f of frames) {
        if (f.contains(el) || el.contains(f)) continue;
        if (overlaps(r, f.getBoundingClientRect()) && beyond(r, inner(f)) > 1) { frameHits.push({ hint: hint(el), text, frame: hint(f) }); done.frame = true; break; }
      }
      if (!done.safe) for (const root of pageBoxes) {
        if (!root.contains(el)) continue;
        const b = root.getBoundingClientRect();
        const inset = Math.min(r.left - b.left, b.right - r.right, r.top - b.top, b.bottom - r.bottom) / MM;
        if (inset < 3) { safe.push({ hint: hint(el), text, mm: Math.round(inset * 10) / 10 }); done.safe = true; }
        break;
      }
    }
  }
  const boxes = [];
  for (const el of all) {
    if (!clips(el) || !shown(el) || !/\\S/.test(el.textContent || '')) continue;
    const s = cs(el);
    const dy = el.scrollHeight - el.clientHeight, dx = el.scrollWidth - el.clientWidth;
    const d = Math.max(s.overflowY !== 'visible' ? dy : 0, s.overflowX !== 'visible' ? dx : 0);
    if (d > 1) boxes.push({ hint: hint(el), px: d });
  }
  return { pageBoxes: pageBoxes.length, clipped: clipped.slice(0, 12), boxes: boxes.slice(0, 12), frames: frameHits.slice(0, 12), safe: safe.slice(0, 40), safeCount: safe.length, small: small.slice(0, 12), smallCount: small.length, minPt: minPx === null ? null : Math.round(minPx * 72 / 96 * 10) / 10 };
})`;
type PrintScan = {
  pageBoxes: number; clipped: { hint: string; text: string; by: string; px: number }[]; boxes: { hint: string; px: number }[];
  frames: { hint: string; text: string; frame: string }[]; safe: { hint: string; text: string; mm: number }[]; safeCount: number;
  small: { hint: string; text: string; pt: number }[]; smallCount: number; minPt: number | null;
};

/** Page text quoted in measurements: short, letters, digits and plain punctuation only (it comes from an untrusted page). */
const quote = (t: string) => `"${t.replace(/[^\p{L}\p{N} .,&@/:'+#-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40)}"`;

/** Page count and page size of a PDF from Chromium's print engine (Skia writes one uncompressed /Type /Page per page). */
export function pdfPages(pdf: Buffer): { pages: number; size_mm: [number, number] | null } {
  const text = pdf.toString('latin1');
  const pages = (text.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
  const box = /\/MediaBox\s*\[\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*\]/.exec(text);
  const mm = (pt: number) => round1(pt * 25.4 / 72);
  return { pages, size_mm: box ? [mm(Number(box[3]) - Number(box[1])), mm(Number(box[4]) - Number(box[2]))] : null };
}

export const PRINT_BUDGET_MS = 5_000;

/**
 * The print pass, on an already-loaded page: confirms print CSS from the document's stylesheets, then switches to
 * print media at the declared @page size, scans the layout (PRINT_SCAN) and prints to PDF (page.pdf with the CSS page
 * size; headless Chromium only) for the page count. Without print CSS: `{ checked: false }`, nothing else is done.
 */
export async function measurePrint(page: Page, deadline = Date.now() + PRINT_BUDGET_MS): Promise<PrintMeasurement> {
  const css = await page.evaluate(PRINT_CSS_PROBE) as { print: boolean; size: string | null };
  if (!css.print) return { checked: false };
  const size = parsePageSize(css.size);
  // The preview watermark (html.ts: a fixed overlay at the top z-index, last in <body>) is ours, not the entry's, and in
  // print it can push an extra page: measure the entry without it. This page is the print pass's own load.
  await page.evaluate(`for (const el of document.querySelectorAll('body > div[aria-hidden="true"]')) { const s = getComputedStyle(el); if (s.position === 'fixed' && s.zIndex === '2147483647') el.remove(); }`);
  const px = (mm: number) => Math.max(1, Math.round(mm * 96 / 25.4));
  await page.emulateMedia({ media: 'print' });
  if (size) await page.setViewportSize({ width: px(size[0]), height: px(size[1]) });
  const scan = await page.evaluate(`${PRINT_SCAN}(${JSON.stringify(size ? { pageW: px(size[0]), pageH: px(size[1]) } : { pageW: 0, pageH: 0 })})`) as PrintScan;
  let pages: number | null = null, printed: [number, number] | null = null, source: PrintMeasurement['pages_source'];
  // The PDF gets whatever is left of the budget (a big page over a remote CDP link can be slow): the layout scan above
  // is kept either way, and the page count falls back to the page-sized boxes.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const printing = page.pdf({ preferCSSPageSize: true, printBackground: false });
    printing.catch(() => {}); // a late rejection (the context closes) must not go unhandled
    const left = deadline - Date.now() - 250;
    const out = left > 0 ? await Promise.race([printing, new Promise<null>(r => { timer = setTimeout(() => r(null), left); })]) : null;
    const pdf = out ? pdfPages(out) : null;
    if (pdf && pdf.pages > 0) { pages = pdf.pages; printed = pdf.size_mm; source = 'pdf'; }
  } catch { /* printing to PDF needs headless Chromium: fall back to the page-sized boxes */ }
  finally { clearTimeout(timer); }
  if (pages === null && scan.pageBoxes > 0) { pages = scan.pageBoxes; source = 'page_boxes'; }

  const issues: string[] = [];
  const expected = scan.pageBoxes > 0 ? scan.pageBoxes : undefined;
  if (expected !== undefined && source === 'pdf' && pages !== expected) issues.push(`prints as ${pages} page(s), but the page draws ${expected} page-sized box(es), so ${expected} page(s) are expected`);
  if (size && printed && (Math.abs(printed[0] - size[0]) > 1 || Math.abs(printed[1] - size[1]) > 1)) issues.push(`prints at ${printed[0]} x ${printed[1]} mm, not the declared ${size[0]} x ${size[1]} mm`);
  for (const c of scan.clipped) issues.push(`text ${quote(c.text)} (${c.hint}) is cut off by ${c.by}: ${c.px}px of it is outside the box`);
  for (const b of scan.boxes) if (!scan.clipped.some(c => c.by === b.hint)) issues.push(`${b.hint} clips its content: the content is ${b.px}px bigger than the box`);
  for (const s of scan.safe.slice(0, 3)) issues.push(s.mm < 0 ? `text ${quote(s.text)} (${s.hint}) runs ${Math.abs(s.mm)} mm past the edge of the page` : `text ${quote(s.text)} (${s.hint}) is ${s.mm} mm from the page edge (inside the 3 mm safe area)`);
  if (scan.safeCount > 3) issues.push(`${scan.safeCount - 3} more text run(s) within 3 mm of the page edge`);
  for (const f of scan.frames.slice(0, 2)) issues.push(`text ${quote(f.text)} (${f.hint}) crosses the drawn frame ${f.frame}`);
  if (scan.smallCount) issues.push(`${scan.smallCount} text run(s) under 7 pt in print (smallest ${scan.minPt} pt, e.g. ${scan.small.slice(0, 2).map(x => `${quote(x.text)} at ${x.pt} pt`).join(', ')})`);
  const overflow = [
    ...scan.clipped.map(c => ({ selector_hint: c.hint, px: c.px, text: quote(c.text).slice(1, -1) })),
    ...scan.boxes.map(b => ({ selector_hint: b.hint, px: b.px })),
  ].slice(0, 10);
  return {
    checked: true, page_size_mm: size, pages, ...(source ? { pages_source: source } : {}), printed_size_mm: printed,
    ...(expected !== undefined ? { expected_pages: expected } : {}),
    overflow, safe_area_violations: scan.safeCount, min_font_pt: scan.minPt, issues: issues.slice(0, 10),
  };
}

/** measurePrint within PRINT_BUDGET_MS. Never rejects: a failure or timeout is `{ checked: false, error }`. */
export function boundedPrint(page: Page, budgetMs = PRINT_BUDGET_MS): Promise<PrintMeasurement> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const measured = measurePrint(page, Date.now() + budgetMs).catch((e: Error) => ({ checked: false, error: `print measurement failed: ${(e?.message ?? String(e)).split('\n')[0].slice(0, 160)}` }));
  const late = new Promise<PrintMeasurement>(resolve => { timer = setTimeout(() => resolve({ checked: false, error: `print measurement took over ${budgetMs} ms` }), budgetMs); });
  return Promise.race([measured, late]).finally(() => clearTimeout(timer));
}

export interface RenderOptions {
  signal?: AbortSignal;
  /** Labels for the browser session (KERNEL tags), e.g. competition and submission IDs. IDs only, never page content. */
  tags?: Record<string, string>;
}

export interface PageRenderer {
  readonly name: string;
  render(html: string, options?: RenderOptions): Promise<RenderResult>;
}

const MAX_HEIGHT = 2400;
export const PHONE_WIDTH = 390;
const DESKTOP = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } as const;
/**
 * A real phone, not a narrow desktop window: 390x844 CSS px (iPhone 12-16 size), device pixel ratio 3, touch, and
 * isMobile, so Chromium applies <meta viewport> (no tag: a 980px layout zoomed out to fit) and uses overlay scrollbars
 * (a 100vw element is exactly as wide as the screen). Chromium engine, so a Chrome-on-Android user agent.
 */
export const PHONE = {
  viewport: { width: PHONE_WIDTH, height: 844 }, screen: { width: PHONE_WIDTH, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
} as const;
/**
 * The entry is served at this address inside the browser; the request is answered from memory and never leaves it.
 * A real navigation is needed: setContent writes into about:blank, where Chromium ignores <meta viewport>.
 */
const PAGE_URL = 'https://entry.provable.invalid/';
const PAGE_ORIGIN = new URL(PAGE_URL).origin;

const LAYOUT_PROBE = `(() => {
  const d = document.documentElement, v = window.visualViewport;
  return { layout: d.clientWidth, content: d.scrollWidth, height: d.scrollHeight, visual: v ? v.width : d.clientWidth, scale: v ? v.scale : 1 };
})()`;
type Layout = { layout: number; content: number; height: number; visual: number; scale: number };

/** Opens the entry in a fresh page of `context`, with the network policy applied. Returns the page and its load time. */
async function openEntry(context: BrowserContext, html: string, note: (kind: 'console' | 'blocked', text: string) => void) {
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') note('console', m.text().slice(0, 300)); });
  page.on('pageerror', (e) => note('console', e.message.slice(0, 300)));
  await page.route('**/*', (route) => {
    const req = route.request();
    const url = req.url();
    if (url === PAGE_URL && req.isNavigationRequest() && req.frame() === page.mainFrame()) {
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    }
    if (url === `${PAGE_ORIGIN}/favicon.ico`) return route.abort(); // the browser's own request, not the page's
    if (url.startsWith('data:') || url.startsWith('blob:') || url === 'about:blank') return route.continue();
    if (url.startsWith('https://') && !url.startsWith(PAGE_ORIGIN) && ['image', 'font', 'stylesheet', 'media'].includes(req.resourceType())) return route.continue();
    note('blocked', `${req.resourceType()} ${url.slice(0, 200)}`);
    return route.abort();
  });
  const t0 = Date.now();
  await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 20_000 });
  const loadMs = Date.now() - t0;
  await page.waitForTimeout(300); // let inline scripts and web fonts settle
  return { page, loadMs };
}

/**
 * The checks, in any Chromium driven by Playwright (KERNEL in production, a local Chrome in tests). Three independent
 * loads run side by side (over a remote CDP connection each one is mostly waiting on round trips), or one after
 * another with `sequential` (for a legible replay video):
 * 1. Desktop, 1280x800 in its own context: full-page screenshot and page load time.
 * 2. Keyboard focus at desktop size, on its own load (the focus probe changes styles, so never on the screenshot page).
 * 3. Phone, in its own mobile context (see PHONE): layout width, sideways overflow with no scrollbar in the way, and
 *    a screenshot of what the phone shows on first load (390px wide, or the zoomed-out layout when the page is wider).
 * Network: https images, fonts and stylesheets may load (the page is meant to look real); anything else that leaves
 * the page (fetch/XHR, scripts, frames, navigation) is blocked and reported. Each message is recorded once.
 */
export async function renderInBrowser(browser: Browser, html: string, { sequential = false } = {}): Promise<RenderResult> {
  const consoleErrors: string[] = [];
  const blockedRequests: string[] = [];
  const note = (kind: 'console' | 'blocked', text: string) => {
    const list = kind === 'console' ? consoleErrors : blockedRequests;
    if (list.length < 20 && !list.includes(text)) list.push(text);
  };
  const contexts: BrowserContext[] = [];
  const context = async (options: typeof DESKTOP | typeof PHONE) => { const c = await browser.newContext(options); contexts.push(c); return c; };
  /** Runs a pass in its own context and closes it as soon as the pass is done (one window on screen at a time in a replay). */
  const pass = <T>(options: typeof DESKTOP | typeof PHONE, run: (page: Page, loadMs: number) => Promise<T>) => async () => {
    const c = await context(options);
    try {
      const { page, loadMs } = await openEntry(c, html, note);
      if (sequential) await page.bringToFront().catch(() => {}); // in front of the browser's start tab in the video
      return await run(page, loadMs);
    }
    finally { await c.close().catch(() => {}); }
  };

  const desktopPass = pass(DESKTOP, async (page, loadMs) => {
    const d = await page.evaluate(LAYOUT_PROBE) as Layout;
    const height = Math.max(DESKTOP.viewport.height, Math.min(d.height, MAX_HEIGHT));
    const jpeg = await page.screenshot({ type: 'jpeg', quality: 72, fullPage: true, clip: { x: 0, y: 0, width: DESKTOP.viewport.width, height } });
    return { jpeg, height, loadMs };
  });
  const focusPass = pass(DESKTOP, page => measureFocus(page).catch(() => undefined));
  const phonePass = pass(PHONE, async page => {
    const m = await page.evaluate(LAYOUT_PROBE) as Layout;
    const layout: PhoneLayout = { layoutWidth: Math.round(m.layout), contentWidth: Math.round(m.content), scale: Math.round(m.scale * 1000) / 1000 };
    // What the screen shows at first load: the visual viewport in CSS px (a 980px layout at 0.4 zoom is 980 wide).
    const width = Math.max(PHONE_WIDTH, Math.round(m.visual));
    const ratio = width / PHONE_WIDTH;
    const height = Math.max(Math.round(PHONE.viewport.height * ratio), Math.min(m.height, Math.round(MAX_HEIGHT * ratio)));
    const jpeg = await page.screenshot({ type: 'jpeg', quality: 72, fullPage: true, scale: 'css', clip: { x: 0, y: 0, width, height } });
    return { jpeg, height, layout };
  });

  // 4. Print, only when the markup has print CSS: its own load at desktop size, then print media (see measurePrint).
  //    Bounded and never fatal: a failure is recorded as `checked: false` and the render goes on.
  const printPass = async (): Promise<PrintMeasurement> => {
    if (!mayHavePrintCss(html)) return { checked: false };
    try { return await pass(DESKTOP, page => boundedPrint(page))(); }
    catch (e) { return { checked: false, error: `print measurement failed: ${((e as Error)?.message ?? String(e)).split('\n')[0].slice(0, 160)}` }; }
  };

  try {
    const [desktop, focus, phone, print] = sequential
      ? [await desktopPass(), await focusPass(), await phonePass(), await printPass()]
      : await Promise.all([desktopPass(), focusPass(), phonePass(), printPass()]);
    return {
      desktop: desktop.jpeg, phone: phone.jpeg, desktopHeight: desktop.height, phoneHeight: phone.height,
      phoneOverflowPx: Math.max(0, Math.max(phone.layout.layoutWidth, phone.layout.contentWidth) - PHONE_WIDTH),
      phoneLayout: phone.layout, consoleErrors, blockedRequests, focus, print, loadMs: desktop.loadMs,
    };
  } finally {
    await Promise.all(contexts.map(c => c.close().catch(() => {})));
  }
}

export interface KernelRendererOptions {
  /**
   * Record a video replay of every check (KERNEL_REPLAYS=1). Replays need a headful browser, which costs 8x a
   * headless one ($0.48/h vs $0.06/h at KERNEL's published rates); KERNEL keeps replays 1 day on the Developer plan.
   */
  replays?: boolean;
  /** How long to offer the replay link after recording (default 20 h, inside the Developer plan's 1-day retention). */
  replayRetentionHours?: number;
}

/**
 * KERNEL cloud browsers (sponsor tool): one short-lived Chromium per submission, driven over CDP. Sessions are tagged
 * (app plus the caller's IDs), creation takes the caller's abort signal, and the session is always deleted.
 */
export function kernelRenderer(apiKey: string, options: KernelRendererOptions = {}): PageRenderer {
  const kernel = new Kernel({ apiKey });
  const retentionMs = (options.replayRetentionHours ?? 20) * 3_600_000;
  /** Deletes active sessions carrying all these tags: used when creation was aborted before its ID came back. */
  const deleteTagged = async (tags: Record<string, string>) => {
    for await (const b of kernel.browsers.list({ tags, status: 'active' })) await kernel.browsers.deleteByID(b.session_id).catch(() => {});
  };
  return {
    name: 'kernel',
    async render(html, { signal, tags = {} } = {}) {
      signal?.throwIfAborted();
      const started = Date.now();
      const sessionTags = { app: 'provable-bid', ...tags };
      let session: Awaited<ReturnType<typeof kernel.browsers.create>>;
      try {
        session = await kernel.browsers.create({
          headless: !options.replays, timeout_seconds: 90, tags: sessionTags,
          ...(options.replays ? { start_replay: true, viewport: { width: 1280, height: 800 } } : {}),
        }, { signal });
      } catch (e) {
        // Aborted mid-request: KERNEL may have started the session anyway. Find it by its tags (the caller's IDs).
        if (signal?.aborted && Object.keys(tags).length) await deleteTagged(sessionTags).catch(() => {});
        throw e;
      }
      let browser: Browser | undefined;
      const abort = () => void browser?.close().catch(() => {});
      signal?.addEventListener('abort', abort, { once: true });
      try {
        // Inside try, so a failed connection still deletes the session instead of leaving it until its timeout.
        browser = await chromium.connectOverCDP(session.cdp_ws_url, { timeout: 20_000 });
        // With a replay recording, one pass at a time so the video shows each window in turn.
        const result = await renderInBrowser(browser, html, { sequential: !!options.replays });
        let replay: RenderResult['replay'];
        if (session.replay) {
          const id = session.replay.replay_id;
          // Stop before the session goes away so the video is finalized, then read its view URL.
          await kernel.browsers.replays.stop(id, { id_or_name: session.session_id }).catch(() => {});
          const listed = await kernel.browsers.replays.list(session.session_id).catch(() => []);
          const url = listed.find(r => r.replay_id === id)?.replay_view_url ?? session.replay.replay_view_url;
          if (url) replay = { id, url, retentionMs };
        }
        return { ...result, renderMs: Date.now() - started, replay };
      } finally {
        signal?.removeEventListener('abort', abort);
        await browser?.close().catch(() => {});
        await kernel.browsers.deleteByID(session.session_id).catch(() => {});
      }
    },
  };
}

