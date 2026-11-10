# PayPal flows — sandbox integration handoff

Contract baseline: v0.2.0; payment decisions/state machines are unchanged from v0.1.0.
Artifact delivery now returns one protected URL per purchased original.

Scope: a design for Developer B, with a runnable **mock**, not an implemented PayPal
adapter. Do not present simulated capture or allocation as a real payment or payout.
Checked against official PayPal documentation on 2026-11-10. USD conversion is exact:
500 cents → `"5.00"`, 50 → `"0.50"`; use integer division/remainder, never float money.

## Environment and capability gate

Server-only configuration: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`,
`PAYPAL_WEBHOOK_ID`, `PAYPAL_MERCHANT_ID`, `PAYPAL_ENV=sandbox`, allowlisted return
and cancel URLs. OAuth tokens and secrets never enter browser bundles or logs. If
using the PayPal JS SDK, its public client ID is a separate explicitly public setting;
the MVP may simply redirect to the provider's stored approval link.

Adapter base URL is fixed server-side to `https://api-m.sandbox.paypal.com`, never
supplied by a buyer. Verify account capabilities with sandbox smoke tests for full
capture, **single final partial capture**, void, refunds, and pending/declined cases
before allowing checkout. `GET /v1/config` advertises actual capabilities. Unsupported
partial capture blocks launch; changing the rule after buyer agreement is invalid.

