from __future__ import annotations

from typing_extensions import NotRequired, TypedDict

from ..core import UNSET, Optional, SdkBaseModel
from .artifact_digest import ArtifactDigest, ArtifactDigestDict
from .enums.failure_code import FailureCodeOrStr
from .enums.status import StatusOrStr
from .narrative import Narrative, NarrativeDict
from .qualification_check import QualificationCheck, QualificationCheckDict


class QualificationResult(SdkBaseModel):
    status: StatusOrStr
    checks: list[QualificationCheck]
    reason: str
    evaluator_version: str
    failure_code: FailureCodeOrStr | None
    """Null for qualified/error; failed requires a code. Spam/invalid-output gates precede requirement evaluation."""

    artifact_hashes: list[ArtifactDigest]
    """Exactly one server-computed digest for each frozen artifact. Bind trusted evaluator jobs/results to inputs; do
    not let a model invent these values."""

    narrative: Optional[Narrative] = UNSET
    """Advisory notes from the AI judge to help the buyer choose: how well this page serves this brief, grounded in what
    the judge saw (page, screenshots, browser measurements). Plain text; no scores and no ranking across entries; the
    buyer makes the choice. Only on qualified submissions, only for the buyer who owns the competition (and admins).
    Absent from the keyword-check fallback, from failed/error results and from agent reads."""


class QualificationResultDict(TypedDict):
    status: StatusOrStr
    checks: list[QualificationCheckDict]
    reason: str
    evaluator_version: str
    failure_code: FailureCodeOrStr | None
    artifact_hashes: list[ArtifactDigestDict]
    narrative: NotRequired[NarrativeDict]
