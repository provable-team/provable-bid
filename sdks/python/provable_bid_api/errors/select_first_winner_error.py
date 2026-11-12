from __future__ import annotations

from dataclasses import dataclass
from typing import Final, TypeAlias

from ..core import ErrorMapper, RawError, decode_json
from ..models.problem import Problem

SelectFirstWinnerErrorBody: TypeAlias = Problem | RawError


@dataclass(frozen=True, slots=True)
class _SelectFirstWinnerError:
    def map(self, status_code: int, content: bytes) -> SelectFirstWinnerErrorBody:
        match status_code:
            case 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 503:
                return decode_json[Problem](content)
            case _:
                return RawError(status_code, content)


select_first_winner_error_mapper: Final[ErrorMapper[SelectFirstWinnerErrorBody]] = _SelectFirstWinnerError()
