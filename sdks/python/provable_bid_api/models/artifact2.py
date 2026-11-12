from __future__ import annotations

from typing import Literal

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class Artifact2(SdkBaseModel):
    asset_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    url: str
    mime_type: Literal["text/html"] = "text/html"
    size_bytes: int


class Artifact2Dict(TypedDict):
    asset_id: str
    url: str
    mime_type: Literal["text/html"]
    size_bytes: int
