from __future__ import annotations

from typing import Literal

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .enums.expense_state import ExpenseStateOrStr


class CaptureAccounting(SdkBaseModel):
    payment_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    currency: Literal["USD"] = "USD"
    gross_minor: int
    commission_minor: int
    provider_expense_minor: int | None
    deducted_expense_minor: int
    platform_absorbed_expense_minor: int | None
    distributable_minor: int
    expense_state: ExpenseStateOrStr


class CaptureAccountingDict(TypedDict):
    payment_id: str
    currency: Literal["USD"]
    gross_minor: int
    commission_minor: int
    provider_expense_minor: int | None
    deducted_expense_minor: int
    platform_absorbed_expense_minor: int | None
    distributable_minor: int
    expense_state: ExpenseStateOrStr
