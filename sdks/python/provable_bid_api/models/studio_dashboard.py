from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .state3 import State3, State3Dict


class StudioDashboard(SdkBaseModel):
    state: State3 | None
    """The saved state, or null when the operator has not saved a dashboard (use the default layout)."""

    version: int
    """Increases by one with every save; 0 when nothing is saved."""

    updated_at: RFC3339DateTime | None
    server_time: RFC3339DateTime


class StudioDashboardDict(TypedDict):
    state: State3Dict | None
    version: int
    updated_at: RFC3339DateTime | None
    server_time: RFC3339DateTime
