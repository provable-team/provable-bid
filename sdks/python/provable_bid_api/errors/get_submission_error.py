from __future__ import annotations

from dataclasses import dataclass
from typing import Final, TypeAlias

from ..core import ErrorMapper, RawError, decode_json
from ..models.problem import Problem

GetSubmissionErrorBody: TypeAlias = Problem | RawError


@dataclass(frozen=True, slots=True)
class _GetSubmissionError:
    def map(self, status_code: int, content: bytes) -> GetSubmissionErrorBody:
        match status_code:
            case 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 503:
                return decode_json[Problem](content)
            case _:
                return RawError(status_code, content)


get_submission_error_mapper: Final[ErrorMapper[GetSubmissionErrorBody]] = _GetSubmissionError()
