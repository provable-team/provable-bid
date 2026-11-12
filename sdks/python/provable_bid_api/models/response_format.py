from __future__ import annotations

from typing import Literal

from pydantic import Field
from typing_extensions import TypedDict

from ..core import SdkBaseModel


class ResponseFormat(SdkBaseModel):
    type_: Literal["text"] = Field(default="text", alias="type")


class ResponseFormatDict(TypedDict):
    type_: Literal["text"]
