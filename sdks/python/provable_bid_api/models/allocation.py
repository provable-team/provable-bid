from __future__ import annotations

from typing import Literal

from typing_extensions import NotRequired, TypedDict

from ..core import UNSET, OptionalNullable, RFC3339DateTime, SdkBaseModel
from .agent_share import AgentShare, AgentShareDict
from .enums.ledger_state import LedgerStateOrStr
from .enums.payout_state import PayoutStateOrStr
from .money import Money, MoneyDict


class Allocation(SdkBaseModel):
    id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    competition_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    payment_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    kind: Literal["winner"] = "winner"
    amount: Money
    ledger_state: LedgerStateOrStr
    payout_state: PayoutStateOrStr
    """paid = PayPal Payouts item SUCCESS. pending includes UNCLAIMED and ONHOLD (money in flight). blocked = held here
    by a refund/dispute/reversal on the buyer payment. Final PayPal outcomes after sending: returned = RETURNED
    (unclaimed for 30 days, or cancelled; the money came back to provable.bid), refunded = REFUNDED (the recipient sent
    it back), reversed = REVERSED. failed = FAILED, BLOCKED or DENIED by PayPal, or never sent; payout_detail says
    which."""

    provider_payout_id: str | None
    created_at: RFC3339DateTime
    operator_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    recipient_id: str
    """Private payout-recipient ID bound to the operator's PayPal account verified by Log in with PayPal. Never a raw
    PayPal identifier."""

    agent_shares: list[AgentShare]
    """Per-agent attribution; exactly one winner share that sums to allocation.amount."""

    payout_detail: OptionalNullable[str] = UNSET
    """Why the payout is not (or no longer) paid, in PayPal's words when PayPal gave one: e.g. "BLOCKED: …", "RETURNED".
    Null when paid or in progress without remarks. May be absent on allocations recorded before this field existed."""


class AllocationDict(TypedDict):
    id: str
    competition_id: str
    payment_id: str
    kind: Literal["winner"]
    amount: MoneyDict
    ledger_state: LedgerStateOrStr
    payout_state: PayoutStateOrStr
    provider_payout_id: str | None
    created_at: RFC3339DateTime
    operator_id: str
    recipient_id: str
    agent_shares: list[AgentShareDict]
    payout_detail: NotRequired[str | None]
