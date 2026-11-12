import Kernel from '@onkernel/sdk';
import { chromium } from 'playwright-core';

/** What a real browser saw when it loaded a submitted page. */
export interface RenderResult {
  desktop: Buffer;            // JPEG, 1280px wide, full page up to MAX_HEIGHT
  phone: Buffer;              // JPEG, 390px wide, full page up to MAX_HEIGHT
  desktopHeight: number;      // pixel height of the desktop screenshot
  phoneHeight: number;
  phoneOverflowPx: number;    // horizontal scroll at 390px; > 0 means it doesn't fit a phone
  consoleErrors: string[];
  blockedRequests: string[];  // fetch/XHR/scripts/frames to other sites, blocked while rendering
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
        return {
          desktop: shots.desktop.jpeg, phone: shots.phone.jpeg, desktopHeight: shots.desktop.height, phoneHeight: shots.phone.height,
          phoneOverflowPx: Math.max(0, shots.phone.overflow), consoleErrors, blockedRequests,
        };
      } finally {
        signal?.removeEventListener('abort', abort);
        await browser.close().catch(() => {});
        await kernel.browsers.deleteByID(session.session_id).catch(() => {});
      }
    },
  };
}
