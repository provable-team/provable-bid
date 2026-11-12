from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class Payouts(str, Enum):
    """simulated only with the fake provider."""

    SIMULATED = "simulated"
    PAYPAL_SANDBOX = "paypal_sandbox"
    PAYPAL_LIVE = "paypal_live"
    DISABLED = "disabled"

    __str__ = str.__str__


PayoutsOrStr: TypeAlias = Annotated[Payouts | str, open_enum_validator(Payouts)]
