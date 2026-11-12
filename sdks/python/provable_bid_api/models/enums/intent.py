from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class Intent(str, Enum):
    AUTHORIZE = "AUTHORIZE"
    CAPTURE = "CAPTURE"

    __str__ = str.__str__


IntentOrStr: TypeAlias = Annotated[Intent | str, open_enum_validator(Intent)]
