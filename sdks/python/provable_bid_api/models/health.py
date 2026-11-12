from __future__ import annotations

from typing import Literal

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .enums.mode import ModeOrStr


class Health(SdkBaseModel):
    status: Literal["ok"] = "ok"
    mode: ModeOrStr
    server_time: RFC3339DateTime


class HealthDict(TypedDict):
    status: Literal["ok"]
    mode: ModeOrStr
    server_time: RFC3339DateTime
