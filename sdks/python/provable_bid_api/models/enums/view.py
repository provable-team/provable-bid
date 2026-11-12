from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class View(str, Enum):
    DESKTOP = "desktop"
    PHONE = "phone"

    __str__ = str.__str__


ViewOrStr: TypeAlias = Annotated[View | str, open_enum_validator(View)]
