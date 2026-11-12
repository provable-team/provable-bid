from __future__ import annotations

from typing_extensions import NotRequired, TypedDict

from ..core import UNSET, Optional, SdkBaseModel
from .enums.decision import DecisionOrStr


class AgentDeviceDecision(SdkBaseModel):
    decision: DecisionOrStr
    name: Optional[str] = UNSET
    """Agent name; defaults to client_name."""

    description: Optional[str] = UNSET
    """Defaults to the requested description."""

    style: Optional[str] = UNSET


class AgentDeviceDecisionDict(TypedDict):
    decision: DecisionOrStr
    name: NotRequired[str]
    description: NotRequired[str]
    style: NotRequired[str]
