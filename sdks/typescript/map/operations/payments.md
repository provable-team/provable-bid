<!-- Generated file — do not edit; regenerated with the SDK. -->

# Payments — operations

Accessor: `client.payments` · Source: `src/resources/payments.ts` · 12 operations · Request and error types: namespace `Payments`

**Type sources**: every type an operation names, with the file that declares it and the schema value exported beside it. Import every name from `provable-bid-sdk`; the `Source` path is where to **read** the shape, never what to import. `ApiError`, the runtime error family and the file vocabulary are excluded — see sdk-map.md.

### authorizeCompetition

- **Signature**: `authorizeCompetition(request: Payments.AuthorizeCompetitionRequest, options?: RequestOptions): ApiPromise<Payment, Payments.AuthorizeCompetitionError>`
- **Wire**: `POST /v1/competitions/{competition_id}/authorize`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `Payment`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Payments.AuthorizeCompetitionError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Payments.AuthorizeCompetitionRequest` (2):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `competitionId` | `path` | `competition_id` | `string` | yes |
| `idempotencyKey` | `header` | `Idempotency-Key` | `string` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `Payment` | `paymentSchema` | `src/models/payment.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### captureAdditionalPurchase

- **Signature**: `captureAdditionalPurchase(request: Payments.CaptureAdditionalPurchaseRequest, options?: RequestOptions): ApiPromise<Purchase, Payments.CaptureAdditionalPurchaseError>`
- **Wire**: `POST /v1/purchases/{purchase_id}/capture`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `Purchase`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Payments.CaptureAdditionalPurchaseError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Payments.CaptureAdditionalPurchaseRequest` (2):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `purchaseId` | `path` | `purchase_id` | `string` | yes |
| `idempotencyKey` | `header` | `Idempotency-Key` | `string` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `Purchase` | `purchaseSchema` | `src/models/purchase.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### createAdditionalPurchase

- **Signature**: `createAdditionalPurchase(request: Payments.CreateAdditionalPurchaseRequest, options?: RequestOptions): ApiPromise<Purchase, Payments.CreateAdditionalPurchaseError>`
- **Wire**: `POST /v1/competitions/{competition_id}/additional-purchases`
- **Auth**: `bearerAuth`
- **Request body**: `application/json` — the `body` field
- **Returns**: `Purchase`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Payments.CreateAdditionalPurchaseError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Payments.CreateAdditionalPurchaseRequest` (3):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `competitionId` | `path` | `competition_id` | `string` | yes |
| `idempotencyKey` | `header` | `Idempotency-Key` | `string` | yes |
| `body` | `body` | — | `SelectSubmission` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `SelectSubmission` | `selectSubmissionSchema` | `src/models/select-submission.ts` |
| `Purchase` | `purchaseSchema` | `src/models/purchase.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### createDeliveryAccess

- **Signature**: `createDeliveryAccess(request: Payments.CreateDeliveryAccessRequest, options?: RequestOptions): ApiPromise<DeliveryAccess, Payments.CreateDeliveryAccessError>`
- **Wire**: `POST /v1/purchases/{purchase_id}/delivery-access`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `DeliveryAccess`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Payments.CreateDeliveryAccessError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Payments.CreateDeliveryAccessRequest` (2):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `purchaseId` | `path` | `purchase_id` | `string` | yes |
| `idempotencyKey` | `header` | `Idempotency-Key` | `string` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `DeliveryAccess` | `deliveryAccessSchema` | `src/models/delivery-access.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### createInitialCheckout

- **Signature**: `createInitialCheckout(request: Payments.CreateInitialCheckoutRequest, options?: RequestOptions): ApiPromise<Checkout, Payments.CreateInitialCheckoutError>`
- **Wire**: `POST /v1/competitions/{competition_id}/checkout`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `Checkout`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Payments.CreateInitialCheckoutError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Payments.CreateInitialCheckoutRequest` (2):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `competitionId` | `path` | `competition_id` | `string` | yes |
| `idempotencyKey` | `header` | `Idempotency-Key` | `string` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `Checkout` | `checkoutSchema` | `src/models/checkout.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### createRefund

