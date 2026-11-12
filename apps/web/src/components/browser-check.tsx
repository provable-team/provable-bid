"use client";
import type { BrowserCheck } from "@provable/api-client";
import { Icon } from "./ui";

const seconds = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The replay link, only while it is still offered and only to an https address. */
function replayLink(check: BrowserCheck, now: number) {
  if (!check.replay_url || !check.replay_expires_at || Date.parse(check.replay_expires_at) <= now) return null;
  try {
    const url = new URL(check.replay_url);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * What the real browser (KERNEL) measured, in the gallery card's "How it was checked": phone fit, console errors,
 * blocked requests, keyboard focus and timing. Counts and widths only; the API never sends page messages or URLs.
 */
export function BrowserCheckSummary({ check, now = Date.now() }: { check: BrowserCheck; now?: number }) {
  const zoomed = (check.phone_layout_width ?? 0) > 390;
  const phone = check.phone_fits
    ? "Fits a 390px phone, no sideways scrolling"
    : zoomed
      ? `Not set up for phones: lays out ${check.phone_layout_width}px wide, so the phone zooms out`
      : `Scrolls sideways by ${check.phone_overflow_px}px on a 390px phone`;
  const focus =
    check.focus_stops === null || check.focus_visible === null
      ? null
      : check.focus_stops === 0
        ? { ok: false, text: "Keyboard: Tab reaches nothing" }
        : {
            ok: check.focus_visible === check.focus_stops,
            text: `Keyboard focus visible on ${check.focus_visible} of ${check.focus_stops}${check.focus_complete ? "" : "+"} Tab stops`,
          };
  const timing = [
    check.load_ms !== null ? `Loaded in ${seconds(check.load_ms)}` : null,
    check.render_ms !== null ? `checked in ${seconds(check.render_ms)}` : null,
  ].filter(Boolean).join(" · ");
  const replay = replayLink(check, now);
  const rows: { ok: boolean; text: string }[] = [
    { ok: check.phone_fits, text: phone },
    { ok: check.console_errors === 0, text: check.console_errors ? plural(check.console_errors, "console error") : "No console errors" },
    { ok: check.blocked_requests === 0, text: check.blocked_requests ? `${plural(check.blocked_requests, "outside request")} blocked` : "No outside requests" },
    ...(focus ? [focus] : []),
  ];
  return (
    <section className="browser-check" aria-label="Checked in a real browser (KERNEL)">
      <p className="browser-check-title">Checked in a real browser (KERNEL)</p>
      <ul className="check-list browser-check-list">
        {rows.map((row) => (
          <li key={row.text} className={row.ok ? "" : "attention"}>
            <Icon name={row.ok ? "check" : "close"} size={13} />
            <span>
              <span className="visually-hidden">{row.ok ? "Pass: " : "Note: "}</span>
              {row.text}
            </span>
          </li>
        ))}
      </ul>
      {(timing || replay) && (
        <p className="field-help browser-check-meta">
          {timing}
          {replay && check.replay_expires_at && (
            <>
              {timing ? " · " : ""}
              <a href={replay} target="_blank" rel="noopener noreferrer">
                Watch the check<span className="visually-hidden"> (video replay, opens in a new tab)</span>
              </a>{" "}
              until{" "}
              <time dateTime={check.replay_expires_at}>
                {new Date(check.replay_expires_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </time>
            </>
          )}
        </p>
      )}
    </section>
  );
}
