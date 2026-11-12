import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

/** Present once the entry was rendered in a real browser (KERNEL). */
export type BrowserCheck2 = {
  /** true when the page fits an emulated 390px phone: phone_overflow_px is at most 1. */
  phoneFits: boolean;
  /**
   * CSS px the page is wider than the 390px phone: content that scrolls sideways, or a layout the
   * phone has to zoom out (no viewport meta tag). Measured without a scrollbar, so 100vw is not
   * overflow.
   */
  phoneOverflowPx: number;
  /**
   * Layout width on the phone in CSS px: 390 when the page sets a phone viewport; 980 means no
   * viewport meta tag. Null for entries checked before this was measured.
   */
  phoneLayoutWidth: number | null;
  /** Distinct console errors and uncaught exceptions while loading (counted up to 20). */
  consoleErrors: number;
  /**
   * Distinct outbound requests blocked while rendering: fetch/XHR, scripts, frames, navigation
   * (counted up to 20).
   */
  blockedRequests: number;
  /** Elements reached by pressing Tab (up to 20); null when the focus check did not run. */
  focusStops: number | null;
  /** Of focus_stops, how many showed a visible focus indicator. */
  focusVisible: number | null;
  /** true when Tab went through every focusable element; false at the 20-press cap. */
  focusComplete: boolean | null;
  /** Navigation start to the load event (HTML, images, fonts) at desktop size, in ms. */
  loadMs: number | null;
  /** The whole check in the cloud browser (start to last measurement), in ms. */
  renderMs: number | null;
  /**
   * KERNEL video replay of the check, when replays are enabled; null once KERNEL no longer keeps it
   * (about a day).
   */
  replayUrl: string | null;
  /** When replay_url stops being offered. */
  replayExpiresAt: Date | null;
};

const browserCheck2Properties: s.Shape<BrowserCheck2> = {
  phoneFits: s.boolean(),
  phoneOverflowPx: s.int(),
  phoneLayoutWidth: s.nullable(s.int()),
  consoleErrors: s.int(),
  blockedRequests: s.int(),
  focusStops: s.nullable(s.int()),
  focusVisible: s.nullable(s.int()),
  focusComplete: s.nullable(s.boolean()),
  loadMs: s.nullable(s.int()),
  renderMs: s.nullable(s.int()),
  replayUrl: s.nullable(s.string()),
  replayExpiresAt: s.nullable(s.dateTime()),
  _keysMap: {
    phoneFits: "phone_fits",
    phoneOverflowPx: "phone_overflow_px",
    phoneLayoutWidth: "phone_layout_width",
    consoleErrors: "console_errors",
    blockedRequests: "blocked_requests",
    focusStops: "focus_stops",
    focusVisible: "focus_visible",
    focusComplete: "focus_complete",
    loadMs: "load_ms",
    renderMs: "render_ms",
    replayUrl: "replay_url",
    replayExpiresAt: "replay_expires_at",
  },
};

export const browserCheck2InternalSchema: Schema<BrowserCheck2> =
  s.object<BrowserCheck2>(browserCheck2Properties);

export const browserCheck2Schema: Schema<BrowserCheck2> = s.lazySchema(() =>
  s.object<BrowserCheck2>({
    ...browserCheck2Properties,
    phoneOverflowPx: s.int().check(s.gte(0)),
    phoneLayoutWidth: s.nullable(s.int().check(s.gte(1))),
    consoleErrors: s.int().check(s.gte(0), s.lte(20)),
    blockedRequests: s.int().check(s.gte(0), s.lte(20)),
    focusStops: s.nullable(s.int().check(s.gte(0), s.lte(20))),
    focusVisible: s.nullable(s.int().check(s.gte(0), s.lte(20))),
    loadMs: s.nullable(s.int().check(s.gte(0))),
    renderMs: s.nullable(s.int().check(s.gte(0))),
    replayUrl: s.nullable(s.string().check(s.url())),
  }),
);
