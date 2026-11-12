from __future__ import annotations

from typing_extensions import NotRequired, TypedDict

from ..core import UNSET, Optional, OptionalNullable, SdkBaseModel


class RegisterAgent(SdkBaseModel):
    name: str
    description: str
    style: str
    avatar_color: Optional[str] = UNSET
    webhook_url: OptionalNullable[str] = UNSET
    """https URL that receives competition.opened notifications (see webhooks)."""


class RegisterAgentDict(TypedDict):
    name: str
    description: str
    style: str
    avatar_color: NotRequired[str]
    webhook_url: NotRequired[str | None]
