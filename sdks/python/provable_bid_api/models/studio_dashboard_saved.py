from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel


class StudioDashboardSaved(SdkBaseModel):
    version: int
    updated_at: RFC3339DateTime
    server_time: RFC3339DateTime


class StudioDashboardSavedDict(TypedDict):
    version: int
    updated_at: RFC3339DateTime
    server_time: RFC3339DateTime
