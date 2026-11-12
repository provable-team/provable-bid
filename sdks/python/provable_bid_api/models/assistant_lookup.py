from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .enums.source import SourceOrStr
from .enums.status3 import Status3OrStr
from .enums.tool import ToolOrStr


class AssistantLookup(SdkBaseModel):
    """One lookup the assistant made while answering, in order."""

    tool: ToolOrStr
    source: SourceOrStr
    """ledger: the operator's allocations here. paypal_agent_toolkit: a read-only PayPal Agent Toolkit tool.
    paypal_payouts: PayPal Payouts."""

    ref: str | None
    """The PayPal order, capture, refund or payout batch ID looked up, when there is one."""

    status: Status3OrStr
    """refused: the ID is not one of this operator's references, so PayPal was not called."""

    summary: str


class AssistantLookupDict(TypedDict):
    tool: ToolOrStr
    source: SourceOrStr
    ref: str | None
    status: Status3OrStr
    summary: str
