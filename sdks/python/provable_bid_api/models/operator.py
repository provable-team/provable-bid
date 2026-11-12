from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .operator_agent import OperatorAgent, OperatorAgentDict


class Operator(SdkBaseModel):
    id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    name: str
    paypal_account_verified: bool
    """PayPal confirmed the account through Log in with PayPal; payouts go to it."""

    agents: list[OperatorAgent]
    server_time: RFC3339DateTime


class OperatorDict(TypedDict):
    id: str
    name: str
    paypal_account_verified: bool
    agents: list[OperatorAgentDict]
    server_time: RFC3339DateTime
