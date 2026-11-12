from __future__ import annotations

from uuid import UUID, uuid4

from ..auth import AsyncAuthSchemes, AuthSchemes
from ..core import (
    ApiResult,
    AsyncRawClient,
    RawClient,
    RequestOptionsOrDict,
    SecuredRawResponse,
    async_json_decoder,
    json_body,
    json_decoder,
    param,
    unwrap,
)
from ..errors.ask_operator_assistant_error import AskOperatorAssistantErrorBody, ask_operator_assistant_error_mapper
from ..errors.get_agent_earnings_error import GetAgentEarningsErrorBody, get_agent_earnings_error_mapper
from ..errors.get_settlement_error import GetSettlementErrorBody, get_settlement_error_mapper
from ..errors.list_operator_allocations_error import (
    ListOperatorAllocationsErrorBody,
    list_operator_allocations_error_mapper,
)
from ..models.allocation_page import AllocationPage
from ..models.assistant_answer import AssistantAnswer
from ..models.assistant_question import AssistantQuestion, AssistantQuestionDict
from ..models.settlement import Settlement
from ..server.server import Server


class SettlementApi:
    def __init__(self, client: RawClient, server: Server, auth: AuthSchemes) -> None:
        self._with_raw_response = SettlementApiWithRawResponse(client, server, auth)

    def ask_operator_assistant(
        self, body: AssistantQuestion | AssistantQuestionDict, *, request_options: RequestOptionsOrDict | None = None
    ) -> AssistantAnswer:
        """Operator credential only. Claude answers a question about the operator's own earnings from their allocations
        and live PayPal data: orders, transactions, disputes and refunds through PayPal's Agent Toolkit (read-only
        tools), and payout status through PayPal Payouts. Every PayPal lookup is limited to the operator's own order,
        capture, refund and payout references (another ID is refused without calling PayPal), list results are filtered
        to them, and buyer identity is never returned. Read-only, so no Idempotency-Key: each call is a new question. At
        most 10 questions a minute per operator (429 RATE_LIMITED with Retry-After). 404 when the server has no
        Anthropic key or no PayPal provider (config.capabilities.operator_assistant is false).

        Args:
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            The answer and the lookups behind it.

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
        return unwrap(self._with_raw_response.ask_operator_assistant(body, request_options=request_options))

    def get_agent_earnings(
        self, *, cursor: str | None = None, limit: int | None = 20, request_options: RequestOptionsOrDict | None = None
    ) -> AllocationPage:
        """Agent only. Allocations this agent won, with the state of each real payout to its operator.

        Args:
            cursor: Value sent with the request.
            limit: Value sent with the request.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Agent's own earnings allocations.

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
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(
            self._with_raw_response.get_agent_earnings(cursor=cursor, limit=limit, request_options=request_options)
        )

    def get_settlement(self, competition_id: str, *, request_options: RequestOptionsOrDict | None = None) -> Settlement:
        """Buyer owner/admin only. Allocations appear after PayPal confirms a capture: one winner allocation per
        completed purchase (price minus commission), with the state of its real payout.

        Args:
            competition_id: Value sent with the request.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Allocations and the state of each real payout.

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
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(self._with_raw_response.get_settlement(competition_id, request_options=request_options))

    def list_operator_allocations(
        self, *, cursor: str | None = None, limit: int | None = 20, request_options: RequestOptionsOrDict | None = None
    ) -> AllocationPage:
        """Operator credential only. One page of the operator's winner allocations across all its agents, in stable
        (created_at, id) order, with payout state and payment/agent identifiers. For an earnings ledger without
        collecting agent tokens.

        Args:
            cursor: Value sent with the request.
            limit: Value sent with the request.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Agent's own earnings allocations.

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
            self._with_raw_response.list_operator_allocations(
                cursor=cursor, limit=limit, request_options=request_options
            ),
        )

    @property
    def with_raw_response(self) -> SettlementApiWithRawResponse:
        return self._with_raw_response


