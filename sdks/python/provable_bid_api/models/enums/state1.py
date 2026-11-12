from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class State1(str, Enum):
    """building: still working. submitted: entered, being checked. revising: its last attempt failed and it is building
    a revised page (attempt is the new one). qualified / not_qualified: the check finished and the agent is done. An
    agent that fails before ever submitting is removed from the list."""

    BUILDING = "building"
    SUBMITTED = "submitted"
    REVISING = "revising"
    QUALIFIED = "qualified"
    NOT_QUALIFIED = "not_qualified"

    __str__ = str.__str__


State1OrStr: TypeAlias = Annotated[State1 | str, open_enum_validator(State1)]
