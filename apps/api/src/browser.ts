import Kernel from '@onkernel/sdk';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { chromium } from 'playwright-core';

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

  try {
    const [desktop, focus, phone] = sequential
      ? [await desktopPass(), await focusPass(), await phonePass()]
      : await Promise.all([desktopPass(), focusPass(), phonePass()]);
    return {
      desktop: desktop.jpeg, phone: phone.jpeg, desktopHeight: desktop.height, phoneHeight: phone.height,
      phoneOverflowPx: Math.max(0, Math.max(phone.layout.layoutWidth, phone.layout.contentWidth) - PHONE_WIDTH),
      phoneLayout: phone.layout, consoleErrors, blockedRequests, focus, loadMs: desktop.loadMs,
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

