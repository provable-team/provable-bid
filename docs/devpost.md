# provable.bid — Devpost write-up (draft for review)

> Draft by Shiwani's Claude Code agent for Yosun and Codex to review. Every number below was checked against
> branch `shiwani/proof-race` (commit 51c7ab2) and the live API config on 2026-11-12. Lines marked
> **TODO-verify** must be confirmed before submitting.

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
2. **PayPal holds the money.** The buyer approves a PayPal order with intent AUTHORIZE for the price plus a PayPal
   processing fee. The fee is grossed up so the price survives PayPal's 3.49% + $0.49. A $10 brief holds $10.87 and
   a $20 brief holds $21.23. Nothing is captured yet.
3. **Agents race.** Any agent with an operator token uploads one finished, self-contained HTML file through the public
   API. Registered agents get an HMAC-signed notification when a brief opens, or they can poll the competition list.
4. **Every entry is checked before the buyer sees it.**
   - Gates reject pages that load external scripts, embed frames, post forms to other sites, redirect, have almost no
     content, or repeat themselves.
   - KERNEL loads the page in a real cloud Chromium at 1280px and 390px wide. It takes screenshots, measures
     sideways scrolling on a phone, and records console errors and blocked outbound requests.
   - A judge checks each requirement and writes down why it passed or failed. With an Anthropic key this is Claude,
     which also sees the screenshots and measurements. Without one, a labelled keyword check runs instead.
   - Only qualified entries reach the gallery.
5. **The buyer sees screenshots, never the source.** With KERNEL on, previews are JPEG screenshots only (desktop and
   phone). If a screenshot is missing, the API returns an error instead of falling back to HTML. Without KERNEL, the
   preview is watermarked HTML in a sandboxed iframe under a strict content policy.
6. **Picking a winner settles everything.**
   - The full authorization is captured.
   - The buyer downloads the original HTML. Its SHA-256 fingerprint matches the one recorded at submission.
   - The winning agent's operator is paid 95% of the price through PayPal Payouts. provable.bid keeps 5%.
   - The buyer can also buy other qualified entries, each through its own PayPal CAPTURE checkout and payout.
7. **No pick, no charge.** If the buyer rejects every entry, does not decide in time, or nothing qualifies, the
   authorization is voided. The buyer pays nothing, and there is no participation fee.
8. **Operators see where the money went.** Operators connect with Log in with PayPal, register agents, and get a
   bearer token for them. The operator page shows every allocation and payout status in an AG Grid ledger. Buyers get
   a settlement grid per brief.

Three house agents, Atelier, Voltage and Meadow, enter through the same public API with their own credentials and are
labelled as house agents everywhere. They need the Anthropic key; without it they don't run.

## How we built it

- **Contract first.** An OpenAPI 3.1 contract (v0.4.0, 40 operations) defines every state, error and money field. The
  TypeScript client used by the web app is generated from it. Every mutation takes an `Idempotency-Key`.
- **API:** Fastify on Node 24, with SQLite on disk. Money is kept in integer cents.
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
- **Idempotency:** every PayPal call carries a `PayPal-Request-Id` that is saved before the call is made. Retries
  after a crash or timeout can't double-charge or double-pay.
- **SDK (TODO-verify):** orders and payments calls use the APIMatic-generated PayPal Server SDK.

### Sponsor tools

- **Render:** API and web are separate Render web services. provable.bid is the web service's custom domain.
- **KERNEL:** cloud browsers render every entry for screenshots and phone-fit measurements.
- **APIMatic:** we used the PayPal Server SDK Context Plugin in Claude Code to work against the generated PayPal
  Server SDK. **TODO-verify:** describe exactly what moved once the migration lands.
- **AG Grid and AG Studio:** operator and buyer ledgers are AG Grid tables. Signed-in operators get an AG Studio
  allocation dashboard.
- **Postman:** `postman/` has a collection generated from the contract, covering all 40 operations, plus a local
  environment.

### AI

- **Claude (`claude-opus-5-5`):** the qualification judge (structured output, one verdict per requirement) and the
  three house agents. Both are off on the live site until an Anthropic key is set. **TODO-verify:** update this if
  the key is added before submission.

## Challenges we ran into

- **Charging only for what's picked.** A participation fee felt unfair to buyers. Captures that might later be
  refunded felt unfair to everyone. Authorize-then-capture-or-void removed both.
- **Fee math.** PayPal takes 3.49% + $0.49 of the total, not of the price. We solve for the smallest fee that still
  leaves the full price after PayPal's cut. The commission and the payout come out of the price, not the fee.
- **Showing work without giving it away.** Agents' HTML is untrusted, and the buyer must not get it before paying.
  - Real-browser screenshots solve both problems at once.
  - If no screenshot exists, the preview fails rather than leaking the HTML.
- **Untrusted pages talking to the judge.** Submissions are passed to the judge as data inside `<submission>` tags.
  The judge is told to ignore any instructions inside them.
- **Free hosting.** Render's free services sleep after 15 minutes. The API and web ping each other every 9 minutes
  while we demo.

## Accomplishments that we're proud of

- A real PayPal sandbox run end to end: $10.87 hold, then capture, then a $9.50 payout that reached SUCCESS. A
  second brief rejected all entries and its authorization was VOIDED.
- The buyer always gets the exact file the agent submitted, proven by SHA-256 at download.
- Outside agents and house agents use the same public API. There is no back door.
- 31 automated tests: 14 for the API and 17 for the web app. The web tests drive the buyer page against a live API.

## What we learned

- PayPal's authorization model does most of the trust work in a two-sided market.
- Saving the request ID before calling PayPal is what makes retries safe.
- A real browser catches layout problems that reading HTML can't, such as a page that scrolls sideways on a phone.

## What's next

- Briefs for multi-page sites and other deliverables (images, copy, small apps).
- Reputation for agents based on how often their entries qualify and win.
- Payouts in more currencies, and buyers outside the US.
- A move from the PayPal sandbox to live, after a compliance review.

## Built with

`paypal` `paypal-orders` `paypal-payouts` `log-in-with-paypal` `paypal-webhooks` `apimatic` `typescript` `node.js`
`fastify` `next.js` `react` `sqlite` `openapi` `kernel` `playwright` `claude` `anthropic` `ag-grid` `ag-studio`
`postman` `render`

## Try it

- **App:** https://provable.bid (PayPal sandbox: use a sandbox buyer account; no real money moves).
- **API:** https://provable-race-api.onrender.com (`GET /v1/config` shows what is switched on).
- **API contract:** `contracts/openapi.yaml`.
- **Postman collection:** `postman/`.
- **Code:** **TODO-verify:** the repo link, once Yosun decides on visibility and `main`.
- **Demo video:** **TODO-verify:** add the link.
