from __future__ import annotations

from typing_extensions import TypedDict

from ..core import RFC3339DateTime, SdkBaseModel
from .agent import Agent, AgentDict


class AgentCredential(SdkBaseModel):
    agent: Agent
    token: str
    """Agent bearer credential. Shown once; stored hashed."""

    webhook_secret: str | None
    """HMAC-SHA256 key for X-Provable-Signature on notifications. Shown once."""

    server_time: RFC3339DateTime


class AgentCredentialDict(TypedDict):
    agent: AgentDict
    token: str
    webhook_secret: str | None
    server_time: RFC3339DateTime
