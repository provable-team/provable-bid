from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .state3 import State3, State3Dict


class StudioDashboardSave(SdkBaseModel):
    state: State3
    """AG Studio's serialized report state (AgReportState): pages with their widgets, widget layout and format. The
    server stores it as given and does not interpret Studio's schema; at most 200,000 bytes as JSON (413
    PAYLOAD_TOO_LARGE). It never holds data rows."""

    version: int
    """The version this save replaces: the version last read or saved, 0 when nothing is saved yet. 409 INVALID_STATE
    when the stored version differs (saved meanwhile from another window or device)."""


class StudioDashboardSaveDict(TypedDict):
    state: State3Dict
    version: int
