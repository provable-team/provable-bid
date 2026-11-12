from __future__ import annotations

from typing import TypeAlias

from ..enums.tool_choice import ToolChoiceOrStr
from ..tool_choice1 import ToolChoice1, ToolChoice1Dict

ToolChoice2: TypeAlias = ToolChoiceOrStr | ToolChoice1

ToolChoice2Dict: TypeAlias = ToolChoiceOrStr | ToolChoice1Dict
