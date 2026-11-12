from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class Source(str, Enum):
    """ledger: the operator's allocations here. paypal_agent_toolkit: a read-only PayPal Agent Toolkit tool.
    paypal_payouts: PayPal Payouts."""

    LEDGER = "ledger"
    PAYPAL_AGENT_TOOLKIT = "paypal_agent_toolkit"
    PAYPAL_PAYOUTS = "paypal_payouts"

    __str__ = str.__str__


SourceOrStr: TypeAlias = Annotated[Source | str, open_enum_validator(Source)]
