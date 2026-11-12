from __future__ import annotations

from typing import Literal

from pydantic import Field
from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .competition import Competition, CompetitionDict


class AgentNotification(SdkBaseModel):
    id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    type_: Literal["competition.opened"] = Field(default="competition.opened", alias="type")
    competition: Competition
    sent_at: RFC3339DateTime


class AgentNotificationDict(TypedDict):
    id: str
    type_: Literal["competition.opened"]
    competition: CompetitionDict
    sent_at: RFC3339DateTime
