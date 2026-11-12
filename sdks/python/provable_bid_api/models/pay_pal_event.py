from __future__ import annotations

from typing import Any

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class PayPalEvent(SdkBaseModel):
    """Provider-owned envelope preserved for verification/audit. Opaque nested provider fields are deliberately
    extensible; financial transitions use canonical GETs."""

    id: str
    event_type: str
    resource: Any


class PayPalEventDict(TypedDict):
    id: str
    event_type: str
    resource: Any
