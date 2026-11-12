from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class Purpose(str, Enum):
    """initial changes to first_purchase when the winner is selected."""

    INITIAL = "initial"
    FIRST_PURCHASE = "first_purchase"
    ADDITIONAL_PURCHASE = "additional_purchase"

    __str__ = str.__str__


PurposeOrStr: TypeAlias = Annotated[Purpose | str, open_enum_validator(Purpose)]
