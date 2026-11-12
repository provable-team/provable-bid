from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class AssistantQuestion(SdkBaseModel):
    question: str
    """A question about the operator's own earnings, payments or payouts."""


class AssistantQuestionDict(TypedDict):
    question: str
