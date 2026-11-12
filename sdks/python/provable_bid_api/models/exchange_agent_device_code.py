from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class ExchangeAgentDeviceCode(SdkBaseModel):
    device_code: str


class ExchangeAgentDeviceCodeDict(TypedDict):
    device_code: str
