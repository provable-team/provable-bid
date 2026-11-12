from __future__ import annotations

from uuid import UUID, uuid4

from ..core import (
    ApiResult,
    AsyncRawClient,
    BaseRawResponse,
    RawClient,
    RequestOptionsOrDict,
    RFC3339DateTime,
    async_json_decoder,
    json_body,
    json_decoder,
    param,
    unwrap,
)
from ..errors.receive_pay_pal_webhook_error import ReceivePayPalWebhookErrorBody, receive_pay_pal_webhook_error_mapper
from ..models.acknowledgement import Acknowledgement
from ..models.pay_pal_event import PayPalEvent, PayPalEventDict
from ..server.server import Server


class Webhooks:
    def __init__(self, client: RawClient, server: Server) -> None:
        self._with_raw_response = WebhooksWithRawResponse(client, server)

    def receive_pay_pal_webhook(
        self,
        paypal_transmission_id: str,
        paypal_transmission_time: RFC3339DateTime,
        paypal_transmission_sig: str,
        paypal_cert_url: str,
        paypal_auth_algo: str,
        body: PayPalEvent | PayPalEventDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> Acknowledgement:
        """No bearer auth. Verify raw bytes and all transmission headers against stored webhook ID/environment; event ID
        alone is not authentication. Deduplicate event ID, enqueue canonical GET reconciliation, then acknowledge 200.
        Invalid signatures return 400; persistence/verification availability failures return 503 to retry. Unknown
        verified events are acknowledged without financial effects. Never rely on browser callbacks or delivery order.
        Local mock requires exact mock headers.

        Args:
            paypal_transmission_id: Value sent with the request.
            paypal_transmission_time: Value sent with the request.
            paypal_transmission_sig: Value sent with the request.
            paypal_cert_url: Value sent with the request.
            paypal_auth_algo: Value sent with the request.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Verified event durably accepted or previously recorded.

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
            self._with_raw_response.receive_pay_pal_webhook(
                paypal_transmission_id,
                paypal_transmission_time,
                paypal_transmission_sig,
                paypal_cert_url,
                paypal_auth_algo,
                body,
                request_options=request_options,
            ),
        )

    @property
    def with_raw_response(self) -> WebhooksWithRawResponse:
        return self._with_raw_response


class AsyncWebhooks:
    def __init__(self, client: AsyncRawClient, server: Server) -> None:
        self._with_raw_response = AsyncWebhooksWithRawResponse(client, server)

    async def receive_pay_pal_webhook(
        self,
        paypal_transmission_id: str,
        paypal_transmission_time: RFC3339DateTime,
        paypal_transmission_sig: str,
        paypal_cert_url: str,
        paypal_auth_algo: str,
        body: PayPalEvent | PayPalEventDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> Acknowledgement:
        """No bearer auth. Verify raw bytes and all transmission headers against stored webhook ID/environment; event ID
        alone is not authentication. Deduplicate event ID, enqueue canonical GET reconciliation, then acknowledge 200.
        Invalid signatures return 400; persistence/verification availability failures return 503 to retry. Unknown
        verified events are acknowledged without financial effects. Never rely on browser callbacks or delivery order.
        Local mock requires exact mock headers.

        Args:
            paypal_transmission_id: Value sent with the request.
            paypal_transmission_time: Value sent with the request.
            paypal_transmission_sig: Value sent with the request.
            paypal_cert_url: Value sent with the request.
            paypal_auth_algo: Value sent with the request.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            Verified event durably accepted or previously recorded.

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
            await self._with_raw_response.receive_pay_pal_webhook(
                paypal_transmission_id,
                paypal_transmission_time,
                paypal_transmission_sig,
                paypal_cert_url,
                paypal_auth_algo,
                body,
                request_options=request_options,
            ),
        )

    @property
    def with_raw_response(self) -> AsyncWebhooksWithRawResponse:
        return self._with_raw_response


