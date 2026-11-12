from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class RefundRequest(SdkBaseModel):
    reason: str


class RefundRequestDict(TypedDict):
    reason: str
