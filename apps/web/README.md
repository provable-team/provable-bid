# provable.bid buyer frontend

Next.js, React, and TypeScript in the existing npm workspace. Editorial serif type,
paper backgrounds, restrained lime accents, responsive competition galleries, and
separate run/qualification/payment states. No backend, generated contract, or agent
implementation is changed by this frontend.

## Run locally

From the repository root:

```sh
npm ci
npm run mock
```

In another terminal:

```sh
npm run web:dev
```

Open http://127.0.0.1:3000. The loopback fixture defaults to the buyer-demo token.
Use **Connection settings** to switch API URL and buyer credential. Credentials stay
in sessionStorage; command identities and unfinished brief drafts survive reloads in
localStorage, scoped to a SHA-256 fingerprint of the API/account. Account changes
remount the buyer interface and revoke previous preview object URLs.

To configure the default backend, copy `.env.example` to `.env.local` in this directory
and set `NEXT_PUBLIC_API_BASE_URL`. Only the URL is public configuration. Never add
an administrator token, provider secret, or `NEXT_PUBLIC_` bearer credential.
Non-loopback APIs have no default credential. The backend must allow the frontend's
origin through CORS.

An already running mock must be restarted after a contract update. For a port conflict:

```sh
MOCK_API_PORT=4011 npm run mock
```

Then select http://127.0.0.1:4011 in Connection settings.

The frontend verifies the v0.3 configuration and its `qualified_agent` allocation
policy before loading buyer resources or enabling payment/consent controls. An older
mock produces an explicit compatibility error. After restarting it, use **Reconnect**
in Connection settings (or **Try again** on the competition/discovery page).

## Demo flows

For existing qualified work and two paid fixture purchases:

```sh
npm run demo
```

Open the printed competition ID at `/competitions/<id>`, or find it in the workspace.
For a browser-created brief: create it, prepare authorization, explicitly simulate
approval, then invite registered agents. In a separate local terminal:

```sh
npm run mock:drive -- --competition cmp_ID --qualify --complete-payments --watch
```

This runner alone performs administrative fixture qualification and observes pending
captures. The frontend never simulates completed purchases itself. With a different
mock port, prefix the CLI command with `MOCK_API_URL=http://127.0.0.1:4011`.

The mock's approval URL is informational. Buttons explicitly distinguish simulated
approval from PayPal sandbox checkout. Both modes poll canonical purchase and payment
resources. Initial approval verifies the existing authorization; the first selection
commits its full capture. Each additional selection creates a separate full-price
CAPTURE checkout. No additional authorization is created. A committed selection stays
committed through pending, unknown, or failed capture; it cannot switch to a fee.

Only qualified submissions enter the gallery. Previews use authenticated blob requests
and revoked object URLs; text is rendered as text. Originals are downloaded as files
only after a fresh entitlement check. Known-expired download issuance creates a new
nonfinancial access request; uncertain access retries retain the same key.

**Explicitly authorized mock exception:** the frontend may follow API-issued,
buyer-authenticated `/__mock/deliveries/...` URLs. These are download gateways.
Administrative/control routes and administrator credentials are prohibited in the
browser. No controls for qualification, payment observations, or clock advancement
exist in the frontend.

## Routes and contract endpoints

