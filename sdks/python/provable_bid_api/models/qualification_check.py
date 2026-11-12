from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class QualificationCheck(SdkBaseModel):
    requirement_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    passed: bool
    reason: str


class QualificationCheckDict(TypedDict):
    requirement_id: str
    passed: bool
    reason: str
