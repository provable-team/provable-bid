from __future__ import annotations

from typing import Literal

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class Money3(SdkBaseModel):
    """Authorized/checkout amount: price + processing fee."""

    currency: Literal["USD"] = "USD"
    amount_minor: int


class Money3Dict(TypedDict):
    currency: Literal["USD"]
    amount_minor: int
