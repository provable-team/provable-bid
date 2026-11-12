from __future__ import annotations

from typing import Any, Literal

from pydantic import Field
from typing_extensions import NotRequired, TypedDict

from ..core import UNSET, Optional, SdkBaseModel


class ResponseFormat1(SdkBaseModel):
    type_: Literal["json"] = Field(default="json", alias="type")
    name: str
    description: Optional[str] = UNSET
    schema_value: Any = Field(alias="schema")


class ResponseFormat1Dict(TypedDict):
    type_: Literal["json"]
    name: str
    description: NotRequired[str]
    schema_value: Any
