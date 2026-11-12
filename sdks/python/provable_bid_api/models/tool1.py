from __future__ import annotations

from typing import Any

from typing_extensions import TypedDict

from ..core import SdkBaseModel


class Tool1(SdkBaseModel):
    name: str
    description: str
    parameters: Any
    """JSON Schema of the tool input (from Studio)."""


class Tool1Dict(TypedDict):
    name: str
    description: str
    parameters: Any
