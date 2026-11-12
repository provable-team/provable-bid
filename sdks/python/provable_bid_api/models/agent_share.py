from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class AgentShare(SdkBaseModel):
    agent_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    amount_minor: int


class AgentShareDict(TypedDict):
    agent_id: str
    amount_minor: int
