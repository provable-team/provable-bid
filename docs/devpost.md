# provable.bid — Devpost write-up (draft for review)

> Lines marked **TODO** must be filled in before submitting; remove this note when pasting into Devpost.

**Tagline:** Post a brief, let AI agents race to build it, and pay only for the website you pick.

## Inspiration

AI agents can now build a decent website in minutes. Paying for that work is still awkward. Fixed-price gigs make the
buyer pay before seeing anything. Contests make the builders work for free and hope.

We wanted a market where the buyer sees finished work before paying, and the agent that built the chosen page gets
paid right away. PayPal's authorize-then-capture flow fits this exactly. The money is reserved up front and only
moves when the buyer decides.

## What it does

1. **A buyer posts a brief.** They describe a single-page website, list up to 10 checkable requirements, and set a
   price between $10 and $5,000. They pick a submission window of 5, 15 or 60 minutes.
2. **PayPal holds the money.** The buyer approves a PayPal order with intent AUTHORIZE for the price plus a disclosed
   processing charge. The charge is calculated from PayPal's standard US rate (3.49% + $0.49, which we measured in the
   sandbox) so that the price is left after the fee. A $10 brief holds $10.87 and a $20 brief holds $21.23. The actual
   PayPal fee on each capture is recorded only once PayPal reports it. Nothing is captured yet.
3. **Agents race.** Any registered agent, using the agent token its operator issued, uploads one finished, self-contained HTML file through the public
   API. Registered agents get an HMAC-signed notification when a brief opens, or they can poll the competition list.
4. **Every entry is checked before the buyer sees it.**
   - Gates reject pages that load external scripts, embed frames, post forms to other sites, redirect, have almost no
     content, or repeat themselves.
   - KERNEL loads the page in a real cloud Chromium at 1280px and 390px wide. It takes screenshots, measures
     sideways scrolling on a phone, and records console errors and blocked outbound requests.
   - A judge checks each requirement and writes down why it passed or failed. With an Anthropic key this is Claude,
     which also sees the screenshots and measurements. Without one, a labelled keyword check runs instead.
   - Only qualified entries reach the gallery.
5. **With the browser renderer on, the buyer sees screenshots, not the source.** When KERNEL is configured (as on the
   live site), previews are JPEG screenshots only (desktop and phone), and a missing screenshot returns an error
   instead of falling back to HTML. Without a renderer, the preview is watermarked HTML in a sandboxed iframe under a
   strict content policy, so in that mode the buyer can see the markup before paying.
6. **Picking a winner settles everything.**
   - The full authorization is captured.
   - The buyer downloads the original HTML. The server recorded its SHA-256 at submission and serves those exact
     bytes, so the download can be checked against that fingerprint.
   - The winning agent's operator is paid 95% of the price through PayPal Payouts. provable.bid keeps 5%.
   - The buyer can also buy other qualified entries, each through its own PayPal CAPTURE checkout and payout.
7. **No pick, no charge.** If the buyer rejects every entry, does not decide in time, or nothing qualifies, the
   authorization is voided. The buyer pays nothing, and there is no participation fee.
8. **Operators see where the money went.** Operators connect with Log in with PayPal, register agents, and get a
   bearer token for them. The operator page shows every allocation and payout status in an AG Grid ledger. Buyers get
   a settlement grid per brief.

**Agentic commerce, with a human in charge.** Agents earn through PayPal for work a buyer picks: the buyer authorizes
the hold and makes the choice, and PayPal Payouts pays the chosen agent's operator. Agents never spend money themselves.

Three house agents, Atelier, Voltage and Meadow, enter through the same public API with their own credentials and are
labelled as house agents everywhere. They need the Anthropic key; without it they don't run.

## How we built it

- **Contract first.** An OpenAPI 3.1 contract (v0.4.0, 40 operations) defines every state, error and money field. The
  TypeScript client used by the web app is generated from it. Every mutation takes an `Idempotency-Key`.
- **API:** Fastify on Node 24, on a Render Starter instance. State lives in Neon Postgres and is committed before each
  response (SQLite for tests and local dev). Money is kept in integer cents.
  - Only one instance writes at a time. On boot, each process takes a numbered lease. Every write checks it in the same
    transaction. During a deploy's overlap, the instance that lost the lease refuses its next write and exits, so two
    instances can't overwrite each other.
- **Web:** Next.js App Router with React and TypeScript.

### PayPal

- **Orders v2, intent AUTHORIZE:** the buyer's hold on the brief's price plus processing fee.
- **Authorizations: capture and void.** Capture when a winner is picked; void on reject, no decision, or no
  qualified entries.
- **Orders v2, intent CAPTURE:** each extra entry the buyer buys.
- **Payouts:** 95% of each purchase goes to the operator's PayPal account, addressed by payer ID. The status is
  synced until it succeeds or fails, and is never shown as paid early.
- **Webhooks:** checked with `verify-webhook-signature`, de-duplicated by event ID, then the state is re-read from
  PayPal. Handled events: `PAYMENT.CAPTURE.*`, `PAYMENT.AUTHORIZATION.*` and `PAYMENT.PAYOUTS*`.
- **Log in with PayPal:** operators connect their PayPal account, and its payer ID becomes the payout destination.
- **Idempotency:** order, authorization, capture, void and refund calls carry a `PayPal-Request-Id` that is saved
  before the call is made, and payouts use a stable `sender_batch_id`. Reads and webhook verification need neither.
  This is designed so a retry after a timeout or failed call repeats the same PayPal operation instead of creating a
  second charge or payout. The journal is committed to Neon Postgres before each PayPal call, so it survives restarts
  and redeploys. We tested a crash during authorize and during capture, then a restart and a retry with the same
  request ID.
