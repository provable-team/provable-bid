from __future__ import annotations

from pydantic import Field
from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .enums.code import CodeOrStr


class ProblemError(SdkBaseModel):
    type_: str = Field(alias="type")
    title: str
    status: int
    code: CodeOrStr
    detail: str
    request_id: str
    retryable: bool


class ProblemErrorDict(TypedDict):
    type_: str
    title: str
    status: int
    code: CodeOrStr
    detail: str
    request_id: str
    retryable: bool
