from __future__ import annotations

from typing import TypeAlias

from ..response_format import ResponseFormat, ResponseFormatDict
from ..response_format1 import ResponseFormat1, ResponseFormat1Dict

ResponseFormat2: TypeAlias = ResponseFormat | ResponseFormat1

ResponseFormat2Dict: TypeAlias = ResponseFormatDict | ResponseFormat1Dict
