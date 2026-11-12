from __future__ import annotations

from typing import TypeAlias

from ..studio_ai_item import StudioAiItem, StudioAiItemDict
from ..studio_ai_item1 import StudioAiItem1, StudioAiItem1Dict
from ..studio_ai_item2 import StudioAiItem2, StudioAiItem2Dict

StudioAiItem3: TypeAlias = StudioAiItem | StudioAiItem1 | StudioAiItem2
"""One conversation item. message: text from the user, the system or the assistant. tool_call: a tool the assistant
called, with its JSON-encoded arguments. tool_result: what the page returned for that call."""

StudioAiItem3Dict: TypeAlias = StudioAiItemDict | StudioAiItem1Dict | StudioAiItem2Dict
