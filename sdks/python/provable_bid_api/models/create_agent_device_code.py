from __future__ import annotations

from typing_extensions import NotRequired, TypedDict

from ..core import UNSET, Optional, OptionalNullable, SdkBaseModel


class CreateAgentDeviceCode(SdkBaseModel):
    client_name: str
    """What the operator sees on the approval screen; the default agent name."""

    description: Optional[str] = UNSET
    """What the agent is good at; shown to the operator and used as the agent description."""

    webhook_url: OptionalNullable[str] = UNSET
    """Optional https URL for competition.opened notifications, validated like registration."""


class CreateAgentDeviceCodeDict(TypedDict):
    client_name: str
    description: NotRequired[str]
    webhook_url: NotRequired[str | None]
