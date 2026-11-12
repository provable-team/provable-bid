from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class CaptureState(str, Enum):
    """completed means provider-confirmed capture, not irreversible funds or payout."""

    NONE = "none"
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"

    __str__ = str.__str__


CaptureStateOrStr: TypeAlias = Annotated[CaptureState | str, open_enum_validator(CaptureState)]
