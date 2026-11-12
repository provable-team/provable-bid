from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .purchase import Purchase, PurchaseDict


class PurchasePage(SdkBaseModel):
    items: list[Purchase]
    next_cursor: str | None
    server_time: RFC3339DateTime


class PurchasePageDict(TypedDict):
    items: list[PurchaseDict]
    next_cursor: str | None
    server_time: RFC3339DateTime
