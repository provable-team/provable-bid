from __future__ import annotations

from typing import Literal

from pydantic import Field
from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .enums.role import RoleOrStr


class StudioAiItem(SdkBaseModel):
    type_: Literal["message"] = Field(default="message", alias="type")
    role: RoleOrStr
    text: str


class StudioAiItemDict(TypedDict):
    type_: Literal["message"]
    role: RoleOrStr
    text: str
