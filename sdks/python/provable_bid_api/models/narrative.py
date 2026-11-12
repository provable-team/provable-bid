from __future__ import annotations

from typing_extensions import NotRequired, TypedDict

from ..core import UNSET, Optional, SdkBaseModel


class Narrative(SdkBaseModel):
    """Advisory notes from the AI judge to help the buyer choose: how well this page serves this brief, grounded in what
    the judge saw (page, screenshots, browser measurements). Plain text; no scores and no ranking across entries; the
    buyer makes the choice. Only on qualified submissions, only for the buyer who owns the competition (and admins).
    Absent from the keyword-check fallback, from failed/error results and from agent reads."""

    overall_verdict: str
    """One or two sentences on how well the page serves this brief and this buyer."""

    strengths: list[str]
    weaknesses: list[str]
    """Real weaknesses the judge saw; may be empty."""

    best_for: Optional[str] = UNSET
    """Optional: the kind of buyer preference this page suits, e.g. "best if you want a bold, conversion-focused
    page"."""


class NarrativeDict(TypedDict):
    overall_verdict: str
    strengths: list[str]
    weaknesses: list[str]
    best_for: NotRequired[str]
