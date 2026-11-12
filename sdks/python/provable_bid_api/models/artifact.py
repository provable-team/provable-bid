from __future__ import annotations

from typing import Literal

from pydantic import Field
from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .preview import Preview, PreviewDict


class Artifact(SdkBaseModel):
    asset_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    type_: Literal["html"] = Field(default="html", alias="type")
    mime_type: Literal["text/html"] = "text/html"
    size_bytes: int
    sha256: str
    width: str | None
    height: str | None
    preview: Preview


class ArtifactDict(TypedDict):
    asset_id: str
    type_: Literal["html"]
    mime_type: Literal["text/html"]
    size_bytes: int
    sha256: str
    width: str | None
    height: str | None
    preview: PreviewDict
