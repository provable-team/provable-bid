from __future__ import annotations

from typing import Literal

from pydantic import Field
from typing_extensions import NotRequired, TypedDict

from ..core import UNSET, Optional, SdkBaseModel


class StudioAiItem2(SdkBaseModel):
    type_: Literal["tool_result"] = Field(default="tool_result", alias="type")
    call_id: str
    output: str
    is_error: Optional[bool] = UNSET


class StudioAiItem2Dict(TypedDict):
    type_: Literal["tool_result"]
    call_id: str
    output: str
    is_error: NotRequired[bool]
