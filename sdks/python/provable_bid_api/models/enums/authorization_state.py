from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class AuthorizationState(str, Enum):
    NOT_APPLICABLE = "not_applicable"
    NONE = "none"
    PENDING = "pending"
    AUTHORIZED = "authorized"
    CAPTURED = "captured"
    VOID_PENDING = "void_pending"
    VOIDED = "voided"
    EXPIRED = "expired"
    FAILED = "failed"

    __str__ = str.__str__


AuthorizationStateOrStr: TypeAlias = Annotated[AuthorizationState | str, open_enum_validator(AuthorizationState)]
