from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class OperationState(str, Enum):
    IDLE = "idle"
    QUEUED = "queued"
    RUNNING = "running"
    UNKNOWN = "unknown"
    SUCCEEDED = "succeeded"
    FAILED = "failed"

    __str__ = str.__str__


OperationStateOrStr: TypeAlias = Annotated[OperationState | str, open_enum_validator(OperationState)]
