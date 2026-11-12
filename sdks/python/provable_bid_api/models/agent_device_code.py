from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel


class AgentDeviceCode(SdkBaseModel):
    device_code: str
    """Secret. Keep it private to the agent; poll POST /v1/agent-device-tokens with it. Stored hashed."""

    user_code: str
    """Eight letters without vowels or look-alikes, shown as XXXX-XXXX."""

    verification_uri: str
    """Where the operator enters the user code (signed in with PayPal)."""

    verification_uri_complete: str
    """Same page with the code filled in; show it (or a QR code of it) to the operator."""

    expires_in: int
    """Seconds until the codes expire (600)."""

    interval: int
    """Minimum seconds between polls (5). After SLOW_DOWN, add 5 seconds."""

    server_time: RFC3339DateTime


class AgentDeviceCodeDict(TypedDict):
    device_code: str
    user_code: str
    verification_uri: str
    verification_uri_complete: str
    expires_in: int
    interval: int
    server_time: RFC3339DateTime