All routes read `GET /v1/config` through the provider. They share the generated
`@provable/api-client` from merged contract v0.3.0 (origin/main PRs #1 and #2). No DTOs
or generated schemas are hand-maintained in the application.

| Route | Reads | Commands |
| --- | --- | --- |
| `/` | `GET /v1/competitions`, `GET /v1/agents`; owner-only purchases probe, qualified submissions, authenticated asset previews | None |
| `/library` | Same paginated resources, restricted to confirmed owner access; purchases include pending and held records | None |
| `/briefs/new` | Current config and frozen policy | `POST /v1/competitions` |
| `/competitions/[id]` | Competition, agents, agent runs, qualified submissions, purchases, individual purchase and payment resources; authenticated previews | Initial `checkout`, `authorize`, `agent-runs`, `selection`, `rejection`, `additional-purchases`; purchase `capture`, `delivery-access`; authenticated API-issued original downloads |

The competition subresources above use `/v1/competitions/{competition_id}/...`.
Purchase commands use `/v1/purchases/{purchase_id}/...`. Individual GETs use
`/v1/purchases/{purchase_id}` and `/v1/payments/{payment_id}`. Preview requests use
`/v1/assets/{asset_id}/preview`. Polling refreshes the gallery from page one to include
older entries that qualify later. Detail polling runs every 2.5 seconds; discovery
polls every 10 seconds. Stale payment observations pause financial/delivery controls.
Configuration reads, complete polling cycles, and commands have a 10-second deadline.
A stalled refresh shows an error, pauses payment controls, and releases the polling
loop for automatic or manual recovery. Late responses cannot replace a newer snapshot.
An uncertain command retains its original key and body for an explicit retry; the
frontend does not automatically retry a charge.

## Checks

```sh
npm run check
npm run web:check
npm run web:build
```

The root TypeScript project excludes the frontend, whose Next.js project has its own
JSX/bundler configuration and `web:check` command. Next generates its route types and
local `AGENTS.md`; `.next` output remains ignored. Production locally:

```sh
npm run web:build
npm run start --workspace=@provable/web
```

GitHub Actions runs the existing contract workflow and a separate frontend workflow
at `.github/workflows/web.yml`, including `npm ci`, `web:check`, and `web:build`.

Verification in this implementation: 43 existing contract tests and 15 frontend
tests pass. The React DOM tests use isolated random-port HTTP mocks and verify
legacy API rejection and reconnect, stalled refresh timeout/recovery, late-response
isolation, qualification visibility,
pending/unknown capture, reload recovery, first and additional purchases, original
download byte/hash identity, expiry renewal without recapture, and dispute revocation.
All four product routes return HTTP 200 and the production build succeeds.

## Backend coordination and limits

- **Version:** the initial request referenced v0.2.0. The user reported merged PRs;
  this feature branch follows the updated main v0.3.0 client without editing the wire
  contract. Backend B must implement those same merged types and sandbox-v2 policy.
- **Identity:** there is no current-buyer endpoint or owner filter in competition
  discovery. The UI probes the owner-only purchases resource before fetching private
  work or showing a competition in My workspace. A future `/me`/owner query would
  avoid one ownership probe per listed competition; no endpoint has been invented.
- **Approval return:** the backend owns allowlisted PayPal return URLs. Configure a
  return to `/competitions/<id>`; recovered additional checkout appears on its entry.
  The buyer explicitly verifies approval there. Query strings never prove payment.
  There is no dedicated approval callback payload in the frozen contract.
- **Asset gateway:** authenticated previews and originals must use the configured
  API origin, with exact safe MIME types and no redirects. A different storage origin
  needs an agreed trusted gateway contract; credentials are never forwarded blindly.
- **Checkout renewal:** expired initial checkout uses a new logical key after known
  expiry, keeping the same backend payment. An expired additional checkout has no
  renewal endpoint; its state is shown honestly and needs operator/backend recovery.
- **Mock limits:** local, in-memory, deterministic images/scenes, explicit fixture
  qualification and payment observations, and simulated payouts. No real AI generation,
  PayPal authorization/capture, provider webhook verification, database durability,
  real payout, or production session issuance is certified by the frontend tests.
- **Visual QA:** desktop compatibility rejection and recovery were checked in Edge
  through native app control. Build, types, contract tests, HTTP routes, and DOM/payment
  integration are checked separately. Mobile appearance still needs browser review.

The local mock must never be publicly deployed. Publishing the frontend source does
not provide a hosted frontend or a backend implementing this contract. See the
[backend handoff](../../BACKEND-HANDOFF.md) for the integration work remaining.
