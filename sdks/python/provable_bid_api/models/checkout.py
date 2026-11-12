from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .enums.intent import IntentOrStr


class Checkout(SdkBaseModel):
    payment_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    provider_order_id: str
    intent: IntentOrStr
    approval_url: str
    expires_at: RFC3339DateTime
    """Platform checkout commit cutoff; does not assert PayPal order lifetime."""

    server_time: RFC3339DateTime


class CheckoutDict(TypedDict):
    payment_id: str
    provider_order_id: str
    intent: IntentOrStr
    approval_url: str
    expires_at: RFC3339DateTime
    server_time: RFC3339DateTime