Collections go to one platform-owned sandbox merchant. `payouts=simulated` always
labels demo allocations. This does not establish an approved live money-transmission
or marketplace model. Live multi-seller processing requires platform approval; PayPal
Payouts separately requires access. No split payee, partner fee, delayed disbursement,
or automated real payout is authorized by this architecture.
[Platforms overview](https://developer.paypal.com/platforms/overview),
[Payouts prerequisites](https://developer.paypal.com/payouts/use-payouts/overview).

## Adapter boundary (implement later, server-only)

Use small application functions, not another service: `createOrder(intent, money,
binding, operationId)`, `getOrder(id)`, `authorizeOrder(id, operationId)`,
`getAuthorization(id)`, `captureAuthorization(id, money, final=true, operationId)`,
`voidAuthorization(id, operationId)`, `captureOrder(id, operationId)`,
`getCapture(id)`, `refundCapture(id, money, operationId)`, `getRefund(id)`, and
`verifyWebhook(rawBody, headers, configuredWebhookId)`. Normalized results retain
provider IDs/statuses and expected merchant/amount/currency bindings. Errors distinguish
definitive decline, safely retryable failure, and **unknown outcome**. An HTTP success
alone does not imply completed capture. Payout is deliberately not part of this adapter.

Each modifying call uses a server-generated stable UUID `PayPal-Request-Id` belonging
to the persisted operation. Never pass a caller key verbatim as a provider ID across
endpoints. Store the exact outbound payload and operation result before processing
another financial command. Provider idempotency retention is endpoint-specific;
keep the local journal and reconcile canonical resources before retrying beyond
that retention. GET first after a timeout; never create a fresh charge because a
response was lost. Back off 1s/2s/4s/8s up to 60s with jitter and retry limits; unresolved
operations enter operator review. [PayPal idempotency headers](https://developer.paypal.com/api/rest/requests/).

## Initial authorization and opening

```mermaid
sequenceDiagram
  participant B as Buyer
  participant A as API
  participant D as DB/outbox
  participant P as PayPal sandbox
  B->>A: POST competitions (500 cents, 300s, accepted fee terms)
  B->>A: POST competition/checkout + Idempotency-Key
  A->>D: Persist initial payment/create-order operation
  A->>P: POST /v2/checkout/orders (intent AUTHORIZE)
  P-->>A: order ID + approval link
  A-->>B: Checkout
  B->>P: Approve maximum $5 hold and disclosed rule
  B->>A: POST competition/authorize + Idempotency-Key
  A->>P: GET stored order; verify binding/approval
  A->>P: POST /v2/checkout/orders/{id}/authorize
  P-->>A: Authorization ID/status/expiry
  A->>D: Confirm authorization; assign opening/deadlines once
  A-->>B: 202 Payment; poll Competition
```

Use one purchase unit, `reference_id`/`custom_id` bound to the internal payment or
competition, server-controlled merchant and amount. Frontend never provides a payee,
amount, capture ID, or a replacement order ID. Record accepted terms: up to the
original bid for first selection; otherwise agreed 10% participation fee; hold is
voided with no qualifying work; no guarantee of compensation. Return/cancel URLs
are navigation only. A cancelled browser navigation must not cancel a running hold
or modify competition outcome. Repeat authorize calls return the existing payment;
provider retry/reconciliation cannot shift deadlines.

Create-order and authorize commands may be asynchronous: return 202 with the payment
for accepted authorize, and poll it. Checkout creation returns 201 only with a usable
link; if provider creation is still unknown, return retryable 503 and retain its
operation so the same command can resume. Do not replace that order speculatively.

PayPal documents a 29-day authorization period and recommends capture within the
first three-day honor period; capture remains subject to risk and funding availability.
Store provider expiry and reject opening when insufficient for schedule + 15m.
There is no automatic extension in this MVP. Sandbox expiry must be tested using
negative cases or fixtures, not by expecting a 29-day sandbox wait to work.
[Authorization timing](https://developer.paypal.com/payment-methods/auth-honor/),
[Delayed capture tests](https://developer.paypal.com/checkout/delay-capture/).

## First winner: full original capture

`POST /v1/competitions/{id}/selection` validates qualified work and locks the buyer's
decision. In the same transaction create first purchase and a 500-cent capture
operation. Worker calls:

```http
POST /v2/payments/authorizations/{stored_authorization_id}/capture
PayPal-Request-Id: <persisted-operation-uuid>
Content-Type: application/json

{"amount":{"currency_code":"USD","value":"5.00"},"final_capture":true}
```

Pending/unknown → keep delivery locked, reconcile. Confirmed `COMPLETED` + verified
500 cents/USD/merchant/binding → persist capture, completed payment, entitlement,
and winner allocation exactly once. A browser callback or `CHECKOUT.ORDER.APPROVED`
never creates entitlement. Definitive decline → payment failed; retain selection,
no participation fee, no delivery. No charge increase or automatic alternate winner.
[Orders API](https://developer.paypal.com/api/orders/v2),
[Capture API](https://developer.paypal.com/api/payments/v2/authorizations-capture).

## Reject or timeout: single final 10% capture

Only after qualification cutoff and with at least one qualified principal and no
infrastructure errors: explicit reject-all or undecided deadline creates the same
unique participation operation. For a $5 bid, capture **$0.50 once**, with
`final_capture: true` on the original $5 authorization. That final flag declares no
further capture against the authorization. Record the 50-cent capture and reconcile
the remaining hold's release. If the provider still reports an open remainder,
queue a safe void of the remainder; never try another capture. Do not claim the buyer's
bank releases a hold instantly.

A partial capture is not a partial refund. Do not capture $5 then refund $4.50.
Partial-capability failure at runtime is an operator exception: fee unpaid, no
allocation, no delivery, reconcile/void safely. Do not silently change price. Additional
full-price orders are unavailable after a participation decision.
[Final capture semantics](https://developer.paypal.com/api/payments/v2/authorizations-capture).

## No qualifiers, infrastructure failure, or lost hold

No qualifiers at cutoff → close `no_qualifiers`, queue void. Any unfinished/errored
evaluation without an earlier selection → cancel `infrastructure_failure`, queue void,
even if some work qualified. A lost authorization before selection → cancel; no
attempt to bill a fee from another source. Use `POST /v2/payments/authorizations/{id}/void`,
persist `void_pending` until confirmed. Never void a capture blindly while its outcome
is unknown. Canonical GET and replay of the same void operation resolve timeouts.
A fully captured authorization cannot be voided; it requires a refund instead.
[Void API](https://developer.paypal.com/api/payments/v2/authorizations-void).

## Additional winners: independent full-price purchases

1. First purchase must have completed payment without a hold; buyer chooses another
   qualified submission before the fixed decision deadline.
2. `POST competition/additional-purchases` creates a purchase and a **new** order
   with `intent: CAPTURE`, original full price, one purchase unit. Unique purchase
   per submission, independent operation/request IDs.
3. Buyer approves that order; `POST purchase/capture` verifies the stored order and
   commits capture before the deadline, then calls `POST /v2/checkout/orders/{id}/capture`.
4. Confirm canonical completed capture before release. The original authorization
   and participation fee are never reused for another purchase. Each additional
   purchase has independent refunds/disputes and winner net allocation.
5. Abandoned checkout incurs no automatic charge. Unknown/pending committed capture
   continues reconciliation after deadline, retaining the same operation.

## Webhooks and reconciliation

Subscribe to relevant authorization created/voided; capture pending/completed/declined,
refunded/reversed; refund pending/failed; and dispute created/updated/resolved events.
The currently documented Payments v2 decline event is `PAYMENT.CAPTURE.DECLINED`;
handle legacy `DENIED` defensively if encountered. Do not use checkout approval as
payment completion. [Official event names](https://developer.paypal.com/api/rest/webhooks/event-names).

Verify original raw body and required `PAYPAL-TRANSMISSION-*`, `PAYPAL-AUTH-ALGO`, and
`PAYPAL-CERT-URL` with PayPal's verification endpoint and configured webhook ID.
Pin environment; if doing local certificate verification, enforce PayPal certificate
host allowlist and reject redirects/untrusted URLs to prevent SSRF. On failed verification
return 400; on transient verification/persistence failure return 503. Store verified
event under unique `(environment,event_id)` and enqueue reconciliation transactionally,
then acknowledge 200. Duplicates acknowledge 200. Unknown verified events acknowledge
without financial effects. [Webhook verification](https://developer.paypal.com/api/rest/webhooks/).

Worker looks up the event's known provider resource ID, fetches canonical order/auth/
capture/refund/dispute details, verifies merchant/amount/currency/internal binding, and
applies under payment lock. Do not follow arbitrary resource URLs from a webhook.
Unknown bindings are quarantined for review. Events may repeat, arrive out of order,
or be missing. A late pending event must not undo a completed capture; a refund or
reversal must not be undone by a duplicate completed event. Periodic sweeps query
unresolved operations, pending captures/voids/refunds, and approaching expiries.
The HTTP success response and webhook both use the same projection update function.

## Refunds, disputes, and payout truth

Admin full remaining refund reserves the refund amount and holds delivery/allocations
before calling `POST /v2/payments/captures/{id}/refund`. Persist refund ID/status;
pending is not refunded. GET refund and webhook reconciliation finalize it. Never
retry with a fresh ID on unknown result. Ingest external partial refunds and store
actual refunded cents even though this API only initiates full remaining refunds.
[Payments and refunds API](https://developer.paypal.com/api/payments/v2).

Disputes and reversals freeze any future delivery and payout, preserve prior captures,
and append accounting adjustments. Provider capture completion is historical and is
not overwritten to pretend money was never collected. A later dispute win does not
automatically reopen delivery in this MVP. Real already-paid recipients may require
reserves/recovery; that operational model must precede enabling real payouts.

Allocate only confirmed net money using frozen policy and integer rounding in
ARCHITECTURE.md. `payout_state=simulated` with a null provider payout ID is the demo.
The UI must say **simulated agent allocation**, never **paid**. Future PayPal Payouts
needs separate access, recipient onboarding, available funding, provider transfer
records, fees, and confirmation; buyer capture does not perform that transfer.

## Required sandbox acceptance (Developer B)

Run with distinct sandbox buyer/merchant accounts: approve/authorize/full capture;
final 50-cent capture with remainder released; no-qualifier void; new $5 additional
order; pending/declined/expired and unknown-network outcomes; duplicate requests;
verified duplicate/out-of-order events; full and external partial refund; disputed/
reversed payment blocks delivery. Compare actual provider dashboard amounts and
IDs with local journal. This repository's contract tests do not establish sandbox
capabilities or replace those acceptance checks.
