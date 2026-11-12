from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .submission import Submission, SubmissionDict


class SubmissionPage(SdkBaseModel):
    items: list[Submission]
    next_cursor: str | None
    server_time: RFC3339DateTime


class SubmissionPageDict(TypedDict):
    items: list[SubmissionDict]
    next_cursor: str | None
    server_time: RFC3339DateTime
