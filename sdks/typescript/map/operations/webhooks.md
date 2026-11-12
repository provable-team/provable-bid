<!-- Generated file — do not edit; regenerated with the SDK. -->

# Webhooks — operations

Accessor: `client.webhooks` · Source: `src/resources/webhooks.ts` · 1 operation · Request and error types: namespace `Webhooks`

**Type sources**: every type an operation names, with the file that declares it and the schema value exported beside it. Import every name from `provable-bid-sdk`; the `Source` path is where to **read** the shape, never what to import. `ApiError`, the runtime error family and the file vocabulary are excluded — see sdk-map.md.

### receivePayPalWebhook

- **Signature**: `receivePayPalWebhook(request: Webhooks.ReceivePayPalWebhookRequest, options?: RequestOptions): ApiPromise<Acknowledgement, Webhooks.ReceivePayPalWebhookError>`
- **Wire**: `POST /v1/webhooks/paypal`
- **Auth**: none — public; no credential is sent
- **Request body**: `application/json` — the `body` field
- **SDK-sent**: `header Idempotency-Key` (minted per call)
- **Returns**: `Acknowledgement`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Webhooks.ReceivePayPalWebhookError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Webhooks.ReceivePayPalWebhookRequest` (6):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `paypalTransmissionId` | `header` | `PAYPAL-TRANSMISSION-ID` | `string` | yes |
| `paypalTransmissionTime` | `header` | `PAYPAL-TRANSMISSION-TIME` | `Date` (date-time) | yes |
| `paypalTransmissionSig` | `header` | `PAYPAL-TRANSMISSION-SIG` | `string` | yes |
| `paypalCertUrl` | `header` | `PAYPAL-CERT-URL` | `string` | yes |
| `paypalAuthAlgo` | `header` | `PAYPAL-AUTH-ALGO` | `string` | yes |
| `body` | `body` | — | `PayPalEvent` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `PayPalEvent` | `payPalEventSchema` | `src/models/pay-pal-event.ts` |
| `Acknowledgement` | `acknowledgementSchema` | `src/models/acknowledgement.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

