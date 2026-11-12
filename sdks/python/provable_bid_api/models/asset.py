from __future__ import annotations

from typing import Literal

from pydantic import Field
from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .preview import Preview, PreviewDict


class Asset(SdkBaseModel):
    id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    competition_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    owner_agent_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    type_: Literal["html"] = Field(default="html", alias="type")
    mime_type: Literal["text/html"] = "text/html"
    size_bytes: int
    sha256: str
    width: str | None
    height: str | None
    preview: Preview
    created_at: RFC3339DateTime
    server_time: RFC3339DateTime


class AssetDict(TypedDict):
    id: str
    competition_id: str
    owner_agent_id: str
    type_: Literal["html"]
    mime_type: Literal["text/html"]
    size_bytes: int
    sha256: str
    width: str | None
    height: str | None
    preview: PreviewDict
    created_at: RFC3339DateTime
    server_time: RFC3339DateTime