- **Signature**: `createRefund(request: Payments.CreateRefundRequest, options?: RequestOptions): ApiPromise<Refund, Payments.CreateRefundError>`
- **Wire**: `POST /v1/payments/{payment_id}/refunds`
- **Auth**: `bearerAuth`
- **Request body**: `application/json` — the `body` field
- **Returns**: `Refund`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Payments.CreateRefundError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Payments.CreateRefundRequest` (3):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `paymentId` | `path` | `payment_id` | `string` | yes |
| `idempotencyKey` | `header` | `Idempotency-Key` | `string` | yes |
| `body` | `body` | — | `RefundRequest` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `RefundRequest` | `refundRequestSchema` | `src/models/refund-request.ts` |
| `Refund` | `refundSchema` | `src/models/refund.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### downloadDelivery

- **Signature**: `downloadDelivery(request: Payments.DownloadDeliveryRequest, options?: RequestOptions): ApiPromise<undefined, Payments.DownloadDeliveryError>`
- **Wire**: `GET /v1/deliveries/{token}`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `undefined` — the operation resolves to nothing
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Payments.DownloadDeliveryError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Payments.DownloadDeliveryRequest` (1):

| Field | Channel | Type | Req |
| --- | --- | --- | --- |
| `token` | `path` | `string` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### getPayment

- **Signature**: `getPayment(request: Payments.GetPaymentRequest, options?: RequestOptions): ApiPromise<Payment, Payments.GetPaymentError>`
- **Wire**: `GET /v1/payments/{payment_id}`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `Payment`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Payments.GetPaymentError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Payments.GetPaymentRequest` (1):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `paymentId` | `path` | `payment_id` | `string` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `Payment` | `paymentSchema` | `src/models/payment.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### getPurchase

- **Signature**: `getPurchase(request: Payments.GetPurchaseRequest, options?: RequestOptions): ApiPromise<Purchase, Payments.GetPurchaseError>`
- **Wire**: `GET /v1/purchases/{purchase_id}`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `Purchase`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Payments.GetPurchaseError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Payments.GetPurchaseRequest` (1):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `purchaseId` | `path` | `purchase_id` | `string` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `Purchase` | `purchaseSchema` | `src/models/purchase.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### getRefund

- **Signature**: `getRefund(request: Payments.GetRefundRequest, options?: RequestOptions): ApiPromise<Refund, Payments.GetRefundError>`
- **Wire**: `GET /v1/refunds/{refund_id}`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `Refund`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Payments.GetRefundError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Payments.GetRefundRequest` (1):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `refundId` | `path` | `refund_id` | `string` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `Refund` | `refundSchema` | `src/models/refund.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### listPurchases

- **Signature**: `listPurchases(request: Payments.ListPurchasesRequest, options?: RequestOptions): ApiPromise<PurchasePage, Payments.ListPurchasesError>`
- **Wire**: `GET /v1/competitions/{competition_id}/purchases`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `PurchasePage`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Payments.ListPurchasesError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Payments.ListPurchasesRequest` (3):

| Field | Channel | Wire | Type | Req | Default |
| --- | --- | --- | --- | --- | --- |
| `competitionId` | `path` | `competition_id` | `string` | yes | — |
| `cursor` | `query` | — | `string` | no | — |
| `limit` | `query` | — | `number` | no | `20` |

| Type | Schema value | Source |
| --- | --- | --- |
| `PurchasePage` | `purchasePageSchema` | `src/models/purchase-page.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### reconcilePayment

- **Signature**: `reconcilePayment(request: Payments.ReconcilePaymentRequest, options?: RequestOptions): ApiPromise<Payment, Payments.ReconcilePaymentError>`
- **Wire**: `POST /v1/payments/{payment_id}/reconcile`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `Payment`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Payments.ReconcilePaymentError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Payments.ReconcilePaymentRequest` (2):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `paymentId` | `path` | `payment_id` | `string` | yes |
| `idempotencyKey` | `header` | `Idempotency-Key` | `string` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `Payment` | `paymentSchema` | `src/models/payment.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

