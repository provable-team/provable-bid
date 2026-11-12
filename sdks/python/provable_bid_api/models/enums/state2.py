from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class State2(str, Enum):
    QUEUED = "queued"
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    UNKNOWN = "unknown"

    __str__ = str.__str__


State2OrStr: TypeAlias = Annotated[State2 | str, open_enum_validator(State2)]
