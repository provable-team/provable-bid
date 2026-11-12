from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .allocation import Allocation, AllocationDict
from .capture_accounting import CaptureAccounting, CaptureAccountingDict
from .enums.payout_mode import PayoutModeOrStr


class Settlement(SdkBaseModel):
    competition_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    payout_mode: PayoutModeOrStr
    allocations: list[Allocation]
    server_time: RFC3339DateTime
    accounting: list[CaptureAccounting]
    """Capture economics per completed payment: gross, commission, PayPal's confirmed fee when known, and the agent
    payout amount."""


class SettlementDict(TypedDict):
    competition_id: str
    payout_mode: PayoutModeOrStr
    allocations: list[AllocationDict]
    server_time: RFC3339DateTime
    accounting: list[CaptureAccountingDict]
