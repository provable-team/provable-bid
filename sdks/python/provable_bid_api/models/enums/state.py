from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class State(str, Enum):
    DRAFT = "draft"
    AWAITING_AUTHORIZATION = "awaiting_authorization"
    OPEN = "open"
    QUALIFYING = "qualifying"
    DECIDING = "deciding"
    CLOSED = "closed"
    CANCELLED = "cancelled"

    __str__ = str.__str__


StateOrStr: TypeAlias = Annotated[State | str, open_enum_validator(State)]
