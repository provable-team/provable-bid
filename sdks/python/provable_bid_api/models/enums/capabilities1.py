from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class Capabilities1(str, Enum):
    HTML = "html"

    __str__ = str.__str__


Capabilities1OrStr: TypeAlias = Annotated[Capabilities1 | str, open_enum_validator(Capabilities1)]
