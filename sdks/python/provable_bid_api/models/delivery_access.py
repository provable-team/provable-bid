from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .artifact2 import Artifact2, Artifact2Dict


class DeliveryAccess(SdkBaseModel):
    artifacts: list[Artifact2]
    expires_at: RFC3339DateTime
    server_time: RFC3339DateTime


class DeliveryAccessDict(TypedDict):
    artifacts: list[Artifact2Dict]
    expires_at: RFC3339DateTime
    server_time: RFC3339DateTime
