from __future__ import annotations

from typing_extensions import NotRequired, TypedDict

from ..core import UNSET, Optional, SdkBaseModel
from .enums.kind import KindOrStr


class Block(SdkBaseModel):
    kind: KindOrStr
    columns: Optional[int] = UNSET
    """section: repeated direct children such as cards."""

    items: Optional[int] = UNSET
    """faq: questions; form: fields; table: rows."""

    fill: Optional[str] = UNSET
    """Background colour the CSS gives this block (header/.hero, nav, footer), when it can be determined."""


class BlockDict(TypedDict):
    kind: KindOrStr
    columns: NotRequired[int]
    items: NotRequired[int]
    fill: NotRequired[str]
