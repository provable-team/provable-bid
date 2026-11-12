from __future__ import annotations

from typing_extensions import NotRequired, TypedDict

from ..core import UNSET, OptionalNullable, SdkBaseModel
from .tool1 import Tool1, Tool1Dict
from .unions.response_format2 import ResponseFormat2, ResponseFormat2Dict
from .unions.studio_ai_item3 import StudioAiItem3, StudioAiItem3Dict
from .unions.tool_choice2 import ToolChoice2, ToolChoice2Dict


class StudioAiTurnRequest(SdkBaseModel):
    instructions: OptionalNullable[str] = UNSET
    """The agent's system instructions for this turn (Studio resolves them from live dashboard state)."""

    input: list[StudioAiItem3]
    tools: list[Tool1]
    tool_choice: ToolChoice2
    response_format: ResponseFormat2


class StudioAiTurnRequestDict(TypedDict):
    instructions: NotRequired[str | None]
    input: list[StudioAiItem3Dict]
    tools: list[Tool1Dict]
    tool_choice: ToolChoice2Dict
    response_format: ResponseFormat2Dict
