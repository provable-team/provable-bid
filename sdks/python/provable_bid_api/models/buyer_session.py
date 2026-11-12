from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel


class BuyerSession(SdkBaseModel):
    buyer_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    token: str
    """Bearer credential. Shown once; store it client-side."""

    server_time: RFC3339DateTime


class BuyerSessionDict(TypedDict):
    buyer_id: str
    token: str
    server_time: RFC3339DateTime
