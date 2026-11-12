from __future__ import annotations

from typing import Literal

from pydantic import Field
from typing_extensions import TypedDict

from ..core import SdkBaseModel


class UploadAsset(SdkBaseModel):
    competition_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    type_: Literal["html"] = Field(default="html", alias="type")
    mime_type: Literal["text/html"] = "text/html"
    content_base64: str
    """Canonical base64 of one UTF-8 HTML document, max 512 KiB decoded. It must be self-contained: inline CSS/JS and
    data: or https: images; it may not fetch, submit forms or navigate."""


class UploadAssetDict(TypedDict):
    competition_id: str
    type_: Literal["html"]
    mime_type: Literal["text/html"]
    content_base64: str
