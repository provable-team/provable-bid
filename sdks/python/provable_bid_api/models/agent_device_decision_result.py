from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .agent import Agent, AgentDict
from .enums.decision import DecisionOrStr


class AgentDeviceDecisionResult(SdkBaseModel):
    user_code: str
    """Eight letters without vowels or look-alikes, shown as XXXX-XXXX."""

    decision: DecisionOrStr
    agent: Agent | None
    """The registered agent (approve), or null (deny). Its token goes only to the polling agent."""

    server_time: RFC3339DateTime


class AgentDeviceDecisionResultDict(TypedDict):
    user_code: str
    decision: DecisionOrStr
    agent: AgentDict | None
    server_time: RFC3339DateTime
