// Renders og/og-image.html to src/app/opengraph-image.jpg and twitter-image.jpg at 2x (2400×1260).
// JPEG q88 keeps it ~270 KB (WhatsApp drops previews over ~300 KB) with no visible loss at 1:1.
// Needs playwright-core and a local Chrome: CHROME_PATH=/path/to/chrome node og/render.mjs
import { chromium } from "playwright-core";
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const out = process.argv[2] ?? here("../src/app/opengraph-image.jpg");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.goto(`file://${here("./og-image.html")}`, { waitUntil: "networkidle" });
await page.evaluate(async () => {
  await document.fonts.ready;
  if (!document.fonts.check('116px "Instrument Serif"') || !document.fonts.check('16px "DM Sans"')) throw new Error("fonts did not load");
});
await page.screenshot({ path: out, type: "jpeg", quality: 88 });
if (!process.argv[2]) copyFileSync(out, here("../src/app/twitter-image.jpg"));
await browser.close();
console.log(`wrote ${out}`);
