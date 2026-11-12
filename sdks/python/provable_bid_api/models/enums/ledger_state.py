from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class LedgerState(str, Enum):
    ALLOCATED = "allocated"
    HELD = "held"
    REVERSED = "reversed"

    __str__ = str.__str__


LedgerStateOrStr: TypeAlias = Annotated[LedgerState | str, open_enum_validator(LedgerState)]
