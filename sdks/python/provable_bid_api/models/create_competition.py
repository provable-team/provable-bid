from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .bid_money import BidMoney, BidMoneyDict
from .requirement import Requirement, RequirementDict


class CreateCompetition(SdkBaseModel):
    title: str
    brief: str
    bid: BidMoney
    submission_window_seconds: int
    """5, 15 or 60 minutes. Allowed values: 300, 900, 3600."""

    decision_window_seconds: int
    """Decision period after fixed qualification grace; 30 seconds to 24 hours. Immediate selection during open remains
    allowed."""

    requirements: list[Requirement]
    """IDs must be unique. Each is a checkable statement about the page, e.g. "Has a pricing section with three tiers".
    Frozen at creation."""

    accepted_terms_version: str


class CreateCompetitionDict(TypedDict):
    title: str
    brief: str
    bid: BidMoneyDict
    submission_window_seconds: int
    decision_window_seconds: int
    requirements: list[RequirementDict]
    accepted_terms_version: str
