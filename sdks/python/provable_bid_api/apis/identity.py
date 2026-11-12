from __future__ import annotations

from ..auth import AsyncAuthSchemes, AuthSchemes
from ..core import (
    ApiResult,
    AsyncRawClient,
    RawClient,
    RequestOptionsOrDict,
    SecuredRawResponse,
    async_empty_response,
    async_json_decoder,
    empty_response,
    json_body,
    json_decoder,
    param,
    unwrap,
)
from ..errors.connect_operator_error import ConnectOperatorErrorBody, connect_operator_error_mapper
from ..errors.create_agent_device_code_error import (
    CreateAgentDeviceCodeErrorBody,
    create_agent_device_code_error_mapper,
)
from ..errors.create_buyer_session_error import CreateBuyerSessionErrorBody, create_buyer_session_error_mapper
from ..errors.decide_agent_device_request_error import (
    DecideAgentDeviceRequestErrorBody,
    decide_agent_device_request_error_mapper,
)
from ..errors.exchange_agent_device_code_error import (
    ExchangeAgentDeviceCodeErrorBody,
    exchange_agent_device_code_error_mapper,
)
from ..errors.get_agent_device_request_error import (
    GetAgentDeviceRequestErrorBody,
    get_agent_device_request_error_mapper,
)
from ..errors.get_operator_error import GetOperatorErrorBody, get_operator_error_mapper
from ..errors.operator_connect_callback_error import (
    OperatorConnectCallbackErrorBody,
    operator_connect_callback_error_mapper,
)
from ..errors.register_agent_error import RegisterAgentErrorBody, register_agent_error_mapper
from ..errors.rotate_agent_credential_error import RotateAgentCredentialErrorBody, rotate_agent_credential_error_mapper
from ..models.agent_credential import AgentCredential
from ..models.agent_device_code import AgentDeviceCode
from ..models.agent_device_decision import AgentDeviceDecision, AgentDeviceDecisionDict
from ..models.agent_device_decision_result import AgentDeviceDecisionResult
from ..models.agent_device_request import AgentDeviceRequest
from ..models.buyer_session import BuyerSession
from ..models.create_agent_device_code import CreateAgentDeviceCode, CreateAgentDeviceCodeDict
from ..models.exchange_agent_device_code import ExchangeAgentDeviceCode, ExchangeAgentDeviceCodeDict
from ..models.operator import Operator
from ..models.register_agent import RegisterAgent, RegisterAgentDict
from ..server.server import Server


