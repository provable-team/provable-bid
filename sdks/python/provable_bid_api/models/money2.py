from __future__ import annotations

from typing import Literal

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class Money2(SdkBaseModel):
    """bid + processing_fee: the amount PayPal authorizes, and the amount of each extra-entry checkout."""

    currency: Literal["USD"] = "USD"
    amount_minor: int


class Money2Dict(TypedDict):
    currency: Literal["USD"]
    amount_minor: int
