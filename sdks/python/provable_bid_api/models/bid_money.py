from __future__ import annotations

from typing import Literal

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class BidMoney(SdkBaseModel):
    currency: Literal["USD"] = "USD"
    amount_minor: int
    """Price per selected entry, $10.00 to $5,000.00."""


class BidMoneyDict(TypedDict):
    currency: Literal["USD"]
    amount_minor: int
