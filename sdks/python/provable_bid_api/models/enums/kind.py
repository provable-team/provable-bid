from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class Kind(str, Enum):
    NAV = "nav"
    HERO = "hero"
    SECTION = "section"
    FORM = "form"
    FAQ = "faq"
    TABLE = "table"
    FOOTER = "footer"

    __str__ = str.__str__


KindOrStr: TypeAlias = Annotated[Kind | str, open_enum_validator(Kind)]
