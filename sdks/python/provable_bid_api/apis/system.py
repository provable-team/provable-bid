from __future__ import annotations

from ..core import (
    ApiResult,
    AsyncRawClient,
    BaseRawResponse,
    RawClient,
    RequestOptionsOrDict,
    async_json_decoder,
    json_decoder,
    unwrap,
)
from ..errors.get_config_error import GetConfigErrorBody, get_config_error_mapper
from ..errors.get_health_error import GetHealthErrorBody, get_health_error_mapper
from ..models.config_model import ConfigModel
from ..models.health import Health
from ..server.server import Server


class System:
    def __init__(self, client: RawClient, server: Server) -> None:
        self._with_raw_response = SystemWithRawResponse(client, server)

    def get_config(self, *, request_options: RequestOptionsOrDict | None = None) -> ConfigModel:
        """Read capabilities and immutable policy defaults.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Capabilities and policy.

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
        return unwrap(self._with_raw_response.get_config(request_options=request_options))

    def get_health(self, *, request_options: RequestOptionsOrDict | None = None) -> Health:
        """Read service health and current server time.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Server health.

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
        return unwrap(self._with_raw_response.get_health(request_options=request_options))

    @property
    def with_raw_response(self) -> SystemWithRawResponse:
        return self._with_raw_response


class AsyncSystem:
    def __init__(self, client: AsyncRawClient, server: Server) -> None:
        self._with_raw_response = AsyncSystemWithRawResponse(client, server)

    async def get_config(self, *, request_options: RequestOptionsOrDict | None = None) -> ConfigModel:
        """Read capabilities and immutable policy defaults.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Capabilities and policy.

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
        return unwrap(await self._with_raw_response.get_config(request_options=request_options))

    async def get_health(self, *, request_options: RequestOptionsOrDict | None = None) -> Health:
        """Read service health and current server time.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Server health.

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
        return unwrap(await self._with_raw_response.get_health(request_options=request_options))

    @property
    def with_raw_response(self) -> AsyncSystemWithRawResponse:
        return self._with_raw_response


class SystemWithRawResponse(BaseRawResponse[RawClient, Server]):
    def get_config(
        self, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[ConfigModel, GetConfigErrorBody]:
        """Read capabilities and immutable policy defaults.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="GET",
            url_template=self._server.default("/v1/config"),
            decoder=json_decoder[ConfigModel],
            error_mapper=get_config_error_mapper,
            request_options=request_options,
        )

    def get_health(
        self, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[Health, GetHealthErrorBody]:
        """Read service health and current server time.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="GET",
            url_template=self._server.default("/health"),
            decoder=json_decoder[Health],
            error_mapper=get_health_error_mapper,
            request_options=request_options,
        )


class AsyncSystemWithRawResponse(BaseRawResponse[AsyncRawClient, Server]):
    async def get_config(
        self, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[ConfigModel, GetConfigErrorBody]:
        """Read capabilities and immutable policy defaults.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="GET",
            url_template=self._server.default("/v1/config"),
            decoder=async_json_decoder[ConfigModel],
            error_mapper=get_config_error_mapper,
            request_options=request_options,
        )

    async def get_health(
        self, *, request_options: RequestOptionsOrDict | None = None
    ) -> ApiResult[Health, GetHealthErrorBody]:
        """Read service health and current server time.

        Args:
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="GET",
            url_template=self._server.default("/health"),
            decoder=async_json_decoder[Health],
            error_mapper=get_health_error_mapper,
            request_options=request_options,
        )
