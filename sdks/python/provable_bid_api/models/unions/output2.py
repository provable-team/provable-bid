from __future__ import annotations

from typing import TypeAlias

from ..output import Output, OutputDict
from ..output1 import Output1, Output1Dict

Output2: TypeAlias = Output | Output1

Output2Dict: TypeAlias = OutputDict | Output1Dict
