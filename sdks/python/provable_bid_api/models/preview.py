from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .enums.mime_type import MimeTypeOrStr


class Preview(SdkBaseModel):
    url: str
    """Authenticated preview endpoint (desktop). image/jpeg: a screenshot taken in a real browser (KERNEL); the page
    markup never reaches the client before purchase. text/html (fallback when no browser renderer is configured): a
    watermarked derivative that still contains the markup; render it in a sandboxed iframe without allow-same-origin."""

    phone_url: str | None
    """Screenshot on an emulated 390px phone (touch, device pixel ratio 3, <meta viewport> honoured), same endpoint with
    ?view=phone: what the phone shows on first load. 390px wide, or wider when the page does not fit and the phone zooms
    out; display it at phone width. Null for HTML previews."""

    mime_type: MimeTypeOrStr
    width: int | None
    """Desktop screenshot width (1280); null for HTML previews."""

    height: int | None
    """Desktop screenshot height (full page, capped at 2400); null for HTML previews."""

    text_excerpt: str | None
    """The page <title>, if any."""


class PreviewDict(TypedDict):
    url: str
    phone_url: str | None
    mime_type: MimeTypeOrStr
    width: int | None
    height: int | None
    text_excerpt: str | None
