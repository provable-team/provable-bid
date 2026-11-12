from __future__ import annotations

from dataclasses import dataclass
from typing import Final, TypeAlias

from ..core import ErrorMapper, RawError, decode_json
from ..models.problem import Problem

CreateBuyerSessionErrorBody: TypeAlias = Problem | RawError


@dataclass(frozen=True, slots=True)
class _CreateBuyerSessionError:
    def map(self, status_code: int, content: bytes) -> CreateBuyerSessionErrorBody:
        match status_code:
            case 400 | 401 | 403 | 404 | 409 | 422 | 429 | 503:
                return decode_json[Problem](content)
            case _:
                return RawError(status_code, content)


create_buyer_session_error_mapper: Final[ErrorMapper[CreateBuyerSessionErrorBody]] = _CreateBuyerSessionError()
