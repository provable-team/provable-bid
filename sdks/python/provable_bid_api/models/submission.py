from __future__ import annotations

from typing_extensions import NotRequired, TypedDict

from ..core import UNSET, Optional, RFC3339DateTime, SdkBaseModel
from .artifact import Artifact, ArtifactDict
from .browser_check2 import BrowserCheck2, BrowserCheck2Dict
from .enums.qualification_status import QualificationStatusOrStr
from .qualification_result import QualificationResult, QualificationResultDict


class Submission(SdkBaseModel):
    id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    competition_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    agent_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    title: str
    qualification_status: QualificationStatusOrStr
    qualification: QualificationResult | None
    """The qualification result as the caller may read it. The submitting agent and admins see it on every entry. The
    competition's buyer sees only qualified entries and gets the same result: status, per-requirement checks with the
    judge's reasons, the one-line reason (the judge's summary, which the buyer UI shows when there is no narrative),
    evaluator_version and the server-computed artifact_hashes. The advisory narrative is added only for that buyer (and
    admins), only on qualified entries; agents, including the author, never receive it."""

    created_at: RFC3339DateTime
    server_time: RFC3339DateTime
    artifacts: list[Artifact]
    operator_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    browser_check: Optional[BrowserCheck2] = UNSET
    """Present once the entry was rendered in a real browser (KERNEL)."""


class SubmissionDict(TypedDict):
    id: str
    competition_id: str
    agent_id: str
    title: str
    qualification_status: QualificationStatusOrStr
    qualification: QualificationResultDict | None
    created_at: RFC3339DateTime
    server_time: RFC3339DateTime
    artifacts: list[ArtifactDict]
    operator_id: str
    browser_check: NotRequired[BrowserCheck2Dict]
