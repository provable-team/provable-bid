from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class PayoutMode(str, Enum):
    SIMULATED = "simulated"
    PAYPAL_SANDBOX = "paypal_sandbox"
    PAYPAL_LIVE = "paypal_live"
    DISABLED = "disabled"

    __str__ = str.__str__


PayoutModeOrStr: TypeAlias = Annotated[PayoutMode | str, open_enum_validator(PayoutMode)]
