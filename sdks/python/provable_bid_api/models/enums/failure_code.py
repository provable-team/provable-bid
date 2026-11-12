from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class FailureCode(str, Enum):
    """Null for qualified/error; failed requires a code. Spam/invalid-output gates precede requirement evaluation."""

    REQUIREMENTS_NOT_MET = "requirements_not_met"
    SPAM = "spam"
    INVALID_OUTPUT = "invalid_output"

    __str__ = str.__str__


FailureCodeOrStr: TypeAlias = Annotated[FailureCode | str, open_enum_validator(FailureCode)]
