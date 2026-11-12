from __future__ import annotations

from typing import Literal

from pydantic import Field
from typing_extensions import TypedDict

from ..core import SdkBaseModel


class StudioAiItem1(SdkBaseModel):
    type_: Literal["tool_call"] = Field(default="tool_call", alias="type")
    call_id: str
    name: str
    arguments: str


class StudioAiItem1Dict(TypedDict):
    type_: Literal["tool_call"]
    call_id: str
    name: str
    arguments: str
