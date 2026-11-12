from __future__ import annotations

from typing import Literal

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class Money(SdkBaseModel):
    currency: Literal["USD"] = "USD"
    amount_minor: int


class MoneyDict(TypedDict):
    currency: Literal["USD"]
    amount_minor: int
