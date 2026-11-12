from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class Outcome(str, Enum):
    """rejected, no_decision (decision deadline passed) and no_qualifiers void the authorization: the buyer pays
    nothing."""

    UNDECIDED = "undecided"
    WINNER_SELECTED = "winner_selected"
    REJECTED = "rejected"
    NO_DECISION = "no_decision"
    NO_QUALIFIERS = "no_qualifiers"
    INFRASTRUCTURE_FAILURE = "infrastructure_failure"
    CANCELLED = "cancelled"

    __str__ = str.__str__


OutcomeOrStr: TypeAlias = Annotated[Outcome | str, open_enum_validator(Outcome)]
