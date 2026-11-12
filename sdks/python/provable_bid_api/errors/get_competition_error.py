from __future__ import annotations

from dataclasses import dataclass
from typing import Final, TypeAlias

from ..core import ErrorMapper, RawError, decode_json
from ..models.problem import Problem

GetCompetitionErrorBody: TypeAlias = Problem | RawError


@dataclass(frozen=True, slots=True)
class _GetCompetitionError:
    def map(self, status_code: int, content: bytes) -> GetCompetitionErrorBody:
        match status_code:
            case 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 503:
                return decode_json[Problem](content)
            case _:
                return RawError(status_code, content)


get_competition_error_mapper: Final[ErrorMapper[GetCompetitionErrorBody]] = _GetCompetitionError()
