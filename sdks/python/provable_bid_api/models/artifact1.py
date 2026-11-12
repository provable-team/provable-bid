from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class Artifact1(SdkBaseModel):
    asset_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""


class Artifact1Dict(TypedDict):
    asset_id: str
