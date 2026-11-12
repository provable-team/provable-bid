from __future__ import annotations

from typing import Literal

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class Money1(SdkBaseModel):
    """Disclosed PayPal processing fee added to each checkout; covers PayPal's fee, never refunded by PayPal."""

    currency: Literal["USD"] = "USD"
    amount_minor: int


class Money1Dict(TypedDict):
    currency: Literal["USD"]
    amount_minor: int
