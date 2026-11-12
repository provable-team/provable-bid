import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { BrowserCheck } from "@provable/api-client";
import { BrowserCheckSummary } from "../src/components/browser-check.js";

const NOW = Date.parse("2026-11-12T12:00:00Z");
const base: BrowserCheck = {
  phone_fits: true, phone_overflow_px: 0, phone_layout_width: 390, console_errors: 0, blocked_requests: 0,
  focus_stops: 6, focus_visible: 6, focus_complete: true, load_ms: 412, render_ms: 6100,
  replay_url: null, replay_expires_at: null,
};
const html = (check: Partial<BrowserCheck>) => renderToStaticMarkup(<BrowserCheckSummary check={{ ...base, ...check }} now={NOW} />);
const text = (markup: string) => markup.replace(/<[^>]+>/g, "");

test("the gallery card says what the real browser measured", () => {
  const out = text(html({}));
  assert.match(out, /Checked in a real browser \(KERNEL\)/);
  assert.match(out, /Fits a 390px phone/);
  assert.match(out, /No console errors/);
  assert.match(out, /No outside requests/);
  assert.match(out, /Keyboard focus visible on 6 of 6 Tab stops/);
  assert.match(out, /Loaded in 0\.4 s · checked in 6\.1 s/);
  assert.doesNotMatch(out, /Watch the check/);
});

test("problems read as notes, with the measured numbers", () => {
  const out = text(html({ phone_fits: false, phone_overflow_px: 210, console_errors: 1, blocked_requests: 2, focus_visible: 3, focus_stops: 20, focus_complete: false }));
  assert.match(out, /Note: Scrolls sideways by 210px on a 390px phone/);
  assert.match(out, /Note: 1 console error(?!s)/);
  assert.match(out, /Note: 2 outside requests blocked/);
  assert.match(out, /3 of 20\+ Tab stops/);
  assert.match(text(html({ phone_fits: false, phone_overflow_px: 590, phone_layout_width: 980 })), /Not set up for phones: lays out 980px wide/);
});

test("the replay link shows only while it is valid, and only for https", () => {
  const live = html({ replay_url: "https://replays.example/r/1", replay_expires_at: "2026-11-12T20:00:00Z" });
  assert.match(live, /<a href="https:\/\/replays.example\/r\/1" target="_blank" rel="noopener noreferrer">Watch the check/);
  assert.match(live, /<time dateTime="2026-11-12T20:00:00Z">/);
  assert.doesNotMatch(html({ replay_url: "https://replays.example/r/1", replay_expires_at: "2026-11-12T11:00:00Z" }), /Watch the check/, "expired");
  assert.doesNotMatch(html({ replay_url: "javascript:alert(1)", replay_expires_at: "2026-11-12T20:00:00Z" }), /<a /, "never a script URL");
});
