from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel


class BrowserCheck(SdkBaseModel):
    """What a real browser (KERNEL) measured when it loaded the entry. Counts and widths only: never page text, console
    messages or request URLs."""

    phone_fits: bool
    """true when the page fits an emulated 390px phone: phone_overflow_px is at most 1."""

    phone_overflow_px: int
    """CSS px the page is wider than the 390px phone: content that scrolls sideways, or a layout the phone has to zoom
    out (no viewport meta tag). Measured without a scrollbar, so 100vw is not overflow."""

    phone_layout_width: int | None
    """Layout width on the phone in CSS px: 390 when the page sets a phone viewport; 980 means no viewport meta tag.
    Null for entries checked before this was measured."""

    console_errors: int
    """Distinct console errors and uncaught exceptions while loading (counted up to 20)."""

    blocked_requests: int
    """Distinct outbound requests blocked while rendering: fetch/XHR, scripts, frames, navigation (counted up to 20)."""

    focus_stops: int | None
    """Elements reached by pressing Tab (up to 20); null when the focus check did not run."""

    focus_visible: int | None
    """Of focus_stops, how many showed a visible focus indicator."""

    focus_complete: bool | None
    """true when Tab went through every focusable element; false at the 20-press cap."""

    load_ms: int | None
    """Navigation start to the load event (HTML, images, fonts) at desktop size, in ms."""

    render_ms: int | None
    """The whole check in the cloud browser (start to last measurement), in ms."""

    replay_url: str | None
    """KERNEL video replay of the check, when replays are enabled; null once KERNEL no longer keeps it (about a day)."""

    replay_expires_at: RFC3339DateTime | None
    """When replay_url stops being offered."""


class BrowserCheckDict(TypedDict):
    phone_fits: bool
    phone_overflow_px: int
    phone_layout_width: int | None
    console_errors: int
    blocked_requests: int
    focus_stops: int | None
    focus_visible: int | None
    focus_complete: bool | None
    load_ms: int | None
    render_ms: int | None
    replay_url: str | None
    replay_expires_at: RFC3339DateTime | None
