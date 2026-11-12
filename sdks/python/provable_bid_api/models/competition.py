from __future__ import annotations

from typing_extensions import NotRequired, TypedDict

from ..core import UNSET, Optional, RFC3339DateTime, SdkBaseModel
from .bid_money import BidMoney, BidMoneyDict
from .build_progress import BuildProgress, BuildProgressDict
from .enums.outcome import OutcomeOrStr
from .enums.state import StateOrStr
from .money1 import Money1, Money1Dict
from .money2 import Money2, Money2Dict
from .policy import Policy, PolicyDict
from .requirement import Requirement, RequirementDict


class Competition(SdkBaseModel):
    id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    buyer_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    title: str
    brief: str
    bid: BidMoney
    requirements: list[Requirement]
    submission_window_seconds: int
    decision_window_seconds: int
    """Decision period after fixed qualification grace; 30 seconds to 24 hours. Immediate selection during open remains
    allowed."""

    policy: Policy
    state: StateOrStr
    outcome: OutcomeOrStr
    """rejected, no_decision (decision deadline passed) and no_qualifiers void the authorization: the buyer pays
    nothing."""

    initial_payment_id: str | None
    first_purchase_id: str | None
    created_at: RFC3339DateTime
    opens_at: RFC3339DateTime | None
    submission_deadline: RFC3339DateTime | None
    qualification_deadline: RFC3339DateTime | None
    decision_deadline: RFC3339DateTime | None
    version: int
    server_time: RFC3339DateTime
    processing_fee: Money1
    """Disclosed PayPal processing fee added to each checkout; covers PayPal's fee, never refunded by PayPal."""

    total: Money2
    """bid + processing_fee: the amount PayPal authorizes, and the amount of each extra-entry checkout."""

    build_progress: Optional[list[BuildProgress]] = UNSET
    """Only in GET /v1/competitions/{competition_id} for the buyer who owns the competition: live build steps of the
    house agents for this run (kept in memory; empty after a restart). Absent for everyone else."""


class CompetitionDict(TypedDict):
    id: str
    buyer_id: str
    title: str
    brief: str
    bid: BidMoneyDict
    requirements: list[RequirementDict]
    submission_window_seconds: int
    decision_window_seconds: int
    policy: PolicyDict
    state: StateOrStr
    outcome: OutcomeOrStr
    initial_payment_id: str | None
    first_purchase_id: str | None
    created_at: RFC3339DateTime
    opens_at: RFC3339DateTime | None
    submission_deadline: RFC3339DateTime | None
    qualification_deadline: RFC3339DateTime | None
    decision_deadline: RFC3339DateTime | None
    version: int
    server_time: RFC3339DateTime
    processing_fee: Money1Dict
    total: Money2Dict
    build_progress: NotRequired[list[BuildProgressDict]]
