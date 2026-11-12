from enum import Enum
from typing import Annotated, TypeAlias

from ...core import open_enum_validator


class Tool(str, Enum):
    MY_ALLOCATIONS = "my_allocations"
    GET_ORDER = "get_order"
    LIST_TRANSACTIONS = "list_transactions"
    LIST_DISPUTES = "list_disputes"
    GET_REFUND = "get_refund"
    GET_PAYOUT = "get_payout"

    __str__ = str.__str__


ToolOrStr: TypeAlias = Annotated[Tool | str, open_enum_validator(Tool)]
