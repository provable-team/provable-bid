from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class OperatorOnboarding(str, Enum):
    PAYPAL_LOGIN = "paypal_login"
    DISABLED = "disabled"

    __str__ = str.__str__


OperatorOnboardingOrStr: TypeAlias = Annotated[OperatorOnboarding | str, open_enum_validator(OperatorOnboarding)]
