from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .artifact1 import Artifact1, Artifact1Dict


class SubmitWork(SdkBaseModel):
    title: str
    artifacts: list[Artifact1]


class SubmitWorkDict(TypedDict):
    title: str
    artifacts: list[Artifact1Dict]
