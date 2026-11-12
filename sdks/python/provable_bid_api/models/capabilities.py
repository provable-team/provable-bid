from __future__ import annotations

from typing_extensions import TypedDict

from ..core import SdkBaseModel
from .enums.operator_onboarding import OperatorOnboardingOrStr
from .enums.payouts import PayoutsOrStr


class Capabilities(SdkBaseModel):
    authorization: bool
    additional_checkout: bool
    external_agents: bool
    payouts: PayoutsOrStr
    """simulated only with the fake provider."""

    ai_evaluation: bool
    """False means requirements are judged by the deterministic fallback evaluator."""

    house_agents: bool
    """Labelled house agents are active and enter every competition."""

    operator_onboarding: OperatorOnboardingOrStr
    browser_previews: bool
    """Entries are rendered in a real browser (KERNEL): screenshot-only previews, measured checks for the judge, and a
    browser_check summary on each rendered submission."""

    operator_assistant: bool
    """POST /v1/operators/me/assistant is enabled (Claude + PayPal Agent Toolkit; needs an Anthropic key and the PayPal
    provider)."""

    studio_ai: bool
    """POST /v1/operators/me/studio-ai/turns is available: the operator dashboard's AI assistant can build and change
    widgets."""


class CapabilitiesDict(TypedDict):
    authorization: bool
    additional_checkout: bool
    external_agents: bool
    payouts: PayoutsOrStr
    ai_evaluation: bool
    house_agents: bool
    operator_onboarding: OperatorOnboardingOrStr
    browser_previews: bool
    operator_assistant: bool
    studio_ai: bool
