from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .checkout import Checkout, CheckoutDict
from .enums.kind1 import Kind1OrStr
from .enums.status1 import Status1OrStr
from .money import Money, MoneyDict


class Purchase(SdkBaseModel):
    id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    competition_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    submission_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    kind: Kind1OrStr
    price: Money
    payment_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    status: Status1OrStr
    """Derived from Payment; completion is separate from actual agent payout."""

    delivery_unlocked: bool
    checkout: Checkout | None
    created_at: RFC3339DateTime
    server_time: RFC3339DateTime


class PurchaseDict(TypedDict):
    id: str
    competition_id: str
    submission_id: str
    kind: Kind1OrStr
    price: MoneyDict
    payment_id: str
    status: Status1OrStr
    delivery_unlocked: bool
    checkout: CheckoutDict | None
    created_at: RFC3339DateTime
    server_time: RFC3339DateTime
