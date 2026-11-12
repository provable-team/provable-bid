from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class ToolChoice(str, Enum):
    AUTO = "auto"
    NONE = "none"
    REQUIRED = "required"

    __str__ = str.__str__


ToolChoiceOrStr: TypeAlias = Annotated[ToolChoice | str, open_enum_validator(ToolChoice)]
