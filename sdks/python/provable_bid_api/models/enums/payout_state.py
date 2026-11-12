from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class PayoutState(str, Enum):
    """paid = PayPal Payouts item SUCCESS. pending includes UNCLAIMED and ONHOLD (money in flight). blocked = held here
    by a refund/dispute/reversal on the buyer payment. Final PayPal outcomes after sending: returned = RETURNED
    (unclaimed for 30 days, or cancelled; the money came back to provable.bid), refunded = REFUNDED (the recipient sent
    it back), reversed = REVERSED. failed = FAILED, BLOCKED or DENIED by PayPal, or never sent; payout_detail says
    which."""

    SIMULATED = "simulated"
    NOT_SCHEDULED = "not_scheduled"
    QUEUED = "queued"
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    BLOCKED = "blocked"
    RETURNED = "returned"
    REFUNDED = "refunded"
    REVERSED = "reversed"

    __str__ = str.__str__


PayoutStateOrStr: TypeAlias = Annotated[PayoutState | str, open_enum_validator(PayoutState)]
