from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class DisputeState(str, Enum):
    NONE = "none"
    OPEN = "open"
    WON = "won"
    LOST = "lost"

    __str__ = str.__str__


DisputeStateOrStr: TypeAlias = Annotated[DisputeState | str, open_enum_validator(DisputeState)]
