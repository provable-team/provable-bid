// The real-browser checks against a local Chrome (no KERNEL, no network): the same renderInBrowser the KERNEL
// renderer runs. Classic 15px scrollbars are switched back on so the browser behaves like a KERNEL session, where a
// narrow desktop window measured 100vw as overflow and passed pages with no viewport meta tag.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium, type Browser } from 'playwright-core';
import { parsePageSize, renderInBrowser } from '../apps/api/src/browser.js';
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

// ---------------------------------------------------------------- print (only for pages with print CSS)
const POSTER_CSS = (footer: string) => `<style>
@media screen{.sheet{max-width:100%;padding:16px}}
@media print{@page{size:A3 portrait;margin:0}html,body{margin:0}.sheet{width:297mm;height:420mm;overflow:hidden;position:relative;padding:20mm;box-sizing:border-box}
.art{height:330mm;background:#eee}.foot{${footer}}}
</style>`;
const POSTER_BODY = '<main class="sheet"><h1>Spoke &amp; Chain</h1><div class="art"></div><p class="foot">Saturdays 10am to 2pm at 12 Mill Lane</p></main>';

test('print: a clipped footer on an A3 poster is found and described, with the page size and page count', { skip }, async () => {
  const r = await renderInBrowser(browser, previewHtml(doc(VIEWPORT + POSTER_CSS('font-size:14pt;margin-top:60mm'), POSTER_BODY)));
  const p = r.print!;
  assert.equal(p.checked, true);
  assert.deepEqual(p.page_size_mm, [297, 420]);
  assert.equal(p.pages, 1); assert.equal(p.pages_source, 'pdf'); assert.equal(p.expected_pages, 1);
  assert.ok(p.overflow!.some(o => o.selector_hint === 'p.foot' && o.px > 0), JSON.stringify(p.overflow));
  assert.ok(p.issues!.some(i => /"Saturdays 10am to 2pm at 12 Mill Lane" \(p\.foot\) is cut off by main\.sheet/.test(i)), JSON.stringify(p.issues));
  assert.ok(!p.issues!.some(i => /PREVIEW|provable/.test(i)), 'the preview watermark is not part of the page');
  assert.equal(r.phoneOverflowPx, 0, 'screen measurements are unchanged');
});

test('print: small text, safe-area text and a wrong page count are issues; a clean print page has none', { skip }, async () => {
  const bad = await renderInBrowser(browser, doc(VIEWPORT + `<style>@page{size:3.5in 2in;margin:0}@media print{body{margin:0}
    .card{width:3.5in;height:2in;box-sizing:border-box;padding:1mm;break-after:page}.card small{font-size:6pt}}</style>`,
    '<div class="card">Maya Okafor<br><small>Email</small></div><div class="card">Back</div><div class="card">Extra</div><p>Stray paragraph</p>'));
  const p = bad.print!;
  assert.deepEqual(p.page_size_mm, [88.9, 50.8]);
  assert.equal(p.expected_pages, 3);
  assert.equal(p.pages, 4, 'the stray paragraph prints a fourth page');
  assert.ok(p.issues!.some(i => /prints as 4 page\(s\).*3 page\(s\) are expected/.test(i)), JSON.stringify(p.issues));
  assert.ok(p.issues!.some(i => /under 7 pt.*"Email" at 6 pt/.test(i)), JSON.stringify(p.issues));
  assert.ok(p.safe_area_violations! > 0 && p.issues!.some(i => /mm from the page edge \(inside the 3 mm safe area\)/.test(i)));
  assert.equal(p.min_font_pt, 6);

  const good = await renderInBrowser(browser, doc(VIEWPORT + POSTER_CSS('font-size:14pt'), POSTER_BODY.replace('<div class="art"></div>', '<div class="art" style="height:200mm"></div>')));
  assert.equal(good.print!.checked, true);
  assert.deepEqual(good.print!.issues, []);
  assert.deepEqual([good.print!.pages, good.print!.expected_pages, good.print!.safe_area_violations], [1, 1, 0]);
});

