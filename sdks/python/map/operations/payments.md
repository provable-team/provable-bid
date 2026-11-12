<!-- Generated file — do not edit; regenerated with the SDK. -->

# Payments — operations

Accessor: `client.payments` · Source: `provable_bid_api/apis/payments.py` · 12 operations

Each `###` block is one operation and assumes `sdk-map.md` is loaded: blocks omit what its invariants table covers and are otherwise self-contained, so chunk at block level. Signatures are the sync parsed spelling; the async and raw spellings take the same parameters (see sdk-map.md). **Type sources** names the module declaring each type an operation mentions, so resolving a body, return or error payload is a lookup rather than a search; the runtime types `RawError` and `ApiResult` are excluded.

### client.payments.authorize_competition

- **Route**: `POST /v1/competitions/{competition_id}/authorize`
- **Auth**: `bearer_auth`
- **Signature**: `def authorize_competition(competition_id: str, idempotency_key: str, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `competition_id`, `idempotency_key`
- **Params**: `competition_id` — path · `idempotency_key` — header `Idempotency-Key`
- **Returns (parsed)**: `Payment`
- **Returns (raw)**: `ApiResult[Payment, AuthorizeCompetitionErrorBody]`
- **Error**: `AuthorizeCompetitionErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `Payment` | `provable_bid_api/models/payment.py` |
| `AuthorizeCompetitionErrorBody` | `provable_bid_api/errors/authorize_competition_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.payments.capture_additional_purchase

- **Route**: `POST /v1/purchases/{purchase_id}/capture`
- **Auth**: `bearer_auth`
- **Signature**: `def capture_additional_purchase(purchase_id: str, idempotency_key: str, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `purchase_id`, `idempotency_key`
- **Params**: `purchase_id` — path · `idempotency_key` — header `Idempotency-Key`
- **Returns (parsed)**: `Purchase`
- **Returns (raw)**: `ApiResult[Purchase, CaptureAdditionalPurchaseErrorBody]`
- **Error**: `CaptureAdditionalPurchaseErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `Purchase` | `provable_bid_api/models/purchase.py` |
| `CaptureAdditionalPurchaseErrorBody` | `provable_bid_api/errors/capture_additional_purchase_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.payments.create_additional_purchase

- **Route**: `POST /v1/competitions/{competition_id}/additional-purchases`
- **Auth**: `bearer_auth`
- **Signature**: `def create_additional_purchase(competition_id: str, idempotency_key: str, body: SelectSubmission | SelectSubmissionDict, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `competition_id`, `idempotency_key`, `body`
- **Params**: `competition_id` — path · `idempotency_key` — header `Idempotency-Key` · `body` — JSON body
- **Returns (parsed)**: `Purchase`
- **Returns (raw)**: `ApiResult[Purchase, CreateAdditionalPurchaseErrorBody]`
- **Error**: `CreateAdditionalPurchaseErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `SelectSubmission` | `provable_bid_api/models/select_submission.py` |
| `SelectSubmissionDict` | `provable_bid_api/models/select_submission.py` |
| `Purchase` | `provable_bid_api/models/purchase.py` |
| `CreateAdditionalPurchaseErrorBody` | `provable_bid_api/errors/create_additional_purchase_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.payments.create_delivery_access

- **Route**: `POST /v1/purchases/{purchase_id}/delivery-access`
- **Auth**: `bearer_auth`
- **Signature**: `def create_delivery_access(purchase_id: str, idempotency_key: str, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `purchase_id`, `idempotency_key`
- **Params**: `purchase_id` — path · `idempotency_key` — header `Idempotency-Key`
- **Returns (parsed)**: `DeliveryAccess`
- **Returns (raw)**: `ApiResult[DeliveryAccess, CreateDeliveryAccessErrorBody]`
- **Error**: `CreateDeliveryAccessErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `DeliveryAccess` | `provable_bid_api/models/delivery_access.py` |
| `CreateDeliveryAccessErrorBody` | `provable_bid_api/errors/create_delivery_access_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.payments.create_initial_checkout

- **Route**: `POST /v1/competitions/{competition_id}/checkout`
- **Auth**: `bearer_auth`
- **Signature**: `def create_initial_checkout(competition_id: str, idempotency_key: str, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `competition_id`, `idempotency_key`
- **Params**: `competition_id` — path · `idempotency_key` — header `Idempotency-Key`
- **Returns (parsed)**: `Checkout`
- **Returns (raw)**: `ApiResult[Checkout, CreateInitialCheckoutErrorBody]`
- **Error**: `CreateInitialCheckoutErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `Checkout` | `provable_bid_api/models/checkout.py` |
| `CreateInitialCheckoutErrorBody` | `provable_bid_api/errors/create_initial_checkout_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.payments.create_refund

- **Route**: `POST /v1/payments/{payment_id}/refunds`
- **Auth**: `bearer_auth`
- **Signature**: `def create_refund(payment_id: str, idempotency_key: str, body: RefundRequest | RefundRequestDict, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `payment_id`, `idempotency_key`, `body`
- **Params**: `payment_id` — path · `idempotency_key` — header `Idempotency-Key` · `body` — JSON body
- **Returns (parsed)**: `Refund`
- **Returns (raw)**: `ApiResult[Refund, CreateRefundErrorBody]`
- **Error**: `CreateRefundErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `RefundRequest` | `provable_bid_api/models/refund_request.py` |
| `RefundRequestDict` | `provable_bid_api/models/refund_request.py` |
| `Refund` | `provable_bid_api/models/refund.py` |
| `CreateRefundErrorBody` | `provable_bid_api/errors/create_refund_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.payments.download_delivery

- **Route**: `GET /v1/deliveries/{token}`
- **Auth**: `bearer_auth`
- **Signature**: `def download_delivery(token: str, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `token`
- **Params**: `token` — path
- **Returns (parsed)**: `None`
- **Returns (raw)**: `ApiResult[None, DownloadDeliveryErrorBody]`
- **Error**: `DownloadDeliveryErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `DownloadDeliveryErrorBody` | `provable_bid_api/errors/download_delivery_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.payments.get_payment

- **Route**: `GET /v1/payments/{payment_id}`
- **Auth**: `bearer_auth`
- **Signature**: `def get_payment(payment_id: str, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `payment_id`
- **Params**: `payment_id` — path
- **Returns (parsed)**: `Payment`
- **Returns (raw)**: `ApiResult[Payment, GetPaymentErrorBody]`
- **Error**: `GetPaymentErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `Payment` | `provable_bid_api/models/payment.py` |
| `GetPaymentErrorBody` | `provable_bid_api/errors/get_payment_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.payments.get_purchase

- **Route**: `GET /v1/purchases/{purchase_id}`
- **Auth**: `bearer_auth`
- **Signature**: `def get_purchase(purchase_id: str, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `purchase_id`
- **Params**: `purchase_id` — path
- **Returns (parsed)**: `Purchase`
- **Returns (raw)**: `ApiResult[Purchase, GetPurchaseErrorBody]`
- **Error**: `GetPurchaseErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `Purchase` | `provable_bid_api/models/purchase.py` |
| `GetPurchaseErrorBody` | `provable_bid_api/errors/get_purchase_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.payments.get_refund

- **Route**: `GET /v1/refunds/{refund_id}`
- **Auth**: `bearer_auth`
- **Signature**: `def get_refund(refund_id: str, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `refund_id`
- **Params**: `refund_id` — path
- **Returns (parsed)**: `Refund`
- **Returns (raw)**: `ApiResult[Refund, GetRefundErrorBody]`
- **Error**: `GetRefundErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `Refund` | `provable_bid_api/models/refund.py` |
| `GetRefundErrorBody` | `provable_bid_api/errors/get_refund_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.payments.list_purchases

- **Route**: `GET /v1/competitions/{competition_id}/purchases`
- **Auth**: `bearer_auth`
- **Signature**: `def list_purchases(competition_id: str, *, cursor: str | None = None, limit: int | None = 20, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `competition_id`
- **Params**: `competition_id` — path · `cursor` — query · `limit` — query
- **Returns (parsed)**: `PurchasePage`
- **Returns (raw)**: `ApiResult[PurchasePage, ListPurchasesErrorBody]`
- **Error**: `ListPurchasesErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `PurchasePage` | `provable_bid_api/models/purchase_page.py` |
| `ListPurchasesErrorBody` | `provable_bid_api/errors/list_purchases_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.payments.reconcile_payment

- **Route**: `POST /v1/payments/{payment_id}/reconcile`
- **Auth**: `bearer_auth`
- **Signature**: `def reconcile_payment(payment_id: str, idempotency_key: str, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `payment_id`, `idempotency_key`
- **Params**: `payment_id` — path · `idempotency_key` — header `Idempotency-Key`
- **Returns (parsed)**: `Payment`
- **Returns (raw)**: `ApiResult[Payment, ReconcilePaymentErrorBody]`
- **Error**: `ReconcilePaymentErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `Payment` | `provable_bid_api/models/payment.py` |
| `ReconcilePaymentErrorBody` | `provable_bid_api/errors/reconcile_payment_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

