# Payment environments

This change prepares explicit environment support. **It does not activate live payments.** The Render blueprint
sets `PAYPAL_ENV=sandbox`, and omitting this variable also selects sandbox.

| Configuration | Behavior |
| --- | --- |
| No PayPal credentials, no explicit provider | Local fake provider; API mode `mock` |
| PayPal credentials, omitted `PAYPAL_ENV` | Sandbox API, SDK, Connect and approval hosts; API mode `paypal_sandbox` |
| `PAYMENTS=paypal`, `PAYPAL_ENV=sandbox` | Explicit sandbox; sandbox test cards may be enabled for scripts |
| `PAYMENTS=paypal`, `PAYPAL_ENV=live` | Production API, SDK, Connect and approval hosts; API mode `paypal_live` |
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
resolved before activation. Keep the working sandbox deployment available for hackathon reproduction.

Integration with the queued operator assistant (PR #12) must derive its PayPal Agent Toolkit `sandbox` option
from this server's selected environment (`payments.environment !== 'live'`). Its current hardcoded `sandbox: true`
must not be combined with a live provider and live credentials. Keep that assistant disabled in a live deployment
until the environment wiring and its read-only transport tests are updated together.

Validation uses in-memory API fixtures and stubbed SDK/REST transports only. It makes no real PayPal financial
calls and does not prove the owner's live account or Payouts approval.

Official references: [PayPal API environments](https://developer.paypal.com/api/rest/requests/),
[moving to production](https://developer.paypal.com/api/rest/production/),
and [Payouts prerequisites](https://developer.paypal.com/payouts/use-payouts/overview).
