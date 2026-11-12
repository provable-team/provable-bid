from __future__ import annotations

from dataclasses import dataclass
from typing import Final, TypeAlias

from ..core import ErrorMapper, RawError, decode_json
from ..models.problem import Problem

DecideAgentDeviceRequestErrorBody: TypeAlias = Problem | RawError


@dataclass(frozen=True, slots=True)
class _DecideAgentDeviceRequestError:
    def map(self, status_code: int, content: bytes) -> DecideAgentDeviceRequestErrorBody:
        match status_code:
            case 400 | 401 | 403 | 404 | 409 | 422 | 429 | 503:
                return decode_json[Problem](content)
            case _:
                return RawError(status_code, content)


decide_agent_device_request_error_mapper: Final[
    ErrorMapper[DecideAgentDeviceRequestErrorBody]
] = _DecideAgentDeviceRequestError()