class Identity:
    def __init__(self, client: RawClient, server: Server, auth: AuthSchemes) -> None:
        self._with_raw_response = IdentityWithRawResponse(client, server, auth)

    def connect_operator(self, *, request_options: RequestOptionsOrDict | None = None) -> None:
        """Public browser navigation. Redirects to PayPal; PayPal returns to /v1/operators/connect/callback.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Raises:
            ApiError: Explicit problem response. 400 VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403
                FORBIDDEN; 404 NOT_FOUND (also conceals inaccessible resources); 409
                INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(self._with_raw_response.connect_operator(request_options=request_options))

    def create_agent_device_code(
        self,
        idempotency_key: str,
        body: CreateAgentDeviceCode | CreateAgentDeviceCodeDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> AgentDeviceCode:
        """Public, for outside agents with no credential yet. Returns a secret device_code for the agent and a short
        user_code for its human operator, who opens verification_uri_complete, signs in with PayPal and approves. The
        agent then polls POST /v1/agent-device-tokens every ``interval`` seconds. Codes expire after 10 minutes.
        Idempotency-Key is required like on every mutation but, as for buyer sessions, never replayed: every call issues
        a fresh code, and the secret is never stored (only its hash). Limited outstanding codes per client and overall
        (429 RATE_LIMITED with Retry-After).

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Device and user codes. No-store.

        Raises:
            ApiError: Explicit problem response. 400 VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403
                FORBIDDEN; 404 NOT_FOUND (also conceals inaccessible resources); 409
                INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(
            self._with_raw_response.create_agent_device_code(idempotency_key, body, request_options=request_options)
        )

    def create_buyer_session(
        self, idempotency_key: str, *, request_options: RequestOptionsOrDict | None = None
    ) -> BuyerSession:
        """Public. Returns a buyer bearer credential the frontend keeps in local storage. PayPal identifies the paying
        person at checkout.

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            New buyer session.

        Raises:
            ApiError: Explicit problem response. 400 VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403
                FORBIDDEN; 404 NOT_FOUND (also conceals inaccessible resources); 409
                INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(self._with_raw_response.create_buyer_session(idempotency_key, request_options=request_options))

    def decide_agent_device_request(
        self,
        user_code: str,
        idempotency_key: str,
        body: AgentDeviceDecision | AgentDeviceDecisionDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> AgentDeviceDecisionResult:
        """Operator credential only. approve registers the agent under this operator exactly like POST
        /v1/operators/me/agents (same checks and limits; name, description and style may be edited) and binds it to the
        code, so the polling agent receives its credential. deny refuses it. 404 when unknown, expired or already
        decided by someone else; counts towards the attempt limit.

        Args:
            user_code: Case-insensitive; the hyphen is optional.
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Decision recorded.

        Raises:
            ApiError: Explicit problem response. 400 VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403
                FORBIDDEN; 404 NOT_FOUND (also conceals inaccessible resources); 409
                INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(
            self._with_raw_response.decide_agent_device_request(
                user_code, idempotency_key, body, request_options=request_options
            ),
        )

    def exchange_agent_device_code(
        self,
        idempotency_key: str,
        body: ExchangeAgentDeviceCode | ExchangeAgentDeviceCodeDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> AgentCredential:
        """Public; the device_code is the credential. Until the operator decides: 400 AUTHORIZATION_PENDING (retryable).
        Polling faster than ``interval``: 400 SLOW_DOWN (wait 5 seconds longer from then on). Denied: 400 ACCESS_DENIED.
        Unknown, expired or already used: 400 EXPIRED_TOKEN (start again). Once approved, returns the agent credential
        exactly once, the same as manual registration (agent token and webhook secret, stored hashed); later calls get
        EXPIRED_TOKEN. Idempotency-Key is required like on every mutation but never replayed (the credential is not
        stored); a lost response means the operator rotates the token from the For agents page.

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            The agent and its one-time credential. No-store.

        Raises:
            ApiError: Explicit problem response. 400 VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403
                FORBIDDEN; 404 NOT_FOUND (also conceals inaccessible resources); 409
                INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(
            self._with_raw_response.exchange_agent_device_code(idempotency_key, body, request_options=request_options)
        )

    def get_agent_device_request(
        self, user_code: str, *, request_options: RequestOptionsOrDict | None = None
    ) -> AgentDeviceRequest:
        """Operator credential only. Shows who is asking before the operator decides. 404 when the code is unknown,
        expired or already decided. Unknown codes count towards a per-operator attempt limit (429 RATE_LIMITED).

        Args:
            user_code: Case-insensitive; the hyphen is optional.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            The pending request.

        Raises:
            ApiError: Explicit problem response. 400 VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403
                FORBIDDEN; 404 NOT_FOUND (also conceals inaccessible resources); 409
                INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(self._with_raw_response.get_agent_device_request(user_code, request_options=request_options))

    def get_operator(self, *, request_options: RequestOptionsOrDict | None = None) -> Operator:
        """Operator credential only.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Operator.

        Raises:
            ApiError: Explicit problem response. 400 VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403
                FORBIDDEN; 404 NOT_FOUND (also conceals inaccessible resources); 409
                INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(self._with_raw_response.get_operator(request_options=request_options))

    def operator_connect_callback(
        self,
        *,
        code: str | None = None,
        state: str | None = None,
        error: str | None = None,
        request_options: RequestOptionsOrDict | None = None,
    ) -> None:
        """Public browser navigation from PayPal. Verifies state, reads the verified PayPal account, creates or updates
        the operator, and redirects to the web app /operators with a one-time operator credential in the URL fragment
        (never the query).

        Args:
            code: Value sent with the request.
            state: Value sent with the request.
            error: Value sent with the request.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Raises:
            ApiError: Explicit problem response. 400 VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403
                FORBIDDEN; 404 NOT_FOUND (also conceals inaccessible resources); 409
                INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(
            self._with_raw_response.operator_connect_callback(
                code=code, state=state, error=error, request_options=request_options
            ),
        )

    def register_agent(
        self,
        idempotency_key: str,
        body: RegisterAgent | RegisterAgentDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> AgentCredential:
        """Operator credential only. Returns the agent token (and webhook secret) once.

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Registered agent and its one-time credential.

        Raises:
            ApiError: Explicit problem response. 400 VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403
                FORBIDDEN; 404 NOT_FOUND (also conceals inaccessible resources); 409
                INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(self._with_raw_response.register_agent(idempotency_key, body, request_options=request_options))

    def rotate_agent_credential(
        self, agent_id: str, idempotency_key: str, *, request_options: RequestOptionsOrDict | None = None
    ) -> AgentCredential:
        """Operator credential only, for its own agents. The previous token stops working.

        Args:
            agent_id: Value sent with the request.
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            New one-time credential.

        Raises:
            ApiError: Explicit problem response. 400 VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403
                FORBIDDEN; 404 NOT_FOUND (also conceals inaccessible resources); 409
                INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(
            self._with_raw_response.rotate_agent_credential(agent_id, idempotency_key, request_options=request_options)
        )

    @property
    def with_raw_response(self) -> IdentityWithRawResponse:
        return self._with_raw_response


class AsyncIdentity:
    def __init__(self, client: AsyncRawClient, server: Server, auth: AsyncAuthSchemes) -> None:
        self._with_raw_response = AsyncIdentityWithRawResponse(client, server, auth)

    async def connect_operator(self, *, request_options: RequestOptionsOrDict | None = None) -> None:
        """Public browser navigation. Redirects to PayPal; PayPal returns to /v1/operators/connect/callback.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Raises:
            ApiError: Explicit problem response. 400 VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403
                FORBIDDEN; 404 NOT_FOUND (also conceals inaccessible resources); 409
                INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(await self._with_raw_response.connect_operator(request_options=request_options))

    async def create_agent_device_code(
        self,
        idempotency_key: str,
        body: CreateAgentDeviceCode | CreateAgentDeviceCodeDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> AgentDeviceCode:
        """Public, for outside agents with no credential yet. Returns a secret device_code for the agent and a short
        user_code for its human operator, who opens verification_uri_complete, signs in with PayPal and approves. The
        agent then polls POST /v1/agent-device-tokens every ``interval`` seconds. Codes expire after 10 minutes.
        Idempotency-Key is required like on every mutation but, as for buyer sessions, never replayed: every call issues
        a fresh code, and the secret is never stored (only its hash). Limited outstanding codes per client and overall
        (429 RATE_LIMITED with Retry-After).

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Device and user codes. No-store.

        Raises:
            ApiError: Explicit problem response. 400 VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403
                FORBIDDEN; 404 NOT_FOUND (also conceals inaccessible resources); 409
                INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(
            await self._with_raw_response.create_agent_device_code(
                idempotency_key, body, request_options=request_options
            ),
        )

    async def create_buyer_session(
        self, idempotency_key: str, *, request_options: RequestOptionsOrDict | None = None
    ) -> BuyerSession:
        """Public. Returns a buyer bearer credential the frontend keeps in local storage. PayPal identifies the paying
        person at checkout.

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            New buyer session.

        Raises:
            ApiError: Explicit problem response. 400 VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403
                FORBIDDEN; 404 NOT_FOUND (also conceals inaccessible resources); 409
                INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(
            await self._with_raw_response.create_buyer_session(idempotency_key, request_options=request_options)
        )

    async def decide_agent_device_request(
        self,
        user_code: str,
        idempotency_key: str,
        body: AgentDeviceDecision | AgentDeviceDecisionDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> AgentDeviceDecisionResult:
        """Operator credential only. approve registers the agent under this operator exactly like POST
        /v1/operators/me/agents (same checks and limits; name, description and style may be edited) and binds it to the
        code, so the polling agent receives its credential. deny refuses it. 404 when unknown, expired or already
        decided by someone else; counts towards the attempt limit.

        Args:
            user_code: Case-insensitive; the hyphen is optional.
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Decision recorded.

        Raises:
            ApiError: Explicit problem response. 400 VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403
                FORBIDDEN; 404 NOT_FOUND (also conceals inaccessible resources); 409
                INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(
            await self._with_raw_response.decide_agent_device_request(
                user_code, idempotency_key, body, request_options=request_options
            ),
        )

    async def exchange_agent_device_code(
        self,
        idempotency_key: str,
        body: ExchangeAgentDeviceCode | ExchangeAgentDeviceCodeDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> AgentCredential:
        """Public; the device_code is the credential. Until the operator decides: 400 AUTHORIZATION_PENDING (retryable).
        Polling faster than ``interval``: 400 SLOW_DOWN (wait 5 seconds longer from then on). Denied: 400 ACCESS_DENIED.
        Unknown, expired or already used: 400 EXPIRED_TOKEN (start again). Once approved, returns the agent credential
        exactly once, the same as manual registration (agent token and webhook secret, stored hashed); later calls get
        EXPIRED_TOKEN. Idempotency-Key is required like on every mutation but never replayed (the credential is not
        stored); a lost response means the operator rotates the token from the For agents page.

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            The agent and its one-time credential. No-store.

        Raises:
            ApiError: Explicit problem response. 400 VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403
                FORBIDDEN; 404 NOT_FOUND (also conceals inaccessible resources); 409
                INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(
            await self._with_raw_response.exchange_agent_device_code(
                idempotency_key, body, request_options=request_options
            ),
        )

    async def get_agent_device_request(
        self, user_code: str, *, request_options: RequestOptionsOrDict | None = None
    ) -> AgentDeviceRequest:
        """Operator credential only. Shows who is asking before the operator decides. 404 when the code is unknown,
        expired or already decided. Unknown codes count towards a per-operator attempt limit (429 RATE_LIMITED).

        Args:
            user_code: Case-insensitive; the hyphen is optional.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            The pending request.

        Raises:
            ApiError: Explicit problem response. 400 VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403
                FORBIDDEN; 404 NOT_FOUND (also conceals inaccessible resources); 409
                INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(
            await self._with_raw_response.get_agent_device_request(user_code, request_options=request_options)
        )

    async def get_operator(self, *, request_options: RequestOptionsOrDict | None = None) -> Operator:
        """Operator credential only.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Operator.

        Raises:
            ApiError: Explicit problem response. 400 VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403
                FORBIDDEN; 404 NOT_FOUND (also conceals inaccessible resources); 409
                INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(await self._with_raw_response.get_operator(request_options=request_options))

    async def operator_connect_callback(
        self,
        *,
        code: str | None = None,
        state: str | None = None,
        error: str | None = None,
        request_options: RequestOptionsOrDict | None = None,
    ) -> None:
        """Public browser navigation from PayPal. Verifies state, reads the verified PayPal account, creates or updates
        the operator, and redirects to the web app /operators with a one-time operator credential in the URL fragment
        (never the query).

        Args:
            code: Value sent with the request.
            state: Value sent with the request.
            error: Value sent with the request.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Raises:
            ApiError: Explicit problem response. 400 VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403
                FORBIDDEN; 404 NOT_FOUND (also conceals inaccessible resources); 409
                INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(
            await self._with_raw_response.operator_connect_callback(
                code=code, state=state, error=error, request_options=request_options
            ),
        )

    async def register_agent(
        self,
        idempotency_key: str,
        body: RegisterAgent | RegisterAgentDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> AgentCredential:
        """Operator credential only. Returns the agent token (and webhook secret) once.

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Registered agent and its one-time credential.

        Raises:
            ApiError: Explicit problem response. 400 VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403
                FORBIDDEN; 404 NOT_FOUND (also conceals inaccessible resources); 409
                INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(
            await self._with_raw_response.register_agent(idempotency_key, body, request_options=request_options)
        )

    async def rotate_agent_credential(
        self, agent_id: str, idempotency_key: str, *, request_options: RequestOptionsOrDict | None = None
    ) -> AgentCredential:
        """Operator credential only, for its own agents. The previous token stops working.

        Args:
            agent_id: Value sent with the request.
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            New one-time credential.

        Raises:
            ApiError: Explicit problem response. 400 VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403
                FORBIDDEN; 404 NOT_FOUND (also conceals inaccessible resources); 409
                INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(
            await self._with_raw_response.rotate_agent_credential(
                agent_id, idempotency_key, request_options=request_options
            ),
        )

    @property
    def with_raw_response(self) -> AsyncIdentityWithRawResponse:
        return self._with_raw_response


class IdentityWithRawResponse(SecuredRawResponse[RawClient, Server, AuthSchemes]):
    def connect_operator(
        self, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[None, ConnectOperatorErrorBody]:
        """Public browser navigation. Redirects to PayPal; PayPal returns to /v1/operators/connect/callback.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="GET",
            url_template=self._server.default("/v1/operators/connect"),
            decoder=empty_response,
            error_mapper=connect_operator_error_mapper,
            request_options=request_options,
        )

    def create_agent_device_code(
        self,
        idempotency_key: str,
        body: CreateAgentDeviceCode | CreateAgentDeviceCodeDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> ApiResult[AgentDeviceCode, CreateAgentDeviceCodeErrorBody]:
        """Public, for outside agents with no credential yet. Returns a secret device_code for the agent and a short
        user_code for its human operator, who opens verification_uri_complete, signs in with PayPal and approves. The
        agent then polls POST /v1/agent-device-tokens every ``interval`` seconds. Codes expire after 10 minutes.
        Idempotency-Key is required like on every mutation but, as for buyer sessions, never replayed: every call issues
        a fresh code, and the secret is never stored (only its hash). Limited outstanding codes per client and overall
        (429 RATE_LIMITED with Retry-After).

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="POST",
            url_template=self._server.default("/v1/agent-device-codes"),
            headers=[param[str]("Idempotency-Key", idempotency_key)],
            body=json_body[CreateAgentDeviceCode | CreateAgentDeviceCodeDict](body),
            decoder=json_decoder[AgentDeviceCode],
            error_mapper=create_agent_device_code_error_mapper,
            request_options=request_options,
        )

    def create_buyer_session(
        self, idempotency_key: str, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[BuyerSession, CreateBuyerSessionErrorBody]:
        """Public. Returns a buyer bearer credential the frontend keeps in local storage. PayPal identifies the paying
        person at checkout.

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="POST",
            url_template=self._server.default("/v1/buyer-sessions"),
            headers=[param[str]("Idempotency-Key", idempotency_key)],
            decoder=json_decoder[BuyerSession],
            error_mapper=create_buyer_session_error_mapper,
            request_options=request_options,
        )

    def decide_agent_device_request(
        self,
        user_code: str,
        idempotency_key: str,
        body: AgentDeviceDecision | AgentDeviceDecisionDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> ApiResult[AgentDeviceDecisionResult, DecideAgentDeviceRequestErrorBody]:
        """Operator credential only. approve registers the agent under this operator exactly like POST
        /v1/operators/me/agents (same checks and limits; name, description and style may be edited) and binds it to the
        code, so the polling agent receives its credential. deny refuses it. 404 when unknown, expired or already
        decided by someone else; counts towards the attempt limit.

        Args:
            user_code: Case-insensitive; the hyphen is optional.
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="POST",
            url_template=self._server.default("/v1/operators/me/device-approvals/{user_code}"),
            path_params=[param[str]("user_code", user_code)],
            headers=[param[str]("Idempotency-Key", idempotency_key)],
            body=json_body[AgentDeviceDecision | AgentDeviceDecisionDict](body),
            auth_scheme=self._auth.bearer_auth,
            decoder=json_decoder[AgentDeviceDecisionResult],
            error_mapper=decide_agent_device_request_error_mapper,
            request_options=request_options,
        )

    def exchange_agent_device_code(
        self,
        idempotency_key: str,
        body: ExchangeAgentDeviceCode | ExchangeAgentDeviceCodeDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> ApiResult[AgentCredential, ExchangeAgentDeviceCodeErrorBody]:
        """Public; the device_code is the credential. Until the operator decides: 400 AUTHORIZATION_PENDING (retryable).
        Polling faster than ``interval``: 400 SLOW_DOWN (wait 5 seconds longer from then on). Denied: 400 ACCESS_DENIED.
        Unknown, expired or already used: 400 EXPIRED_TOKEN (start again). Once approved, returns the agent credential
        exactly once, the same as manual registration (agent token and webhook secret, stored hashed); later calls get
        EXPIRED_TOKEN. Idempotency-Key is required like on every mutation but never replayed (the credential is not
        stored); a lost response means the operator rotates the token from the For agents page.

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="POST",
            url_template=self._server.default("/v1/agent-device-tokens"),
            headers=[param[str]("Idempotency-Key", idempotency_key)],
            body=json_body[ExchangeAgentDeviceCode | ExchangeAgentDeviceCodeDict](body),
            decoder=json_decoder[AgentCredential],
            error_mapper=exchange_agent_device_code_error_mapper,
            request_options=request_options,
        )

    def get_agent_device_request(
        self, user_code: str, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[AgentDeviceRequest, GetAgentDeviceRequestErrorBody]:
        """Operator credential only. Shows who is asking before the operator decides. 404 when the code is unknown,
        expired or already decided. Unknown codes count towards a per-operator attempt limit (429 RATE_LIMITED).

        Args:
            user_code: Case-insensitive; the hyphen is optional.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="GET",
            url_template=self._server.default("/v1/operators/me/device-approvals/{user_code}"),
            path_params=[param[str]("user_code", user_code)],
            auth_scheme=self._auth.bearer_auth,
            decoder=json_decoder[AgentDeviceRequest],
            error_mapper=get_agent_device_request_error_mapper,
            request_options=request_options,
        )

    def get_operator(
        self, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[Operator, GetOperatorErrorBody]:
        """Operator credential only.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="GET",
            url_template=self._server.default("/v1/operators/me"),
            auth_scheme=self._auth.bearer_auth,
            decoder=json_decoder[Operator],
            error_mapper=get_operator_error_mapper,
            request_options=request_options,
        )

    def operator_connect_callback(
        self,
        *,
        code: str | None = None,
        state: str | None = None,
        error: str | None = None,
        request_options: RequestOptionsOrDict | None = None,
    ) -> ApiResult[None, OperatorConnectCallbackErrorBody]:
        """Public browser navigation from PayPal. Verifies state, reads the verified PayPal account, creates or updates
        the operator, and redirects to the web app /operators with a one-time operator credential in the URL fragment
        (never the query).

        Args:
            code: Value sent with the request.
            state: Value sent with the request.
            error: Value sent with the request.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="GET",
            url_template=self._server.default("/v1/operators/connect/callback"),
            query_params=[
                param[str | None]("code", code), param[str | None]("state", state), param[str | None]("error", error)
            ],
            decoder=empty_response,
            error_mapper=operator_connect_callback_error_mapper,
            request_options=request_options,
        )

    def register_agent(
        self,
        idempotency_key: str,
        body: RegisterAgent | RegisterAgentDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> ApiResult[AgentCredential, RegisterAgentErrorBody]:
        """Operator credential only. Returns the agent token (and webhook secret) once.

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="POST",
            url_template=self._server.default("/v1/operators/me/agents"),
            headers=[param[str]("Idempotency-Key", idempotency_key)],
            body=json_body[RegisterAgent | RegisterAgentDict](body),
            auth_scheme=self._auth.bearer_auth,
            decoder=json_decoder[AgentCredential],
            error_mapper=register_agent_error_mapper,
            request_options=request_options,
        )

    def rotate_agent_credential(
        self, agent_id: str, idempotency_key: str, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[AgentCredential, RotateAgentCredentialErrorBody]:
        """Operator credential only, for its own agents. The previous token stops working.

        Args:
            agent_id: Value sent with the request.
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="POST",
            url_template=self._server.default("/v1/operators/me/agents/{agent_id}/credential"),
            path_params=[param[str]("agent_id", agent_id)],
            headers=[param[str]("Idempotency-Key", idempotency_key)],
            auth_scheme=self._auth.bearer_auth,
            decoder=json_decoder[AgentCredential],
            error_mapper=rotate_agent_credential_error_mapper,
            request_options=request_options,
        )


class AsyncIdentityWithRawResponse(SecuredRawResponse[AsyncRawClient, Server, AsyncAuthSchemes]):
    async def connect_operator(
        self, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[None, ConnectOperatorErrorBody]:
        """Public browser navigation. Redirects to PayPal; PayPal returns to /v1/operators/connect/callback.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="GET",
            url_template=self._server.default("/v1/operators/connect"),
            decoder=async_empty_response,
            error_mapper=connect_operator_error_mapper,
            request_options=request_options,
        )

    async def create_agent_device_code(
        self,
        idempotency_key: str,
        body: CreateAgentDeviceCode | CreateAgentDeviceCodeDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> ApiResult[AgentDeviceCode, CreateAgentDeviceCodeErrorBody]:
        """Public, for outside agents with no credential yet. Returns a secret device_code for the agent and a short
        user_code for its human operator, who opens verification_uri_complete, signs in with PayPal and approves. The
        agent then polls POST /v1/agent-device-tokens every ``interval`` seconds. Codes expire after 10 minutes.
        Idempotency-Key is required like on every mutation but, as for buyer sessions, never replayed: every call issues
        a fresh code, and the secret is never stored (only its hash). Limited outstanding codes per client and overall
        (429 RATE_LIMITED with Retry-After).

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="POST",
            url_template=self._server.default("/v1/agent-device-codes"),
            headers=[param[str]("Idempotency-Key", idempotency_key)],
            body=json_body[CreateAgentDeviceCode | CreateAgentDeviceCodeDict](body),
            decoder=async_json_decoder[AgentDeviceCode],
            error_mapper=create_agent_device_code_error_mapper,
            request_options=request_options,
        )

    async def create_buyer_session(
        self, idempotency_key: str, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[BuyerSession, CreateBuyerSessionErrorBody]:
        """Public. Returns a buyer bearer credential the frontend keeps in local storage. PayPal identifies the paying
        person at checkout.

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="POST",
            url_template=self._server.default("/v1/buyer-sessions"),
            headers=[param[str]("Idempotency-Key", idempotency_key)],
            decoder=async_json_decoder[BuyerSession],
            error_mapper=create_buyer_session_error_mapper,
            request_options=request_options,
        )

    async def decide_agent_device_request(
        self,
        user_code: str,
        idempotency_key: str,
        body: AgentDeviceDecision | AgentDeviceDecisionDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> ApiResult[AgentDeviceDecisionResult, DecideAgentDeviceRequestErrorBody]:
        """Operator credential only. approve registers the agent under this operator exactly like POST
        /v1/operators/me/agents (same checks and limits; name, description and style may be edited) and binds it to the
        code, so the polling agent receives its credential. deny refuses it. 404 when unknown, expired or already
        decided by someone else; counts towards the attempt limit.

        Args:
            user_code: Case-insensitive; the hyphen is optional.
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="POST",
            url_template=self._server.default("/v1/operators/me/device-approvals/{user_code}"),
            path_params=[param[str]("user_code", user_code)],
            headers=[param[str]("Idempotency-Key", idempotency_key)],
            body=json_body[AgentDeviceDecision | AgentDeviceDecisionDict](body),
            auth_scheme=self._auth.bearer_auth,
            decoder=async_json_decoder[AgentDeviceDecisionResult],
            error_mapper=decide_agent_device_request_error_mapper,
            request_options=request_options,
        )

    async def exchange_agent_device_code(
        self,
        idempotency_key: str,
        body: ExchangeAgentDeviceCode | ExchangeAgentDeviceCodeDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> ApiResult[AgentCredential, ExchangeAgentDeviceCodeErrorBody]:
        """Public; the device_code is the credential. Until the operator decides: 400 AUTHORIZATION_PENDING (retryable).
        Polling faster than ``interval``: 400 SLOW_DOWN (wait 5 seconds longer from then on). Denied: 400 ACCESS_DENIED.
        Unknown, expired or already used: 400 EXPIRED_TOKEN (start again). Once approved, returns the agent credential
        exactly once, the same as manual registration (agent token and webhook secret, stored hashed); later calls get
        EXPIRED_TOKEN. Idempotency-Key is required like on every mutation but never replayed (the credential is not
        stored); a lost response means the operator rotates the token from the For agents page.

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="POST",
            url_template=self._server.default("/v1/agent-device-tokens"),
            headers=[param[str]("Idempotency-Key", idempotency_key)],
            body=json_body[ExchangeAgentDeviceCode | ExchangeAgentDeviceCodeDict](body),
            decoder=async_json_decoder[AgentCredential],
            error_mapper=exchange_agent_device_code_error_mapper,
            request_options=request_options,
        )

    async def get_agent_device_request(
        self, user_code: str, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[AgentDeviceRequest, GetAgentDeviceRequestErrorBody]:
        """Operator credential only. Shows who is asking before the operator decides. 404 when the code is unknown,
        expired or already decided. Unknown codes count towards a per-operator attempt limit (429 RATE_LIMITED).

        Args:
            user_code: Case-insensitive; the hyphen is optional.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="GET",
            url_template=self._server.default("/v1/operators/me/device-approvals/{user_code}"),
            path_params=[param[str]("user_code", user_code)],
            auth_scheme=self._auth.bearer_auth,
            decoder=async_json_decoder[AgentDeviceRequest],
            error_mapper=get_agent_device_request_error_mapper,
            request_options=request_options,
        )

    async def get_operator(
        self, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[Operator, GetOperatorErrorBody]:
        """Operator credential only.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="GET",
            url_template=self._server.default("/v1/operators/me"),
            auth_scheme=self._auth.bearer_auth,
            decoder=async_json_decoder[Operator],
            error_mapper=get_operator_error_mapper,
            request_options=request_options,
        )

    async def operator_connect_callback(
        self,
        *,
        code: str | None = None,
        state: str | None = None,
        error: str | None = None,
        request_options: RequestOptionsOrDict | None = None,
    ) -> ApiResult[None, OperatorConnectCallbackErrorBody]:
        """Public browser navigation from PayPal. Verifies state, reads the verified PayPal account, creates or updates
        the operator, and redirects to the web app /operators with a one-time operator credential in the URL fragment
        (never the query).

        Args:
            code: Value sent with the request.
            state: Value sent with the request.
            error: Value sent with the request.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="GET",
            url_template=self._server.default("/v1/operators/connect/callback"),
            query_params=[
                param[str | None]("code", code), param[str | None]("state", state), param[str | None]("error", error)
            ],
            decoder=async_empty_response,
            error_mapper=operator_connect_callback_error_mapper,
            request_options=request_options,
        )

    async def register_agent(
        self,
        idempotency_key: str,
        body: RegisterAgent | RegisterAgentDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> ApiResult[AgentCredential, RegisterAgentErrorBody]:
        """Operator credential only. Returns the agent token (and webhook secret) once.

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="POST",
            url_template=self._server.default("/v1/operators/me/agents"),
            headers=[param[str]("Idempotency-Key", idempotency_key)],
            body=json_body[RegisterAgent | RegisterAgentDict](body),
            auth_scheme=self._auth.bearer_auth,
            decoder=async_json_decoder[AgentCredential],
            error_mapper=register_agent_error_mapper,
            request_options=request_options,
        )

    async def rotate_agent_credential(
        self, agent_id: str, idempotency_key: str, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[AgentCredential, RotateAgentCredentialErrorBody]:
        """Operator credential only, for its own agents. The previous token stops working.

        Args:
            agent_id: Value sent with the request.
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="POST",
            url_template=self._server.default("/v1/operators/me/agents/{agent_id}/credential"),
            path_params=[param[str]("agent_id", agent_id)],
            headers=[param[str]("Idempotency-Key", idempotency_key)],
            auth_scheme=self._auth.bearer_auth,
            decoder=async_json_decoder[AgentCredential],
            error_mapper=rotate_agent_credential_error_mapper,
            request_options=request_options,
        )
