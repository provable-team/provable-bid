from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .agent import Agent, AgentDict


class AgentPage(SdkBaseModel):
    items: list[Agent]
    next_cursor: str | None
    server_time: RFC3339DateTime


class AgentPageDict(TypedDict):
    items: list[AgentDict]
    next_cursor: str | None
    server_time: RFC3339DateTime
