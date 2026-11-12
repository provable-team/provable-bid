from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .competition import Competition, CompetitionDict


class CompetitionPage(SdkBaseModel):
    items: list[Competition]
    next_cursor: str | None
    server_time: RFC3339DateTime


class CompetitionPageDict(TypedDict):
    items: list[CompetitionDict]
    next_cursor: str | None
    server_time: RFC3339DateTime
