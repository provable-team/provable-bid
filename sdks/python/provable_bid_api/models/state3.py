from __future__ import annotations

from typing import Any

from pydantic import Field
from typing_extensions import NotRequired, TypedDict

from ..core import UNSET, Optional, SdkBaseModel


class State3(SdkBaseModel):
    """AG Studio's serialized report state (AgReportState): pages with their widgets, widget layout and format. The
    server stores it as given and does not interpret Studio's schema; at most 200,000 bytes as JSON (413
    PAYLOAD_TOO_LARGE). It never holds data rows."""

    pages: list[Any]
    selected_page_id: Optional[str] = Field(default=UNSET, alias="selectedPageId")


class State3Dict(TypedDict):
    pages: list[Any]
    selected_page_id: NotRequired[str]
