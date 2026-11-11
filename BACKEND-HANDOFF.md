# Backend handoff for the buyer frontend

The buyer frontend in `apps/web` uses the v0.3.0 contract in
[`contracts/openapi.yaml`](contracts/openapi.yaml), merged into `main` in PRs #1 and
#2. Please implement a durable backend against that contract and provide a sandbox API
URL and buyer credential so the frontend can be tested end to end. The existing
`shiwani/escrow-bids` prototype exposes a different jobs/bids API and payment flow;
it cannot be connected by changing the URL alone. See
[the prototype review](BACKEND-INTEGRATION-AUDIT.md) for details.

## Frontend integration requirements

The OpenAPI file is the source of truth for schemas, permissions, state transitions,
and errors. The frontend uses these operations:

- `GET /v1/config`, `GET /v1/agents`, and `GET/POST /v1/competitions`.
- `GET /v1/competitions/{id}`, plus its `submissions`, `purchases`, and
  `agent-runs` reads; `POST` its `agent-runs`, `checkout`, `authorize`, `selection`,
  `rejection`, and `additional-purchases` commands.
- `GET /v1/purchases/{id}` and `/v1/payments/{id}`, plus purchase `capture` and
  `delivery-access` commands and authenticated asset preview/download endpoints.

In particular:

1. Return contract-compatible config and the frozen `sandbox-v2` policy. Issue a
   buyer-scoped bearer credential, enforce ownership, and allow the frontend origin
   and required headers through CORS. The frontend does not issue real credentials.
2. Authorize the buyer's bid before opening; capture the full first purchase only
   after selection, or handle the contract's participation-fee and no-qualifier
   branches. Additional selections use separate full-price checkouts. Expose current
   payment, purchase, and entitlement states independently; preserve command
   idempotency and reconcile uncertain provider outcomes.
3. Accept and qualify completed text/image artifacts, return only qualified work to
   the buyer, and provide authenticated safe previews and buyer-bound downloads.
   The frontend expects API-origin asset URLs without redirects. HTML sample bids and
   delivery-after-award require a separately agreed contract and UI change.
4. Support the contract's agent discovery and buyer-triggered agent runs, alongside
   its external agent interface. If the intended product is external agents only,
   agree the contract and frontend change before dropping the run endpoints.
5. Configure allowlisted PayPal return URLs to the buyer's `/competitions/<id>` page
   and verify provider results on the backend. Follow [PAYPAL-FLOWS.md](PAYPAL-FLOWS.md)
   and the [acceptance plan](ACCEPTANCE-PLAN.md) for sandbox and durability checks.

The frontend points at the local mock by default. Set `NEXT_PUBLIC_API_BASE_URL` to
the matching backend at frontend build time, or use its Connection settings. Buyer
credentials are entered in the browser session; do not put secrets in public env vars.
The local in-memory mock is a development fixture and must not be publicly deployed.

## Local handoff check

```sh
npm ci
npm run check
npm run web:check
npm run web:build
npm run mock
```

In a second terminal run `npm run web:dev`; open http://127.0.0.1:3000. For a
qualified gallery and simulated purchases, run `npm run demo` while the mock is
running. See [apps/web/README.md](apps/web/README.md) for other demo flows and known
integration limits. These checks do not certify real PayPal calls, durable storage,
real generation, or payouts; run the separate sandbox acceptance tests against the
implemented backend.
