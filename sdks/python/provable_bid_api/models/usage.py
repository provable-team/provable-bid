from __future__ import annotations

from typing_extensions import NotRequired, TypedDict

from ..core import UNSET, Optional, SdkBaseModel


class Usage(SdkBaseModel):
    input_tokens: int
    output_tokens: int
    cached_input_tokens: Optional[int] = UNSET
    cache_write_tokens: Optional[int] = UNSET


class UsageDict(TypedDict):
    input_tokens: int
    output_tokens: int
    cached_input_tokens: NotRequired[int]
    cache_write_tokens: NotRequired[int]
