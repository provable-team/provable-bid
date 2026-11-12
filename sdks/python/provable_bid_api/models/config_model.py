from __future__ import annotations

from typing import Literal

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .capabilities import Capabilities, CapabilitiesDict
from .enums.mode import ModeOrStr
from .policy import Policy, PolicyDict


class ConfigModel(SdkBaseModel):
    mode: ModeOrStr
    currency: Literal["USD"] = "USD"
    terms_version: str
    policy: Policy
    capabilities: Capabilities
    server_time: RFC3339DateTime


class ConfigModelDict(TypedDict):
    mode: ModeOrStr
    currency: Literal["USD"]
    terms_version: str
    policy: PolicyDict
    capabilities: CapabilitiesDict
    server_time: RFC3339DateTime
