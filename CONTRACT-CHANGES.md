# Contract revisions

## v0.4.0: finished-website race (agreed on PR #3)

Every change is applied by [`scripts/contract-v0.4.mjs`](scripts/contract-v0.4.mjs) from v0.3.0.

| Area | v0.3.0 | v0.4.0 |
| --- | --- | --- |
| Deliverable | text + image artifacts (1–3) | one self-contained `text/html` page per submission; previews are the page with a strict CSP and watermark |
| Price | bid from $1 (demo $5) | $10.00 to $5,000.00; the buyer also pays a disclosed processing fee (PayPal's own fee) shown as `processing_fee` and `total` |
| Undecided outcomes | 10% participation fee captured on reject / deadline | **void**: `rejected`, `no_decision`, `no_qualifiers` release the hold; the buyer pays nothing. `participation_fee_bps`, `participation_allocation_basis` and purpose `participation_fee` removed |
| Allocation | winner + shared participation, payouts simulated | one winner allocation per completed purchase (price minus 5%), paid by real PayPal Payouts to the operator's PayPal account (`payouts: paypal_sandbox`) |
| Windows | submission 300–86,400 s | 300, 900 or 3,600 s; decision up to 24 h (inside PayPal's 3-day honor period) |
| Agents | internal personas + buyer-triggered `agent-runs` | outside agents (`internal: false`) and labelled house agents on the same public API; `agent-runs` removed; `competition.opened` webhook (HMAC-signed) |
| Identity | fixture tokens | `POST /v1/buyer-sessions`; operators via Log in with PayPal (`/v1/operators/connect`); `POST /v1/operators/me/agents` issues agent tokens; `GET /v1/agents/me` |
| Build progress | none | `Competition.build_progress` (only on `GET /v1/competitions/{id}` for its buyer): `{ agent_id, step, label, state, colors, blocks, current_block, accent, attempt, max_attempts, missed_requirement_ids, updated_at }` per house agent: coarse step words, the page's top-level blocks (kinds and small counts) and validated hex colours derived from the streamed page, never any text, markup, class names or CSS |
| Attempts | one immutable entry per agent | up to 3 immutable attempts per agent: a new one only while every earlier attempt failed qualification and before the submission deadline (`DUPLICATE_SUBMISSION` otherwise, including after a pass); failed attempts stay recorded. Feedback is the agent's own `GET /v1/submissions/{id}` → `qualification.checks`. House agents revise from it; the buyer sees `revising` and the missed requirement IDs |
| Payout outcomes | `payout_state` simulated…blocked | adds `returned` (RETURNED: unclaimed for 30 days or cancelled), `refunded` (the recipient sent it back) and `reversed` (REVERSED); BLOCKED/FAILED/DENIED stay `failed`. New optional `Allocation.payout_detail` says why in PayPal's words (e.g. `BLOCKED: …`, `UNCLAIMED: …`) |
| Real-browser check | none | `Submission.browser_check` (present once KERNEL rendered the entry): `{ phone_fits, phone_overflow_px, phone_layout_width, console_errors, blocked_requests, focus_stops, focus_visible, focus_complete, load_ms, render_ms, replay_url, replay_expires_at }`: counts and widths only, never page text, console messages or request URLs. The phone is an emulated 390px phone (touch, DPR 3, `<meta viewport>` honoured, no scrollbar); `phone_url` shows what it displays on first load, wider than 390px when the phone zooms out. `replay_url` only with `KERNEL_REPLAYS=1`, and only while KERNEL keeps the video |
| Delivery | `/__mock/deliveries/{token}` | `/v1/deliveries/{token}`; bytes match the judged SHA-256 |
| Mock routes | always on the mock | only when the API runs with the fake provider |

### Addition: operator assistant ("Ask about my earnings")

Additive; nothing existing changes shape except one new required capability flag.

| Area | Change |
| --- | --- |
| Endpoint | `POST /v1/operators/me/assistant` (`askOperatorAssistant`, operator credential) with `AssistantQuestion { question }` (1–500 chars) → `AssistantAnswer { answer, lookups[], server_time }`. Each `AssistantLookup` is `{ tool, source, ref, status, summary }`: `tool` ∈ `my_allocations`, `get_order`, `list_transactions`, `list_disputes`, `get_refund`, `get_payout`; `source` ∈ `ledger`, `paypal_agent_toolkit`, `paypal_payouts`; `status` ∈ `ok`, `refused` (not one of the operator's references, so PayPal was not called), `error` |
| Idempotency | None: the call only reads, so it takes no `Idempotency-Key` (the one POST besides the PayPal webhook without one) and is not replayed |
| Limits | 10 questions a minute per operator → `429 RATE_LIMITED` with `Retry-After` |
| Disabled | `404 NOT_FOUND` when the server has no Anthropic key or runs the fake payment provider |
| Config | `capabilities.operator_assistant` (boolean, required) |

To regenerate the contract: restore v0.3.0 (`git show 30519e0:contracts/openapi.yaml > contracts/openapi.yaml`), then run
`node scripts/contract-v0.4.mjs` and `npm run client:generate`.

Measured in the PayPal sandbox (2026-11-11): a $0.50 final capture nets $0.00 after PayPal's fee, which is why
the participation fee was dropped; a $10 brief holds $10.87 and nets exactly $10.00 after a $0.77 card fee.

---

## v0.3.0: audit hardening

Status: **review proposal**, not a replacement of main until both developers review
this change. Published v0.2.0 remains the previous baseline. The core buyer charge
branches, advertised submission window, and independent purchases stay unchanged.

| Breaking change from v0.2.0 | Proposed v0.3.0 |
| --- | --- |
| Agent identity and one-entry rule | One entry per registered agent, across rotated credentials; separate credential subject, agent, operator, and private recipient identities. All three internal personas share the platform operator/recipient. |
| Participation distribution | Restore the original equal-per-qualified-agent rule. Group transfers by operator/recipient only after computing shares. Add `agent_shares` attribution; withdraw the earlier operator cap. |
| Versioned policy | New briefs accept sandbox-v2 with frozen `participation_allocation_basis=qualified_agent`. Reject old sandbox-v1 consent for new briefs; do not rewrite persisted historical policies. |
| Submission identity | Replace `recipient_principal_id` with public `operator_id`; private recipient binding is snapshotted server-side. |
| Public agent profiles | Add required `operator_id` / `operator_name` for clear common ownership. |
| Allocation identity | Replace `recipient_principal_id` with `operator_id` and opaque economic `recipient_id`. Agent earnings stay limited to attributable winner/shared-participation allocations, not all operator balances. |
| Qualification results | Require `artifact_hashes` with every frozen asset ID and SHA-256. Real worker must also validate expected evaluator version; model output cannot establish its own bindings. |
| Payment schema | Add independent `reversal_state` (including a pending hold), `reversed_minor`, and nullable `provider_expense_minor`. Null expense means unknown. Add purchase status `reversed`. |
| Settlement schema | Add `accounting[]` with gross/commission/confirmed expense/capped deduction/platform absorption/distributable cents. It is a historical projection, not an available payout balance. |
| Resolved disputes | Verified merchant win can restore retained payment access; refund/reversal/other holds still block. This intentionally replaces v0.2's permanent lock on dispute history. |

Follow-up fixes now included in this PR:

- Expired unopened checkout can renew with a new key on the same payment, after
  canonical no-authorization/no-capture/no-unknown-operation checks. Preserve old
  receipts/orders; concurrent renewals share one replacement. Do not renew an opened
  competition or change its advertised deadlines.
- Buyer gallery/detail receive fixed platform-generated qualification summaries.
  Raw evaluator reasons/check text/version stay uploader/admin-only; regressions
  inject an entire protected original into all three fields and verify no buyer leak.
- Policy sandbox-v2 makes the original per-agent rule explicit. Three-to-one agent
  ownership earns three-to-one shares, with integer remainders, not equal operator shares.

Nonfinancial integration fixes:

- Restore the general money/UTC/idempotency contract description lost to an earlier
  YAML editing artifact (`undefined`); a regression check now covers this header.

- `readQualifiedGallery` restarts at page one on every poll and merges by ID; do not
  keep a forward-only cursor as a subscription to newly qualified work.
- Delivery access uses the same key for an uncertain retry. After known issuance
  expires, a new key requests fresh access; never repurchase/recapture to renew.
- `npm run mock:drive -- --competition cmp_ID --qualify --complete-payments --watch`
  advances an existing buyer-demo competition outside the browser. Loopback/mock-only.
- `npm run demo` asserts payment completion, exact amounts, separate provider IDs,
  access ownership, byte lengths, and all original hashes for both purchases.
- Blank text, decoded limits, per-agent staging across rotation, aggregate bytes,
  and abandoned upload cleanup have explicit regressions.

Timing remains five minutes **for submissions**: with 120-second grace and a
30-second decision window, scheduled timeout is 7m30s; the 300-second decision
example times out at 12m. Maximum is 48h2m. Provider authorization creation/expiry
anchors financial safety independently of backend opening or callback receipt.

The product has no buyer processing surcharge. Zero expense cap means platform-funded
cost absorption, not zero real expense. No live marketplace/payout approval or payment
crash recovery is inferred from mock tests. See ACCEPTANCE-PLAN.md (separate Mock vs
Pending evidence) and BACKEND-INTEGRATION-AUDIT.md (observed collaborator branch).

Both developers must adopt the revised wire types and identity semantics together.
Keep `/v1` for the coordinated first implementation; do not deploy this over active
v0.2 consumers without an explicit version/migration decision. Regenerate types and
update mocks, docs, tests, and UI reads as one change. Freeze product scope, not claims
of unverified backend/provider behavior.

---

## Published v0.2.0 revision (historical)

### v0.2.0 preimplementation contract

Status: **frozen for the two-developer implementation handoff**. Canonical wire source:
[contracts/openapi.yaml](contracts/openapi.yaml), `info.version: 0.2.0`.
The generated client, mock, interfaces, tests, and documentation must travel together.

This replaces the earlier v0.1.0 draft **before** an application has been implemented.
It retains `/v1` routes for the initial launch; it is not backwards compatible with the
v0.1.0 draft. Both developers must switch to this revision together. Future incompatible
changes after this freeze require a coordinated contract revision/version decision;
do not silently change the mock or hand-edit the generated client.

| Breaking change | v0.1.0 | v0.2.0 / required migration |
| --- | --- | --- |
| Submission input | `{title,content}` | Upload private assets, then `{title,artifacts:[{asset_id}]}`. No remote asset/preview URLs. |
| Submission output | Top-level `preview`, `content_sha256` | `artifacts[]` provides type/MIME/hash/dimensions and `preview` metadata. Remove uses of old fields. |
| Buyer gallery | All buyer-owned entries | Qualified only. Pending/failed/error entries and preview bytes return 404 to buyer; uploader/admin may review. Filter before pagination. |
| Delivery access | One top-level `url` | `artifacts:[{asset_id,url,mime_type,size_bytes}]`, plus shared expiry/server time. Follow each paid original URL with buyer auth. |
| Evaluator adapter | One content string | Full private artifact bundle plus metadata; evaluate text/images against the same frozen requirements. |
| Internal agent context | Submit inline text | Upload assets then submit owned references using scoped auth. |
| Minimum bid type | Money `$ref` with sibling minimum | Named `BidMoney` with integer `amount_minor` minimum 100. Both create input and competition output reference it. |

OpenAPI 3.1 schema `$ref` siblings apply additive constraints, so the old form was not
inherently invalid. `BidMoney` removes tooling ambiguity and gives the generated client
a named bid type. TypeScript still represents amounts as `number`; it cannot enforce
a runtime range. JSON Schema request validation and contract tests enforce integer
cents and the 100-cent minimum. No client can safely substitute for server validation.

Compatible additions and relaxed bounds:

- Asset upload/metadata/safe preview routes: `POST /v1/assets`,
  `GET /v1/assets/{asset_id}`, `GET /v1/assets/{asset_id}/preview`.
- Public profiles: `GET /v1/agents`, `GET /v1/agents/{agent_id}`.
- Owner/admin orchestration: `POST` and `GET /v1/competitions/{id}/agent-runs`.
- Decision period minimum is 30 seconds (previously 300), max remains 24 hours.
  Submission period remains **300–86400 seconds**. Early qualified selection remains
  allowed, and it preserves the full advertised submission window.
- Three mock agents produce text + image submissions on the same Five Minute Scenes
  brief. Those are deterministic fixtures; qualification/capture remain explicit mocks.

Payment behavior is preserved: separate authorization/capture/refund/dispute/operation
states; atomic first-decision lock; idempotent operations and webhook reconciliation;
100% first purchase, 10% participation fee, no-qualifier void; separate full-price
additional orders; paid-original entitlement and actual payout remain separate.
No blockchain or unapproved marketplace services have been added.

Before merging a revision after freeze: coordinate the wire diff with both developers,
regenerate the client, update fixture/docs/tests, and pass `npm run check`. Use
INTEGRATION.md's runnable visual demo and PAYPAL-FLOWS.md's separate sandbox acceptance.
