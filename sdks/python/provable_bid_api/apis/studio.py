from __future__ import annotations

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
from ..errors.get_studio_dashboard_error import GetStudioDashboardErrorBody, get_studio_dashboard_error_mapper
from ..errors.run_studio_ai_turn_error import RunStudioAiTurnErrorBody, run_studio_ai_turn_error_mapper
from ..errors.save_studio_dashboard_error import SaveStudioDashboardErrorBody, save_studio_dashboard_error_mapper
from ..models.studio_ai_turn import StudioAiTurn
from ..models.studio_ai_turn_request import StudioAiTurnRequest, StudioAiTurnRequestDict
from ..models.studio_dashboard import StudioDashboard
from ..models.studio_dashboard_save import StudioDashboardSave, StudioDashboardSaveDict
from ..models.studio_dashboard_saved import StudioDashboardSaved
from ..server.server import Server


class Studio:
    def __init__(self, client: RawClient, server: Server, auth: AuthSchemes) -> None:
        self._with_raw_response = StudioWithRawResponse(client, server, auth)

    def get_studio_dashboard(self, *, request_options: RequestOptionsOrDict | None = None) -> StudioDashboard:
        """Operator credential only. The AG Studio dashboard state this operator last saved, with its version. When
        nothing is saved, 200 with state null and version 0 (the page then shows the default layout).

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            The saved dashboard, or state null.

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
        return unwrap(self._with_raw_response.get_studio_dashboard(request_options=request_options))

    def run_studio_ai_turn(
        self,
        idempotency_key: str,
        body: StudioAiTurnRequest | StudioAiTurnRequestDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> StudioAiTurn:
        """Operator credential only; requires config.capabilities.studio_ai. Answers one model turn for AG Studio's
        Agent Framework running in the operator's browser: the agent loop and its tools run in the page, which resends
        the conversation with tool results for the next turn. The model is fixed server-side (Claude Haiku 5.5) and each
        turn is capped in output tokens. Rate-limited per operator (RATE_LIMITED, 429). Send a fresh Idempotency-Key per
        turn: a retry with the same key and body replays the answered turn instead of asking the model again.

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            The model's turn.

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
            self._with_raw_response.run_studio_ai_turn(idempotency_key, body, request_options=request_options)
        )

    def save_studio_dashboard(
        self,
        idempotency_key: str,
        body: StudioDashboardSave | StudioDashboardSaveDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> StudioDashboardSaved:
        """Operator credential only. Replaces the saved AG Studio dashboard state (layout, widgets, format; never data
        rows). version must equal the stored version (0 for the first save), else 409 INVALID_STATE: reload and save
        again. State larger than 200,000 bytes as JSON: 413 PAYLOAD_TOO_LARGE. Requires an Idempotency-Key: retrying the
        latest save with the same key and body returns its result again; the same key with a different body is 409
        IDEMPOTENCY_CONFLICT.

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Saved.

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
            self._with_raw_response.save_studio_dashboard(idempotency_key, body, request_options=request_options)
        )

    @property
    def with_raw_response(self) -> StudioWithRawResponse:
        return self._with_raw_response


class AsyncStudio:
    def __init__(self, client: AsyncRawClient, server: Server, auth: AsyncAuthSchemes) -> None:
        self._with_raw_response = AsyncStudioWithRawResponse(client, server, auth)

    async def get_studio_dashboard(self, *, request_options: RequestOptionsOrDict | None = None) -> StudioDashboard:
        """Operator credential only. The AG Studio dashboard state this operator last saved, with its version. When
        nothing is saved, 200 with state null and version 0 (the page then shows the default layout).

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            The saved dashboard, or state null.

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
        return unwrap(await self._with_raw_response.get_studio_dashboard(request_options=request_options))

    async def run_studio_ai_turn(
        self,
        idempotency_key: str,
        body: StudioAiTurnRequest | StudioAiTurnRequestDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> StudioAiTurn:
        """Operator credential only; requires config.capabilities.studio_ai. Answers one model turn for AG Studio's
        Agent Framework running in the operator's browser: the agent loop and its tools run in the page, which resends
        the conversation with tool results for the next turn. The model is fixed server-side (Claude Haiku 5.5) and each
        turn is capped in output tokens. Rate-limited per operator (RATE_LIMITED, 429). Send a fresh Idempotency-Key per
        turn: a retry with the same key and body replays the answered turn instead of asking the model again.

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            The model's turn.

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
            await self._with_raw_response.run_studio_ai_turn(idempotency_key, body, request_options=request_options)
        )

    async def save_studio_dashboard(
        self,
        idempotency_key: str,
        body: StudioDashboardSave | StudioDashboardSaveDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> StudioDashboardSaved:
        """Operator credential only. Replaces the saved AG Studio dashboard state (layout, widgets, format; never data
        rows). version must equal the stored version (0 for the first save), else 409 INVALID_STATE: reload and save
        again. State larger than 200,000 bytes as JSON: 413 PAYLOAD_TOO_LARGE. Requires an Idempotency-Key: retrying the
        latest save with the same key and body returns its result again; the same key with a different body is 409
        IDEMPOTENCY_CONFLICT.

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Saved.

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
            await self._with_raw_response.save_studio_dashboard(idempotency_key, body, request_options=request_options)
        )

    @property
    def with_raw_response(self) -> AsyncStudioWithRawResponse:
        return self._with_raw_response


class StudioWithRawResponse(SecuredRawResponse[RawClient, Server, AuthSchemes]):
    def get_studio_dashboard(
        self, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[StudioDashboard, GetStudioDashboardErrorBody]:
        """Operator credential only. The AG Studio dashboard state this operator last saved, with its version. When
        nothing is saved, 200 with state null and version 0 (the page then shows the default layout).

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="GET",
            url_template=self._server.default("/v1/operators/me/studio-dashboard"),
            auth_scheme=self._auth.bearer_auth,
            decoder=json_decoder[StudioDashboard],
            error_mapper=get_studio_dashboard_error_mapper,
            request_options=request_options,
        )

    def run_studio_ai_turn(
        self,
        idempotency_key: str,
        body: StudioAiTurnRequest | StudioAiTurnRequestDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> ApiResult[StudioAiTurn, RunStudioAiTurnErrorBody]:
        """Operator credential only; requires config.capabilities.studio_ai. Answers one model turn for AG Studio's
        Agent Framework running in the operator's browser: the agent loop and its tools run in the page, which resends
        the conversation with tool results for the next turn. The model is fixed server-side (Claude Haiku 5.5) and each
        turn is capped in output tokens. Rate-limited per operator (RATE_LIMITED, 429). Send a fresh Idempotency-Key per
        turn: a retry with the same key and body replays the answered turn instead of asking the model again.

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="POST",
            url_template=self._server.default("/v1/operators/me/studio-ai/turns"),
            headers=[param[str]("Idempotency-Key", idempotency_key)],
            body=json_body[StudioAiTurnRequest | StudioAiTurnRequestDict](body),
            auth_scheme=self._auth.bearer_auth,
            decoder=json_decoder[StudioAiTurn],
            error_mapper=run_studio_ai_turn_error_mapper,
            request_options=request_options,
        )

    def save_studio_dashboard(
        self,
        idempotency_key: str,
        body: StudioDashboardSave | StudioDashboardSaveDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> ApiResult[StudioDashboardSaved, SaveStudioDashboardErrorBody]:
        """Operator credential only. Replaces the saved AG Studio dashboard state (layout, widgets, format; never data
        rows). version must equal the stored version (0 for the first save), else 409 INVALID_STATE: reload and save
        again. State larger than 200,000 bytes as JSON: 413 PAYLOAD_TOO_LARGE. Requires an Idempotency-Key: retrying the
        latest save with the same key and body returns its result again; the same key with a different body is 409
        IDEMPOTENCY_CONFLICT.

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="PUT",
            url_template=self._server.default("/v1/operators/me/studio-dashboard"),
            headers=[param[str]("Idempotency-Key", idempotency_key)],
            body=json_body[StudioDashboardSave | StudioDashboardSaveDict](body),
            auth_scheme=self._auth.bearer_auth,
            decoder=json_decoder[StudioDashboardSaved],
            error_mapper=save_studio_dashboard_error_mapper,
            request_options=request_options,
        )


class AsyncStudioWithRawResponse(SecuredRawResponse[AsyncRawClient, Server, AsyncAuthSchemes]):
    async def get_studio_dashboard(
        self, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[StudioDashboard, GetStudioDashboardErrorBody]:
        """Operator credential only. The AG Studio dashboard state this operator last saved, with its version. When
        nothing is saved, 200 with state null and version 0 (the page then shows the default layout).

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="GET",
            url_template=self._server.default("/v1/operators/me/studio-dashboard"),
            auth_scheme=self._auth.bearer_auth,
            decoder=async_json_decoder[StudioDashboard],
            error_mapper=get_studio_dashboard_error_mapper,
            request_options=request_options,
        )

    async def run_studio_ai_turn(
        self,
        idempotency_key: str,
        body: StudioAiTurnRequest | StudioAiTurnRequestDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> ApiResult[StudioAiTurn, RunStudioAiTurnErrorBody]:
        """Operator credential only; requires config.capabilities.studio_ai. Answers one model turn for AG Studio's
        Agent Framework running in the operator's browser: the agent loop and its tools run in the page, which resends
        the conversation with tool results for the next turn. The model is fixed server-side (Claude Haiku 5.5) and each
        turn is capped in output tokens. Rate-limited per operator (RATE_LIMITED, 429). Send a fresh Idempotency-Key per
        turn: a retry with the same key and body replays the answered turn instead of asking the model again.

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="POST",
            url_template=self._server.default("/v1/operators/me/studio-ai/turns"),
            headers=[param[str]("Idempotency-Key", idempotency_key)],
            body=json_body[StudioAiTurnRequest | StudioAiTurnRequestDict](body),
            auth_scheme=self._auth.bearer_auth,
            decoder=async_json_decoder[StudioAiTurn],
            error_mapper=run_studio_ai_turn_error_mapper,
            request_options=request_options,
        )

    async def save_studio_dashboard(
        self,
        idempotency_key: str,
        body: StudioDashboardSave | StudioDashboardSaveDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> ApiResult[StudioDashboardSaved, SaveStudioDashboardErrorBody]:
        """Operator credential only. Replaces the saved AG Studio dashboard state (layout, widgets, format; never data
        rows). version must equal the stored version (0 for the first save), else 409 INVALID_STATE: reload and save
        again. State larger than 200,000 bytes as JSON: 413 PAYLOAD_TOO_LARGE. Requires an Idempotency-Key: retrying the
        latest save with the same key and body returns its result again; the same key with a different body is 409
        IDEMPOTENCY_CONFLICT.

        Args:
            idempotency_key: Unique logical command key; use the same key and body for network retries.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="PUT",
            url_template=self._server.default("/v1/operators/me/studio-dashboard"),
            headers=[param[str]("Idempotency-Key", idempotency_key)],
            body=json_body[StudioDashboardSave | StudioDashboardSaveDict](body),
            auth_scheme=self._auth.bearer_auth,
            decoder=async_json_decoder[StudioDashboardSaved],
            error_mapper=save_studio_dashboard_error_mapper,
            request_options=request_options,
        )
