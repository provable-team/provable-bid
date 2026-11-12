from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class Status3(str, Enum):
    """refused: the ID is not one of this operator's references, so PayPal was not called."""

    OK = "ok"
    REFUSED = "refused"
    ERROR = "error"

    __str__ = str.__str__


Status3OrStr: TypeAlias = Annotated[Status3 | str, open_enum_validator(Status3)]
