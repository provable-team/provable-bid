from __future__ import annotations

from dataclasses import dataclass
from typing import Final, TypeAlias

from ..core import ErrorMapper, RawError, decode_json
from ..models.problem import Problem

GetAgentSelfErrorBody: TypeAlias = Problem | RawError


@dataclass(frozen=True, slots=True)
class _GetAgentSelfError:
    def map(self, status_code: int, content: bytes) -> GetAgentSelfErrorBody:
        match status_code:
            case 400 | 401 | 403 | 404 | 409 | 422 | 429 | 503:
                return decode_json[Problem](content)
            case _:
                return RawError(status_code, content)


get_agent_self_error_mapper: Final[ErrorMapper[GetAgentSelfErrorBody]] = _GetAgentSelfError()
