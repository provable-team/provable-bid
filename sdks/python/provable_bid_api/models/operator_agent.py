from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .agent import Agent, AgentDict


class OperatorAgent(SdkBaseModel):
    agent: Agent
    webhook_url: str | None
    submissions: int
    wins: int
    paid_minor: int


class OperatorAgentDict(TypedDict):
    agent: AgentDict
    webhook_url: str | None
    submissions: int
    wins: int
    paid_minor: int
