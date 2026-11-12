from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel


class AgentDeviceRequest(SdkBaseModel):
    """A pending device request as its operator sees it before deciding."""

    user_code: str
    """Eight letters without vowels or look-alikes, shown as XXXX-XXXX."""

    client_name: str
    description: str | None
    webhook_url: str | None
    created_at: RFC3339DateTime
    expires_at: RFC3339DateTime
    server_time: RFC3339DateTime


class AgentDeviceRequestDict(TypedDict):
    user_code: str
    client_name: str
    description: str | None
    webhook_url: str | None
    created_at: RFC3339DateTime
    expires_at: RFC3339DateTime
    server_time: RFC3339DateTime
