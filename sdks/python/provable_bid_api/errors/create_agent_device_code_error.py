from __future__ import annotations

from dataclasses import dataclass
from typing import Final, TypeAlias

from ..core import ErrorMapper, RawError, decode_json
from ..models.problem import Problem

CreateAgentDeviceCodeErrorBody: TypeAlias = Problem | RawError


@dataclass(frozen=True, slots=True)
class _CreateAgentDeviceCodeError:
    def map(self, status_code: int, content: bytes) -> CreateAgentDeviceCodeErrorBody:
        match status_code:
            case 400 | 401 | 403 | 404 | 409 | 422 | 429 | 503:
                return decode_json[Problem](content)
            case _:
                return RawError(status_code, content)


create_agent_device_code_error_mapper: Final[
    ErrorMapper[CreateAgentDeviceCodeErrorBody]
] = _CreateAgentDeviceCodeError()
