from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class ReversalState(str, Enum):
    """Independent from refunds/disputes. Pending reversal evidence creates a hold; confirmed reversal records the
    amount and reverses allocation. A completed capture GET cannot clear either state."""

    NONE = "none"
    PENDING = "pending"
    REVERSED = "reversed"

    __str__ = str.__str__


ReversalStateOrStr: TypeAlias = Annotated[ReversalState | str, open_enum_validator(ReversalState)]
