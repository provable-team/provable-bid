# Payment environments

This change prepares explicit environment support. **Server startup is deliberately blocked in live mode.** The Render blueprint
sets `PAYPAL_ENV=sandbox`, and omitting this variable also selects sandbox.

| Configuration | Behavior |
| --- | --- |
| No PayPal credentials, no explicit provider | Local fake provider; API mode `mock` |
| PayPal credentials, omitted `PAYPAL_ENV` | Sandbox API, SDK, Connect and approval hosts; API mode `paypal_sandbox` |
| `PAYMENTS=paypal`, `PAYPAL_ENV=sandbox` | Explicit sandbox; sandbox test cards may be enabled for scripts |
| `PAYMENTS=paypal`, `PAYPAL_ENV=live` | Startup blocked until environment-bound persistent storage and production recovery safeguards are implemented |
| Live mode with missing credentials, fake provider, or test-card checkout | Startup fails before network calls |

Only `sandbox` and `live` are valid `PAYPAL_ENV` values. PayPal approval URLs require HTTPS, exact hosts from
the selected environment, no credentials, no fragments, and no nonstandard port. Sandbox and live hosts are never
interchangeable. Real PayPal modes cannot use simulated payouts.

Before a separate live deployment, the owner must configure a live REST application, its credentials and registered
webhook ID, production Log in with PayPal redirect settings, and approved/funded Live Payouts access. Use a separate
data store and environment-specific operator recipients: sandbox buyer sessions, payer IDs, payment IDs, agent
credentials and pending operation journals must not be reused for live payments. A mode flag cannot identify or
convert previously stored sandbox records.

The mode work does not settle the remaining production requirements: a tested single-writer storage/deployment
strategy, the merchant's fee model, and operating responsibility for refunds/disputes after payouts. Those must be
resolved before activation. The explicit startup block must remain until those prerequisites are implemented and
verified; configuration alone cannot prove an existing database belongs to the live environment. Keep the working
sandbox deployment available for hackathon reproduction.

Validation uses in-memory API fixtures and stubbed SDK/REST transports only. It makes no real PayPal financial
calls and does not prove the owner's live account or Payouts approval.

The operator assistant is disabled in live mode until its PayPal Agent Toolkit is wired and tested for the selected
environment. The current release supports PostgreSQL and a single-writer lease, but a separate live database and
tested deployment/recovery procedures are still required.

Official references: [PayPal API environments](https://developer.paypal.com/api/rest/requests/),
[moving to production](https://developer.paypal.com/api/rest/production/),
and [Payouts prerequisites](https://developer.paypal.com/payouts/use-payouts/overview).
