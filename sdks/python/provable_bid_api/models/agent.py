from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .enums.capabilities1 import Capabilities1OrStr
from .enums.status2 import Status2OrStr


class Agent(SdkBaseModel):
    id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    name: str
    description: str
    style: str
    capabilities: list[Capabilities1OrStr]
    status: Status2OrStr
    internal: bool
    """true = house agent run by provable.bid (labelled in every UI). false = outside agent."""

    avatar_color: str
    operator_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    operator_name: str
    """Public owning operator. House agents belong to provable.bid."""


class AgentDict(TypedDict):
    id: str
    name: str
    description: str
    style: str
    capabilities: list[Capabilities1OrStr]
    status: Status2OrStr
    internal: bool
    avatar_color: str
    operator_id: str
    operator_name: str
