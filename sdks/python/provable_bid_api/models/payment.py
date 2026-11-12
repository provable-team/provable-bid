from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .enums.authorization_state import AuthorizationStateOrStr
from .enums.capture_state import CaptureStateOrStr
from .enums.dispute_state import DisputeStateOrStr
from .enums.operation_state import OperationStateOrStr
from .enums.purpose import PurposeOrStr
from .enums.refund_state import RefundStateOrStr
from .enums.reversal_state import ReversalStateOrStr
from .money3 import Money3, Money3Dict


class Payment(SdkBaseModel):
    id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    competition_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    buyer_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    purpose: PurposeOrStr
    """initial changes to first_purchase when the winner is selected."""

    amount: Money3
    """Authorized/checkout amount: price + processing fee."""

    authorization_state: AuthorizationStateOrStr
    capture_state: CaptureStateOrStr
    """completed means provider-confirmed capture, not irreversible funds or payout."""

    operation_state: OperationStateOrStr
    operation_id: str | None
    """Stable logical financial command ID; internal operation journal retains all prior IDs."""

    provider_order_id: str | None
    provider_authorization_id: str | None
    provider_capture_id: str | None
    authorized_at: RFC3339DateTime | None
    """Provider-reported authorization creation time, never callback receipt, browser time, or restart time. Safety
    horizon and expiry derive from this origin."""

    authorization_expires_at: RFC3339DateTime | None
    captured_minor: int
    refunded_minor: int
    refund_state: RefundStateOrStr
    dispute_state: DisputeStateOrStr
    last_error_code: str | None
    created_at: RFC3339DateTime
    updated_at: RFC3339DateTime
    server_time: RFC3339DateTime
    reversal_state: ReversalStateOrStr
    """Independent from refunds/disputes. Pending reversal evidence creates a hold; confirmed reversal records the
    amount and reverses allocation. A completed capture GET cannot clear either state."""

    reversed_minor: int
    provider_expense_minor: int | None
    """Confirmed capture-processing expense only; null is unknown, not zero. Expenses are never charged above the agreed
    buyer price. Demo policy absorbs all provider expenses."""


class PaymentDict(TypedDict):
    id: str
    competition_id: str
    buyer_id: str
    purpose: PurposeOrStr
    amount: Money3Dict
    authorization_state: AuthorizationStateOrStr
    capture_state: CaptureStateOrStr
    operation_state: OperationStateOrStr
    operation_id: str | None
    provider_order_id: str | None
    provider_authorization_id: str | None
    provider_capture_id: str | None
    authorized_at: RFC3339DateTime | None
    authorization_expires_at: RFC3339DateTime | None
    captured_minor: int
    refunded_minor: int
    refund_state: RefundStateOrStr
    dispute_state: DisputeStateOrStr
    last_error_code: str | None
    created_at: RFC3339DateTime
    updated_at: RFC3339DateTime
    server_time: RFC3339DateTime
    reversal_state: ReversalStateOrStr
    reversed_minor: int
    provider_expense_minor: int | None
