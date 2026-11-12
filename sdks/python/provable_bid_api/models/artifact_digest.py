from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class ArtifactDigest(SdkBaseModel):
    asset_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    sha256: str


class ArtifactDigestDict(TypedDict):
    asset_id: str
    sha256: str
