from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class ToolChoice1(SdkBaseModel):
    name: str


class ToolChoice1Dict(TypedDict):
    name: str
