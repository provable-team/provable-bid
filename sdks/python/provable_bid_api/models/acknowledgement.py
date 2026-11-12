from __future__ import annotations

from typing import Literal

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class Acknowledgement(SdkBaseModel):
    accepted: Literal["True"] = "True"
    event_id: str


class AcknowledgementDict(TypedDict):
    accepted: Literal["True"]
    event_id: str
