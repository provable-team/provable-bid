import Kernel from '@onkernel/sdk';
import { chromium, type Page } from 'playwright-core';

/** Keyboard focus as measured in a real browser: Tab through the page and check each stop for a visible indicator. */
export interface FocusMeasurement {
  tabStops: number;           // distinct elements reached with Tab (0 when nothing is focusable)
  visibleIndicators: number;  // of those, how many look different when focused (outline, shadow, border, background, underline, colour)
  samples: { tag: string; visible: boolean }[]; // tag names and booleans only
}

/** What a real browser saw when it loaded a submitted page. */
export interface RenderResult {
  desktop: Buffer;            // JPEG, 1280px wide, full page up to MAX_HEIGHT
  phone: Buffer;              // JPEG, 390px wide, full page up to MAX_HEIGHT
  desktopHeight: number;      // pixel height of the desktop screenshot
  phoneHeight: number;
  phoneOverflowPx: number;    // horizontal scroll at 390px; > 0 means it doesn't fit a phone
  consoleErrors: string[];
  blockedRequests: string[];  // fetch/XHR/scripts/frames to other sites, blocked while rendering
  focus?: FocusMeasurement;
}

const MAX_TABS = 20;

// Runs in the page. Kept as source text: bundlers that rename or wrap functions must not touch browser-side code.
const FOCUS_PROBE = `(() => {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  window.__pbSeen = window.__pbSeen || new Set();
  if (window.__pbSeen.has(el)) return { repeat: true, tag: '', visible: false };
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
  return { repeat: false, tag: el.tagName.toLowerCase(), visible: focused !== plain };
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
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(FOCUS_PROBE) as { repeat: boolean; tag: string; visible: boolean } | null;
    if (!r || r.repeat) break;
    samples.push({ tag: r.tag.slice(0, 20), visible: r.visible });
  }
  return { tabStops: samples.length, visibleIndicators: samples.filter(x => x.visible).length, samples };
}

export interface PageRenderer {
  readonly name: string;
  render(html: string, signal?: AbortSignal): Promise<RenderResult>;
}

const MAX_HEIGHT = 2400;
const VIEWPORTS = [['desktop', 1280, 800], ['phone', 390, 844]] as const;

/**
 * KERNEL cloud browsers (sponsor tool): one short-lived headless Chromium per submission, driven over CDP.
 * Network: https images, fonts and stylesheets may load (the page is meant to look real); anything else that
 * leaves the page (fetch/XHR, scripts, frames, navigation) is blocked and reported.
 */
export function kernelRenderer(apiKey: string): PageRenderer {
  const kernel = new Kernel({ apiKey });
  return {
    name: 'kernel',
    async render(html, signal) {
      const session = await kernel.browsers.create({ headless: true, timeout_seconds: 90 });
      const browser = await chromium.connectOverCDP(session.cdp_ws_url, { timeout: 20_000 });
      const abort = () => void browser.close().catch(() => {});
      signal?.addEventListener('abort', abort, { once: true });
      try {
        const context = browser.contexts()[0] ?? await browser.newContext();
        const page = await context.newPage();
        const consoleErrors: string[] = [];
        const blockedRequests: string[] = [];
        page.on('console', (m) => { if (m.type() === 'error' && consoleErrors.length < 20) consoleErrors.push(m.text().slice(0, 300)); });
        page.on('pageerror', (e) => { if (consoleErrors.length < 20) consoleErrors.push(e.message.slice(0, 300)); });
        await page.route('**/*', (route) => {
          const req = route.request();
          const url = req.url();
          if (url.startsWith('data:') || url.startsWith('blob:') || url === 'about:blank') return route.continue();
          if (url.startsWith('https://') && ['image', 'font', 'stylesheet', 'media'].includes(req.resourceType())) return route.continue();
          if (blockedRequests.length < 20) blockedRequests.push(`${req.resourceType()} ${url.slice(0, 200)}`);
          return route.abort();
        });
        const shots: Record<string, { jpeg: Buffer; height: number; overflow: number }> = {};
        for (const [name, width, height] of VIEWPORTS) {
          await page.setViewportSize({ width, height });
          await page.setContent(html, { waitUntil: 'load', timeout: 20_000 });
          await page.waitForTimeout(300); // let inline scripts and web fonts settle
          const size = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, over: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
          const h = Math.max(height, Math.min(size.h, MAX_HEIGHT));
          const jpeg = await page.screenshot({ type: 'jpeg', quality: 72, fullPage: true, clip: { x: 0, y: 0, width, height: h } });
          shots[name] = { jpeg, height: h, overflow: size.over };
        }
        // Keyboard focus, measured at desktop size on a fresh load.
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.setContent(html, { waitUntil: 'load', timeout: 20_000 });
        const focus = await measureFocus(page).catch(() => ({ tabStops: 0, visibleIndicators: 0, samples: [] }));
        return {
          desktop: shots.desktop.jpeg, phone: shots.phone.jpeg, desktopHeight: shots.desktop.height, phoneHeight: shots.phone.height,
          phoneOverflowPx: Math.max(0, shots.phone.overflow), consoleErrors, blockedRequests, focus,
        };
      } finally {
        signal?.removeEventListener('abort', abort);
        await browser.close().catch(() => {});
        await kernel.browsers.deleteByID(session.session_id).catch(() => {});
      }
    },
  };
}
