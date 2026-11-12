from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .allocation import Allocation, AllocationDict


class AllocationPage(SdkBaseModel):
    items: list[Allocation]
    next_cursor: str | None
    server_time: RFC3339DateTime


class AllocationPageDict(TypedDict):
    items: list[AllocationDict]
    next_cursor: str | None
    server_time: RFC3339DateTime