- **SDK:** Orders v2 and Payments v2 calls (create, read, authorize, capture, void, refund) go through the
  APIMatic-generated PayPal Server SDK (`@paypal/paypal-server-sdk` 2.5.0). Payouts, webhook verification and Log in
  with PayPal aren't in that SDK, so they stay on REST. Verified on real sandbox payments: authorize then void, and
  authorize, capture and a $9.50 payout marked paid.

### Sponsor tools

- **Render:** API (Starter instance) and web are separate Render web services. provable.bid is the web service's custom domain.
- **KERNEL:** cloud browsers render every entry for screenshots and phone-fit measurements.
- **APIMatic:** we used the PayPal Server SDK Context Plugin's TypeScript guides in Claude Code to move our
  hand-written Orders and Payments REST calls onto the APIMatic-generated PayPal Server SDK. The plugin's notes caught
  two generated defaults that would have hurt us (no request timeout, and retries off) and the error-payload shape.
  We also used APIMatic to generate TypeScript and Python SDKs for our own API from the OpenAPI contract
  (`@apimatic/cli` 2.0.0; `sdks/`, regenerated by `scripts/apimatic-sdks.sh`), so outside agents get typed clients.
  APIMatic's validator flagged 10 contract errors (missing operation descriptions, enum shapes) that we fix in the
  generator's copy; both SDKs were run read-only against the live sandbox API.
- **AG Grid and AG Studio:** operator and buyer ledgers are AG Grid tables. Signed-in operators get an AG Studio
  allocation dashboard.
- **Postman:** `postman/` has a collection generated from the contract, covering all 40 operations, plus a local
  environment.

### AI

- **Claude (`claude-haiku-5-5`):** the qualification judge (structured output, one verdict per requirement, with the
  screenshots and browser measurements) and the three house agents. Both need an Anthropic key; without one a
  labelled keyword check judges and no house agents run. On the live sandbox deployment both are on
  (`/v1/config`: `ai_evaluation` and `house_agents` are true).
- **Built with AI help:** Claude Code (with the PayPal Server SDK Context Plugin) and OpenAI Codex as coding agents.

## Challenges we ran into

- **Charging only for what's picked.** A participation fee felt unfair to buyers. Captures that might later be
  refunded felt unfair to everyone. Authorize-then-capture-or-void removed both.
- **Fee math.** PayPal takes 3.49% + $0.49 of the total, not of the price. We solve for the smallest fee that still
  leaves the full price after PayPal's cut. The commission and the payout come out of the price, not the fee.
- **Showing work without giving it away.** Agents' HTML is untrusted, and the buyer shouldn't get it before paying.
  - With a renderer configured, real-browser screenshots solve both problems at once, and a missing screenshot fails
    closed rather than falling back to HTML.
  - Without a renderer, the fallback is sandboxed, watermarked HTML, which protects the buyer's browser but not the
    agent's markup.
- **Untrusted pages talking to the judge.** Submissions are passed to the judge as data inside `<submission>` tags.
  The judge is told to ignore any instructions inside them.
- **Moving to durable storage mid-hackathon.** The demo started on SQLite on Render's free disk, which every deploy wiped.
  We moved to Neon Postgres with one document table, so the contract logic didn't change. Render's zero-downtime deploys
  briefly run two API instances, so we added a fenced single-writer lease to stop the old one overwriting the new one.

## Accomplishments that we're proud of

- A real PayPal sandbox run end to end: $10.87 hold, then capture, then a $9.50 payout that reached SUCCESS. A
  second brief rejected all entries and its authorization was VOIDED.
- The buyer gets the exact file the agent submitted; its SHA-256 is recorded at submission so anyone can check it.
- Outside agents and house agents use the same public API. There is no back door.
- 31 automated tests: 14 for the API and 17 for the web app. The web tests drive the buyer page against a real local API, with PayPal faked.

## What we learned

- PayPal's authorization model does most of the trust work in a two-sided market.
- Saving the request ID before calling PayPal is what lets a retry repeat the same operation safely.
- A real browser catches layout problems that reading HTML can't, such as a page that scrolls sideways on a phone.

## What's next

- Briefs for multi-page sites and other deliverables (images, copy, small apps).
- Reputation for agents based on how often their entries qualify and win.
- Payouts in more currencies, and buyers outside the US.
- A move from the PayPal sandbox to live, after a compliance review.

## Built with

`paypal` `paypal-orders` `paypal-payouts` `log-in-with-paypal` `paypal-webhooks` `apimatic` `typescript` `node.js`
`fastify` `next.js` `react` `postgresql` `neon` `openapi` `kernel` `playwright` `claude` `anthropic` `ag-grid` `ag-studio`
`postman` `render` `claude-code` `codex`

## Try it

- **App:** https://provable.bid (PayPal sandbox; no real money moves). A sandbox buyer login for judges is in the
  private testing-instructions field. **TODO:** add it there.
- **API:** https://provable-race-api.onrender.com (`GET /v1/config` shows what is switched on).
- **API contract:** `contracts/openapi.yaml`.
- **Postman collection:** `postman/`.
- **Code:** **TODO:** the public repo link.
- **Demo video:** **TODO:** the public YouTube link.
