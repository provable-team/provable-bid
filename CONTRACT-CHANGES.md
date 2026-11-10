# Frozen preimplementation contract — v0.2.0

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