class WebhooksWithRawResponse(BaseRawResponse[RawClient, Server]):
    def receive_pay_pal_webhook(
        self,
        paypal_transmission_id: str,
        paypal_transmission_time: RFC3339DateTime,
        paypal_transmission_sig: str,
        paypal_cert_url: str,
        paypal_auth_algo: str,
        body: PayPalEvent | PayPalEventDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> ApiResult[Acknowledgement, ReceivePayPalWebhookErrorBody]:
        """No bearer auth. Verify raw bytes and all transmission headers against stored webhook ID/environment; event ID
        alone is not authentication. Deduplicate event ID, enqueue canonical GET reconciliation, then acknowledge 200.
        Invalid signatures return 400; persistence/verification availability failures return 503 to retry. Unknown
        verified events are acknowledged without financial effects. Never rely on browser callbacks or delivery order.
        Local mock requires exact mock headers.

        Args:
            paypal_transmission_id: Value sent with the request.
            paypal_transmission_time: Value sent with the request.
            paypal_transmission_sig: Value sent with the request.
            paypal_cert_url: Value sent with the request.
            paypal_auth_algo: Value sent with the request.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return self._client.execute(
            http_method="POST",
            url_template=self._server.default("/v1/webhooks/paypal"),
            headers=[
                param[str]("PAYPAL-TRANSMISSION-ID", paypal_transmission_id),
                param[RFC3339DateTime]("PAYPAL-TRANSMISSION-TIME", paypal_transmission_time),
                param[str]("PAYPAL-TRANSMISSION-SIG", paypal_transmission_sig),
                param[str]("PAYPAL-CERT-URL", paypal_cert_url),
                param[str]("PAYPAL-AUTH-ALGO", paypal_auth_algo),
                param[UUID]("Idempotency-Key", uuid4()),
            ],
            body=json_body[PayPalEvent | PayPalEventDict](body),
            decoder=json_decoder[Acknowledgement],
            error_mapper=receive_pay_pal_webhook_error_mapper,
            request_options=request_options,
        )


class AsyncWebhooksWithRawResponse(BaseRawResponse[AsyncRawClient, Server]):
    async def receive_pay_pal_webhook(
        self,
        paypal_transmission_id: str,
        paypal_transmission_time: RFC3339DateTime,
        paypal_transmission_sig: str,
        paypal_cert_url: str,
        paypal_auth_algo: str,
        body: PayPalEvent | PayPalEventDict,
        *,
        request_options: RequestOptionsOrDict | None = None,
    ) -> ApiResult[Acknowledgement, ReceivePayPalWebhookErrorBody]:
        """No bearer auth. Verify raw bytes and all transmission headers against stored webhook ID/environment; event ID
        alone is not authentication. Deduplicate event ID, enqueue canonical GET reconciliation, then acknowledge 200.
        Invalid signatures return 400; persistence/verification availability failures return 503 to retry. Unknown
        verified events are acknowledged without financial effects. Never rely on browser callbacks or delivery order.
        Local mock requires exact mock headers.

        Args:
            paypal_transmission_id: Value sent with the request.
            paypal_transmission_time: Value sent with the request.
            paypal_transmission_sig: Value sent with the request.
            paypal_cert_url: Value sent with the request.
            paypal_auth_algo: Value sent with the request.
            body: The request body.
            request_options: Per-call overrides for this one request, such as a timeout, extra headers, or its retry
                count and statuses.

        Returns:
            An ``ApiResult`` holding the deserialized response or the error body."""
        return await self._client.execute(
            http_method="POST",
            url_template=self._server.default("/v1/webhooks/paypal"),
            headers=[
                param[str]("PAYPAL-TRANSMISSION-ID", paypal_transmission_id),
                param[RFC3339DateTime]("PAYPAL-TRANSMISSION-TIME", paypal_transmission_time),
                param[str]("PAYPAL-TRANSMISSION-SIG", paypal_transmission_sig),
                param[str]("PAYPAL-CERT-URL", paypal_cert_url),
                param[str]("PAYPAL-AUTH-ALGO", paypal_auth_algo),
                param[UUID]("Idempotency-Key", uuid4()),
            ],
            body=json_body[PayPalEvent | PayPalEventDict](body),
            decoder=async_json_decoder[Acknowledgement],
            error_mapper=receive_pay_pal_webhook_error_mapper,
            request_options=request_options,
        )
