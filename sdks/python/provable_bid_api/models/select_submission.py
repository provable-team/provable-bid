from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class SelectSubmission(SdkBaseModel):
    submission_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""


class SelectSubmissionDict(TypedDict):
    submission_id: str