// Modeled on samples/riverside-night-market-poster/v3/meadow.html: the print CSS hides the screen wrapper, which holds
// the poster, so the A3 page prints empty while its page count and size still pass.
const HIDDEN_WRAP = (hide: string) => doc(VIEWPORT + `<style>.screen-wrap{padding:16px}.poster{max-width:560px;margin:0 auto;background:#1d2340;color:#fff;padding:24px}
@media print{@page{size:A3 portrait;margin:0}html,body{margin:0!important;padding:0!important}${hide}
.poster{width:297mm!important;height:420mm!important;max-width:none!important;margin:0!important;padding:24mm!important;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>`,
  `<div class="screen-wrap"><p class="screen-note">A3 portrait poster. Print at A3 with no margins.</p>
<main class="poster"><h1>Riverside Night Market</h1><p>Fridays in June, 6pm to 11pm</p><p>Free entry</p><div class="qr">Scan for vendors</div></main></div>`);

test('print: print CSS that hides the content wrapper is a blank print, even though page count and size pass', { skip }, async () => {
  const r = await renderInBrowser(browser, previewHtml(HIDDEN_WRAP('.screen-wrap,.screen-note{display:none!important}')));
  const p = r.print!;
  assert.equal(p.checked, true);
  assert.deepEqual(p.page_size_mm, [297, 420]);
  assert.equal(p.pages, 1);
  assert.ok(p.issues!.some(i => /^print output is blank: the print styles hide the content/.test(i)), JSON.stringify(p.issues));
  const hidden = await renderInBrowser(browser, HIDDEN_WRAP('.screen-wrap{visibility:hidden}'));
  assert.ok(hidden.print!.issues!.some(i => /^print output is blank/.test(i)), 'visibility:hidden hides it too');

  const shown = await renderInBrowser(browser, previewHtml(HIDDEN_WRAP('.screen-note{display:none!important}.screen-wrap{padding:0!important}')));
  assert.ok(!shown.print!.issues!.some(i => /blank/.test(i)), JSON.stringify(shown.print!.issues));
  const sample = new URL('../samples/riverside-night-market-poster/v3/meadow.html', import.meta.url);
  if (existsSync(sample)) {
    const real = await renderInBrowser(browser, previewHtml(readFileSync(sample, 'utf8')));
    assert.ok(real.print!.issues!.some(i => /^print output is blank/.test(i)), JSON.stringify(real.print!.issues));
  }
});

test('print: artwork with little text is not blank', { skip }, async () => {
  const r = await renderInBrowser(browser, doc(VIEWPORT + '<style>@page{size:A3 portrait;margin:0}@media print{body{margin:0}svg{width:297mm;height:400mm}}</style>',
    '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#c33"/></svg><p>Jazz</p>'));
  assert.equal(r.print!.checked, true);
  assert.ok(!r.print!.issues!.some(i => /blank/.test(i)), JSON.stringify(r.print!.issues));
});

test('print: a page without print CSS is not print-checked; "@page" in the text alone does not count', { skip }, async () => {
  const r = await renderInBrowser(browser, doc(VIEWPORT, `<h1>Web page</h1>${TALL}`));
  assert.deepEqual(r.print, { checked: false });
  const t = await renderInBrowser(browser, doc(VIEWPORT, '<p>Write @page rules and @media print blocks for posters.</p>'));
  assert.deepEqual(t.print, { checked: false });
});

test('print CSS sizes parse to mm', () => {
  assert.deepEqual(parsePageSize('A3 portrait'), [297, 420]);
  assert.deepEqual(parsePageSize('a4 landscape'), [297, 210]);
  assert.deepEqual(parsePageSize('3.5in 2in'), [88.9, 50.8]);
  assert.deepEqual(parsePageSize('letter'), [215.9, 279.4]);
  assert.equal(parsePageSize('auto'), null);
  assert.equal(parsePageSize(''), null);
});
