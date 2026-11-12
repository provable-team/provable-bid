// The real-browser checks against a local Chrome (no KERNEL, no network): the same renderInBrowser the KERNEL
// renderer runs. Classic 15px scrollbars are switched back on so the browser behaves like a KERNEL session, where a
// narrow desktop window measured 100vw as overflow and passed pages with no viewport meta tag.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium, type Browser } from 'playwright-core';
import { renderInBrowser } from '../apps/api/src/browser.js';
import { previewHtml } from '../apps/api/src/html.js';

const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';
const skip = existsSync(CHROME) ? false : `no Chrome at ${CHROME}`;
let browser: Browser;
before(async () => { if (!skip) browser = await chromium.launch({ executablePath: CHROME, headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] }); });
after(async () => { await browser?.close(); });

const doc = (head: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">${head}<title>Fixture</title>
<style>body{margin:0;font:16px system-ui}a:focus-visible{outline:3px solid #36c}</style></head><body>${body}</body></html>`;
const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1">';
const TALL = '<div style="height:2000px">More content</div>';
const jpegWidth = (b: Buffer) => { // SOF0/SOF2 frame header: height and width follow the marker
  for (let i = 2; i < b.length - 9;) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    if (marker === 0xc0 || marker === 0xc2) return b.readUInt16BE(i + 7);
    i += 2 + b.readUInt16BE(i + 2);
  }
  return 0;
};

test('a full-bleed 100vw design fits the phone: no false overflow from a scrollbar', { skip }, async () => {
  const r = await renderInBrowser(browser, doc(VIEWPORT, `<header style="width:100vw;height:240px;background:#234"></header>${TALL}`));
  assert.equal(r.phoneOverflowPx, 0);
  assert.deepEqual(r.phoneLayout, { layoutWidth: 390, contentWidth: 390, scale: 1 });
  assert.equal(jpegWidth(r.phone), 390, 'the phone screenshot is the phone screen, 390px wide');
  assert.equal(jpegWidth(r.desktop), 1280);
});

test('one pass at a time (replay mode) measures the same', { skip }, async () => {
  const r = await renderInBrowser(browser, doc(VIEWPORT, `<header style="width:100vw;height:240px"></header><a href="#x">Link</a>${TALL}`), { sequential: true });
  assert.equal(r.phoneOverflowPx, 0);
  assert.equal(r.focus?.tabStops, 1);
});

test('a page without a viewport meta tag is flagged: the phone lays it out 980px wide and zooms out', { skip }, async () => {
  const r = await renderInBrowser(browser, doc('', `<h1>Desktop only</h1><p>Fluid text that would wrap fine.</p>${TALL}`));
  assert.equal(r.phoneLayout?.layoutWidth, 980);
  assert.equal(r.phoneOverflowPx, 590, '980px layout on a 390px screen');
  assert.ok(r.phoneLayout!.scale < 0.5);
  assert.equal(jpegWidth(r.phone), 980, 'the screenshot is the zoomed-out page, shown at phone width by clients');
});

test('content wider than the phone is measured from the layout width, without the scrollbar', { skip }, async () => {
  const r = await renderInBrowser(browser, doc(VIEWPORT, `<div style="width:600px;height:120px;background:#c33"></div>${TALL}`));
  assert.equal(r.phoneOverflowPx, 210, '600 - 390 (a desktop window with a scrollbar measured 225)');
  assert.equal(r.phoneLayout?.layoutWidth, 390);
});

test('console errors, blocked requests, focus and load time are measured once each', { skip }, async () => {
  const r = await renderInBrowser(browser, doc(VIEWPORT, `<nav><a href="#a">One</a> <a href="#b" style="outline:none">Two</a></nav>
    <script>fetch('https://example.com/track').catch(() => {}); undefinedFunction();</script>`));
  assert.equal(r.consoleErrors.filter(e => /undefinedFunction/.test(e)).length, 1, 'three loads, reported once');
  assert.ok(r.blockedRequests.some(x => x.startsWith('fetch https://example.com/track')));
  assert.ok(!r.blockedRequests.some(x => x.includes('provable.invalid')), 'the entry itself and the favicon are not reported');
  assert.equal(r.focus?.tabStops, 2);
  assert.equal(r.focus?.visibleIndicators, 1);
  assert.equal(typeof r.loadMs, 'number');
});

test('the watermarked preview (what production renders) loads cleanly at the in-browser address', { skip }, async () => {
  const r = await renderInBrowser(browser, previewHtml(doc(VIEWPORT, `<header style="width:100vw;height:200px"></header><a href="#x">Link</a>${TALL}`)));
  assert.deepEqual(r.consoleErrors, []);
  assert.deepEqual(r.blockedRequests, []);
  assert.equal(r.phoneOverflowPx, 0);
});
