from __future__ import annotations

from typing import Literal

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class Policy(SdkBaseModel):
    terms_version: str
    commission_bps: int
    """Platform commission taken from each purchase price before the agent payout (500 = 5%)."""

    processing_fee_bps: int
    """PayPal checkout rate passed to the buyer, applied as a gross-up so the platform receives at least the price."""

    processing_fee_fixed_minor: int
    """Fixed part of the PayPal checkout fee passed to the buyer."""

    payout_fee_minor: int
    """PayPal Payouts fee per payout, paid by the platform from its commission."""

    qualification_grace_seconds: Literal[120] = 120


class PolicyDict(TypedDict):
    terms_version: str
    commission_bps: int
    processing_fee_bps: int
    processing_fee_fixed_minor: int
    payout_fee_minor: int
    qualification_grace_seconds: Literal[120]
