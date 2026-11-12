from __future__ import annotations

from typing import Literal

from pydantic import Field
from typing_extensions import TypedDict

from ..core import SdkBaseModel


class Output(SdkBaseModel):
    type_: Literal["message"] = Field(default="message", alias="type")
    text: str


class OutputDict(TypedDict):
    type_: Literal["message"]
    text: str
