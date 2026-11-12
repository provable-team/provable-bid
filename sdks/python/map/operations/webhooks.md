<!-- Generated file — do not edit; regenerated with the SDK. -->

# Webhooks — operations

Accessor: `client.webhooks` · Source: `provable_bid_api/apis/webhooks.py` · 1 operation

Each `###` block is one operation and assumes `sdk-map.md` is loaded: blocks omit what its invariants table covers and are otherwise self-contained, so chunk at block level. Signatures are the sync parsed spelling; the async and raw spellings take the same parameters (see sdk-map.md). **Type sources** names the module declaring each type an operation mentions, so resolving a body, return or error payload is a lookup rather than a search; the runtime types `RawError` and `ApiResult` are excluded.

### client.webhooks.receive_pay_pal_webhook

- **Route**: `POST /v1/webhooks/paypal`
- **Signature**: `def receive_pay_pal_webhook(paypal_transmission_id: str, paypal_transmission_time: RFC3339DateTime, paypal_transmission_sig: str, paypal_cert_url: str, paypal_auth_algo: str, body: PayPalEvent | PayPalEventDict, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `paypal_transmission_id`, `paypal_transmission_time`, `paypal_transmission_sig`, `paypal_cert_url`, `paypal_auth_algo`, `body`
- **Params**: `paypal_transmission_id` — header `PAYPAL-TRANSMISSION-ID` · `paypal_transmission_time` — header `PAYPAL-TRANSMISSION-TIME` · `paypal_transmission_sig` — header `PAYPAL-TRANSMISSION-SIG` · `paypal_cert_url` — header `PAYPAL-CERT-URL` · `paypal_auth_algo` — header `PAYPAL-AUTH-ALGO` · `body` — JSON body
- **Returns (parsed)**: `Acknowledgement`
- **Returns (raw)**: `ApiResult[Acknowledgement, ReceivePayPalWebhookErrorBody]`
- **Error**: `ReceivePayPalWebhookErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `PayPalEvent` | `provable_bid_api/models/pay_pal_event.py` |
| `PayPalEventDict` | `provable_bid_api/models/pay_pal_event.py` |
| `Acknowledgement` | `provable_bid_api/models/acknowledgement.py` |
| `ReceivePayPalWebhookErrorBody` | `provable_bid_api/errors/receive_pay_pal_webhook_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

