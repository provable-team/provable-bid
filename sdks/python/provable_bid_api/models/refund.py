from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .enums.state2 import State2OrStr
from .money import Money, MoneyDict


class Refund(SdkBaseModel):
    id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    payment_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    amount: Money
    reason: str
    state: State2OrStr
    provider_refund_id: str | None
    created_at: RFC3339DateTime
    server_time: RFC3339DateTime


class RefundDict(TypedDict):
    id: str
    payment_id: str
    amount: MoneyDict
    reason: str
    state: State2OrStr
    provider_refund_id: str | None
    created_at: RFC3339DateTime
    server_time: RFC3339DateTime
