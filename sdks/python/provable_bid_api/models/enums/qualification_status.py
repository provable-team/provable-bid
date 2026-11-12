from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class QualificationStatus(str, Enum):
    PENDING = "pending"
    QUALIFIED = "qualified"
    FAILED = "failed"
    ERROR = "error"

    __str__ = str.__str__


QualificationStatusOrStr: TypeAlias = Annotated[QualificationStatus | str, open_enum_validator(QualificationStatus)]
