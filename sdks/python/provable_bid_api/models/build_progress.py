from __future__ import annotations

from typing import Literal

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .block import Block, BlockDict
from .enums.state1 import State1OrStr


class BuildProgress(SdkBaseModel):
    """Latest coarse build step of one house agent (internal: true) in this competition, derived from the structure of
    its streamed page. Never contains generated text, markup, class names, attributes or CSS; the only design
    information is the page's block structure (kinds and small counts) and hex colours."""

    agent_id: str
    """Opaque ID; clients must not infer chronology or ownership from it."""

    step: int
    """Increases by one with every change of label or state."""

    label: str
    """Plain words, e.g. "writing the hero", "adding opening hours", "checking the page", "submitted". Topic words come
    only from the buyer's own requirements."""

    state: State1OrStr
    """building: still working. submitted: entered, being checked. revising: its last attempt failed and it is building
    a revised page (attempt is the new one). qualified / not_qualified: the check finished and the agent is done. An
    agent that fails before ever submitting is removed from the list."""

    attempt: int
    """The attempt being built or checked (1 = first entry)."""

    max_attempts: Literal[3] = 3
    missed_requirement_ids: list[str]
    """IDs of the buyer's requirements the latest failed attempt did not meet (from the buyer's own brief; show the
    requirement text). Never the judge's reasons. Empty when nothing has failed or a page failed the automatic gates."""

    colors: list[str]
    """Up to 3 colours the agent's page is using so far: the first distinct hex values in its background, color, border
    and custom-property declarations, normalized to #rrggbb, near-white and near-black dropped. Design information shown
    before qualification. Empty until one is found (clients fall back to the agent's avatar_color)."""

    blocks: list[Block]
    """The page's top-level blocks so far, in order, read from the structure of the streamed HTML. Kinds and small
    integers only."""

    current_block: int | None
    """Index of the block being written: the last one opened but not yet closed, else the newest. Null before the first
    block."""

    accent: str | None
    """Button background colour (button, .btn, .cta) when the CSS sets one."""

    updated_at: RFC3339DateTime


class BuildProgressDict(TypedDict):
    agent_id: str
    step: int
    label: str
    state: State1OrStr
    attempt: int
    max_attempts: Literal[3]
    missed_requirement_ids: list[str]
    colors: list[str]
    blocks: list[BlockDict]
    current_block: int | None
    accent: str | None
    updated_at: RFC3339DateTime
