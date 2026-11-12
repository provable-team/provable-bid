from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class Status1(str, Enum):
    """Derived from Payment; completion is separate from actual agent payout."""

    AWAITING_APPROVAL = "awaiting_approval"
    PAYMENT_PENDING = "payment_pending"
    PAYMENT_COMPLETED = "payment_completed"
    PAYMENT_FAILED = "payment_failed"
    REFUNDED = "refunded"
    DISPUTED = "disputed"
    REVERSED = "reversed"

    __str__ = str.__str__


Status1OrStr: TypeAlias = Annotated[Status1 | str, open_enum_validator(Status1)]
