from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class Requirement(SdkBaseModel):
    id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    description: str


class RequirementDict(TypedDict):
    id: str
    description: str