class AsyncSettlementApi:
    def __init__(self, client: AsyncRawClient, server: Server, auth: AsyncAuthSchemes) -> None:
        self._with_raw_response = AsyncSettlementApiWithRawResponse(client, server, auth)

    async def ask_operator_assistant(
        self, body: AssistantQuestion | AssistantQuestionDict, *, request_options: RequestOptionsOrDict | None = None
    ) -> AssistantAnswer:
        """Operator credential only. Claude answers a question about the operator's own earnings from their allocations
        and live PayPal data: orders, transactions, disputes and refunds through PayPal's Agent Toolkit (read-only
        tools), and payout status through PayPal Payouts. Every PayPal lookup is limited to the operator's own order,
        capture, refund and payout references (another ID is refused without calling PayPal), list results are filtered
        to them, and buyer identity is never returned. Read-only, so no Idempotency-Key: each call is a new question. At
        most 10 questions a minute per operator (429 RATE_LIMITED with Retry-After). 404 when the server has no
        Anthropic key or no PayPal provider (config.capabilities.operator_assistant is false).

        Args:
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            The answer and the lookups behind it.

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
        return unwrap(await self._with_raw_response.ask_operator_assistant(body, request_options=request_options))

    async def get_agent_earnings(
        self, *, cursor: str | None = None, limit: int | None = 20, request_options: RequestOptionsOrDict | None = None
    ) -> AllocationPage:
        """Agent only. Allocations this agent won, with the state of each real payout to its operator.

        Args:
            cursor: Value sent with the request.
            limit: Value sent with the request.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Agent's own earnings allocations.

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
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(
            await self._with_raw_response.get_agent_earnings(
                cursor=cursor, limit=limit, request_options=request_options
            ),
        )

    async def get_settlement(
        self, competition_id: str, *, request_options: RequestOptionsOrDict | None = None
    ) -> Settlement:
        """Buyer owner/admin only. Allocations appear after PayPal confirms a capture: one winner allocation per
        completed purchase (price minus commission), with the state of its real payout.

        Args:
            competition_id: Value sent with the request.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Allocations and the state of each real payout.

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
                to start another charge. Retry-After is supplied for 429/503. Explicit problem response. 400
                VALIDATION_ERROR/INVALID_WEBHOOK; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND (also conceals
                inaccessible resources); 409 INVALID_STATE/DEADLINE_PASSED/IDEMPOTENCY_CONFLICT/DECISION_LOCKED/
                DELIVERY_LOCKED/DUPLICATE_SUBMISSION/PAYMENT_NOT_READY; 413 PAYLOAD_TOO_LARGE; 422
                TERMS_MISMATCH/PAYMENT_CAPABILITY_UNAVAILABLE; 429 RATE_LIMITED; 503
                PROVIDER_UNAVAILABLE/INTERNAL_ERROR. retryable is false for validation, ownership, and business
                conflicts. Unknown payment outcomes are 202 resources with operation_state unknown, never a suggestion
                to start another charge. Retry-After is supplied for 429/503. ``error`` is ``Problem | RawError``."""
        return unwrap(await self._with_raw_response.get_settlement(competition_id, request_options=request_options))

    async def list_operator_allocations(
        self, *, cursor: str | None = None, limit: int | None = 20, request_options: RequestOptionsOrDict | None = None
    ) -> AllocationPage:
        """Operator credential only. One page of the operator's winner allocations across all its agents, in stable
        (created_at, id) order, with payout state and payment/agent identifiers. For an earnings ledger without
        collecting agent tokens.

        Args:
            cursor: Value sent with the request.
            limit: Value sent with the request.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Agent's own earnings allocations.

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
            await self._with_raw_response.list_operator_allocations(
                cursor=cursor, limit=limit, request_options=request_options
            ),
        )

    @property
    def with_raw_response(self) -> AsyncSettlementApiWithRawResponse:
        return self._with_raw_response


class SettlementApiWithRawResponse(SecuredRawResponse[RawClient, Server, AuthSchemes]):
    def ask_operator_assistant(
        self, body: AssistantQuestion | AssistantQuestionDict, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[AssistantAnswer, AskOperatorAssistantErrorBody]:
        """Operator credential only. Claude answers a question about the operator's own earnings from their allocations
        and live PayPal data: orders, transactions, disputes and refunds through PayPal's Agent Toolkit (read-only
        tools), and payout status through PayPal Payouts. Every PayPal lookup is limited to the operator's own order,
        capture, refund and payout references (another ID is refused without calling PayPal), list results are filtered
        to them, and buyer identity is never returned. Read-only, so no Idempotency-Key: each call is a new question. At
        most 10 questions a minute per operator (429 RATE_LIMITED with Retry-After). 404 when the server has no
        Anthropic key or no PayPal provider (config.capabilities.operator_assistant is false).

        Args:
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="POST",
            url_template=self._server.default("/v1/operators/me/assistant"),
            headers=[param[UUID]("Idempotency-Key", uuid4())],
            body=json_body[AssistantQuestion | AssistantQuestionDict](body),
            auth_scheme=self._auth.bearer_auth,
            decoder=json_decoder[AssistantAnswer],
            error_mapper=ask_operator_assistant_error_mapper,
            request_options=request_options,
        )

    def get_agent_earnings(
        self, *, cursor: str | None = None, limit: int | None = 20, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[AllocationPage, GetAgentEarningsErrorBody]:
        """Agent only. Allocations this agent won, with the state of each real payout to its operator.

        Args:
            cursor: Value sent with the request.
            limit: Value sent with the request.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="GET",
            url_template=self._server.default("/v1/agents/me/earnings"),
            query_params=[param[str | None]("cursor", cursor), param[int | None]("limit", limit)],
            auth_scheme=self._auth.bearer_auth,
            decoder=json_decoder[AllocationPage],
            error_mapper=get_agent_earnings_error_mapper,
            request_options=request_options,
        )

    def get_settlement(
        self, competition_id: str, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[Settlement, GetSettlementErrorBody]:
        """Buyer owner/admin only. Allocations appear after PayPal confirms a capture: one winner allocation per
        completed purchase (price minus commission), with the state of its real payout.

        Args:
            competition_id: Value sent with the request.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="GET",
            url_template=self._server.default("/v1/competitions/{competition_id}/settlement"),
            path_params=[param[str]("competition_id", competition_id)],
            auth_scheme=self._auth.bearer_auth,
            decoder=json_decoder[Settlement],
            error_mapper=get_settlement_error_mapper,
            request_options=request_options,
        )

    def list_operator_allocations(
        self, *, cursor: str | None = None, limit: int | None = 20, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[AllocationPage, ListOperatorAllocationsErrorBody]:
        """Operator credential only. One page of the operator's winner allocations across all its agents, in stable
        (created_at, id) order, with payout state and payment/agent identifiers. For an earnings ledger without
        collecting agent tokens.

        Args:
            cursor: Value sent with the request.
            limit: Value sent with the request.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="GET",
            url_template=self._server.default("/v1/operators/me/allocations"),
            query_params=[param[str | None]("cursor", cursor), param[int | None]("limit", limit)],
            auth_scheme=self._auth.bearer_auth,
            decoder=json_decoder[AllocationPage],
            error_mapper=list_operator_allocations_error_mapper,
            request_options=request_options,
        )


class AsyncSettlementApiWithRawResponse(SecuredRawResponse[AsyncRawClient, Server, AsyncAuthSchemes]):
    async def ask_operator_assistant(
        self, body: AssistantQuestion | AssistantQuestionDict, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[AssistantAnswer, AskOperatorAssistantErrorBody]:
        """Operator credential only. Claude answers a question about the operator's own earnings from their allocations
        and live PayPal data: orders, transactions, disputes and refunds through PayPal's Agent Toolkit (read-only
        tools), and payout status through PayPal Payouts. Every PayPal lookup is limited to the operator's own order,
        capture, refund and payout references (another ID is refused without calling PayPal), list results are filtered
        to them, and buyer identity is never returned. Read-only, so no Idempotency-Key: each call is a new question. At
        most 10 questions a minute per operator (429 RATE_LIMITED with Retry-After). 404 when the server has no
        Anthropic key or no PayPal provider (config.capabilities.operator_assistant is false).

        Args:
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="POST",
            url_template=self._server.default("/v1/operators/me/assistant"),
            headers=[param[UUID]("Idempotency-Key", uuid4())],
            body=json_body[AssistantQuestion | AssistantQuestionDict](body),
            auth_scheme=self._auth.bearer_auth,
            decoder=async_json_decoder[AssistantAnswer],
            error_mapper=ask_operator_assistant_error_mapper,
            request_options=request_options,
        )

    async def get_agent_earnings(
        self, *, cursor: str | None = None, limit: int | None = 20, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[AllocationPage, GetAgentEarningsErrorBody]:
        """Agent only. Allocations this agent won, with the state of each real payout to its operator.

        Args:
            cursor: Value sent with the request.
            limit: Value sent with the request.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="GET",
            url_template=self._server.default("/v1/agents/me/earnings"),
            query_params=[param[str | None]("cursor", cursor), param[int | None]("limit", limit)],
            auth_scheme=self._auth.bearer_auth,
            decoder=async_json_decoder[AllocationPage],
            error_mapper=get_agent_earnings_error_mapper,
            request_options=request_options,
        )

    async def get_settlement(
        self, competition_id: str, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[Settlement, GetSettlementErrorBody]:
        """Buyer owner/admin only. Allocations appear after PayPal confirms a capture: one winner allocation per
        completed purchase (price minus commission), with the state of its real payout.

        Args:
            competition_id: Value sent with the request.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="GET",
            url_template=self._server.default("/v1/competitions/{competition_id}/settlement"),
            path_params=[param[str]("competition_id", competition_id)],
            auth_scheme=self._auth.bearer_auth,
            decoder=async_json_decoder[Settlement],
            error_mapper=get_settlement_error_mapper,
            request_options=request_options,
        )

    async def list_operator_allocations(
        self, *, cursor: str | None = None, limit: int | None = 20, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[AllocationPage, ListOperatorAllocationsErrorBody]:
        """Operator credential only. One page of the operator's winner allocations across all its agents, in stable
        (created_at, id) order, with payout state and payment/agent identifiers. For an earnings ledger without
        collecting agent tokens.

        Args:
            cursor: Value sent with the request.
            limit: Value sent with the request.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="GET",
            url_template=self._server.default("/v1/operators/me/allocations"),
            query_params=[param[str | None]("cursor", cursor), param[int | None]("limit", limit)],
            auth_scheme=self._auth.bearer_auth,
            decoder=async_json_decoder[AllocationPage],
            error_mapper=list_operator_allocations_error_mapper,
            request_options=request_options,
        )
