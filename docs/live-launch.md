# Live-payment launch assessment

Status: **not activated**. The public site at https://provable.bid currently reports `mode: paypal_sandbox`.
This document records the changes and evidence needed before replacing sandbox narration with a real-payment demo.

## Confirmed blockers in the deployed build

| Area | Current evidence | Required before a live pilot |
| --- | --- | --- |
| Merchant access | Live account owner and Live Payouts approval have not been established in this review. | Identify the owning PayPal Business account; verify live app access, Payouts approval, funding, Connect settings and live webhook registration privately. |
| Runtime environment | `paypalProvider` accepts `live`, but `server.ts` does not pass it; the provider reports `paypal_sandbox` unconditionally. | Add explicit, tested environment selection and truthful live-mode reporting. Keep the existing deployment on sandbox until all launch prerequisites pass. |
| API and frontend | Contract modes and payout modes contain only mock/sandbox states. Checkout allowlists only PayPal sandbox hosts; paid allocations are labelled as test payouts. | Add live modes throughout contract, generated client, compatibility checks, checkout-host validation and visible payment labels. Permit production PayPal hosts only in live mode. |
| Payment journal and originals | The Render blueprint uses a free API service and a relative SQLite path on ephemeral storage. | Provision persistent storage or a durable database; preserve payment operations, credentials, allocations and original assets across deploys/restarts, with a tested backup/restore process. |
| Refunds and losses after payout | Capture queues an immediate payout. Holds cannot recall a payout already sent. | Agree on the operating policy for refunds, disputes, reversals and losses after payout, including funding/reserve or recovery responsibility. Do not present the sandbox implementation as solving this. |
| Environment isolation | Existing sessions, operator identities, payer IDs and webhook IDs belong to sandbox. | Use separate live credentials, webhook configuration, accounts and data. Do not reuse sandbox payout-recipient IDs in production. |

## Account information needed

- Which PayPal Business account owns the live merchant application: Yosun's or Shiwani's?
- Has that account been approved for **Live Payouts**, and is it funded for the pilot and fees?
- Who owns the production deployment, support/refund handling, and payment-loss responsibility?
- Which persistent-storage service and recurring budget are approved by the owner?

Do not put secrets in this file, chat, Slack, recordings, or Git. Configure them only in the account owner's private deployment settings.

## Controlled launch sequence

1. Preserve the working sandbox environment for the hackathon and judge reproduction. Prepare a separate production configuration and data store.
2. Complete the account checks and engineering changes above in a reviewed branch. Verify live/sandbox separation and rejection of mixed credentials/checkout URLs.
3. Test retained journal recovery, duplicate/unknown outcomes, valid webhook verification, refunds and payout-state handling before admitting real customer traffic.
4. Have the owner approve the final deployment configuration, recurring hosting cost, pilot participants, recipients and maximum actual charge. Start with access restricted to those participants.
5. The human account holders perform the real PayPal approvals and other consequential financial actions. Observe provider-confirmed authorization, capture and payout results; do not mistake an API response or optimistic UI banner for completed settlement.
6. Record a separate provider-confirmed void or refund as applicable. Preserve the same deployment and IDs through each evidence sequence; no deployments during the run.
7. Only after the live pilot succeeds, approve opening payments to general visitors and update customer-facing terms, support details and the recording claims to match the operating service.

The existing $10 minimum plus a disclosed processing charge is a real cost in production. Do not initiate a live test until its exact participants, recipient and spending limit are approved.

## Transcript changes after a verified live run

Do **not** simply delete every sandbox label from the current script.

- Replace the overlay with **“Real PayPal payment · controlled launch test”** only on footage from actual production transactions.
- State the actual amount approved, the disclosed processing charge, and the confirmed allocation/payout amounts for that run. Do not assume sandbox fee measurements are the live account's final provider expense.
- Replace “confirmed sandbox payout” with “confirmed PayPal payout” only after the production item is successful.
- Show that the human buyer chooses and authorizes payment; the AI checks work but does not decide to spend on the buyer's behalf.
- Identify any remaining sandbox footage explicitly. Never combine sandbox transaction evidence with a claim that the whole flow used live money.

If live access or engineering readiness is incomplete, keep the final hackathon payment demo accurately labelled as sandbox. A public URL and a production PayPal payment are different milestones.

## Sources checked

- [PayPal production migration](https://developer.paypal.com/api/rest/production/): production credentials, hosts and account configuration.
- [PayPal Payouts prerequisites](https://developer.paypal.com/payouts/use-payouts/overview): Business account, approved access, verified account setup and sufficient funds.
- [Render persistent disks](https://render.com/docs/disks) and [free-service limitations](https://render.com/docs/free): ephemeral local files are lost on restart/redeploy; persistent disks require paid compute.

This assessment covers the observed blockers, not a completed production security or business-policy review.
