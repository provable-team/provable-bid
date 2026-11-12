from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .enums.status4 import Status4OrStr
from .unions.output2 import Output2, Output2Dict
from .usage import Usage, UsageDict


class StudioAiTurn(SdkBaseModel):
    id: str
    model: str
    """The model that answered (fixed server-side)."""

    status: Status4OrStr
    """incomplete: the turn hit its output cap. refused: the model declined; output is empty."""

    output: list[Output2]
    usage: Usage
    server_time: RFC3339DateTime


class StudioAiTurnDict(TypedDict):
    id: str
    model: str
    status: Status4OrStr
    output: list[Output2Dict]
    usage: UsageDict
    server_time: RFC3339DateTime
