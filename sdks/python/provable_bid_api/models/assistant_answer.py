from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .assistant_lookup import AssistantLookup, AssistantLookupDict


class AssistantAnswer(SdkBaseModel):
    answer: str
    """Plain text."""

    lookups: list[AssistantLookup]
    server_time: RFC3339DateTime


class AssistantAnswerDict(TypedDict):
    answer: str
    lookups: list[AssistantLookupDict]
    server_time: RFC3339DateTime
