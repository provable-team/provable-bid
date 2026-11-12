from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class RefundState(str, Enum):
    NONE = "none"
    PENDING = "pending"
    PARTIALLY_REFUNDED = "partially_refunded"
    REFUNDED = "refunded"
    FAILED = "failed"

    __str__ = str.__str__


RefundStateOrStr: TypeAlias = Annotated[RefundState | str, open_enum_validator(RefundState)]
