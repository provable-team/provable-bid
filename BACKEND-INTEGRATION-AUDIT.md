# Backend integration review — observed branch, not runtime certification

Reviewed 2026-11-10. Contract baseline on `main`: `adb311b` (v0.2.0).
Collaborator prototype: `shiwani/escrow-bids` at
[`273de8f`](https://github.com/provable-team/provable-bid/tree/273de8f).
This is a read-only source review of selected files. No prototype provider calls,
deployment, database migration, test execution, or claim of sandbox approval occurred.
The branch and its unrelated history have not been modified or merged.

## Blocking product/contract differences

| Priority | Observed source | Difference and required alignment |
| --- | --- | --- |
| P1 | [lib/paypal/orders.ts](https://github.com/provable-team/provable-bid/blob/273de8f/lib/paypal/orders.ts#L27), [app/actions.ts](https://github.com/provable-team/provable-bid/blob/273de8f/app/actions.ts#L59) | Initial checkout uses CAPTURE and charges before opening. Contract requires AUTHORIZE first, then exactly one full purchase / 10% final partial capture / void branch. These are different products, not interchangeable API adapters. |
| P1 | [lib/escrow.ts](https://github.com/provable-team/provable-bid/blob/273de8f/lib/escrow.ts#L13) | Separate nonrefundable processing surcharge is added to the budget; unused budget is refunded. Contract authorizes the accepted bid only, has no buyer surcharge, and subsidizes expenses beyond the agreed cap. Do not silently copy surcharge/refund behavior into the $5 demo. Any changed buyer charge needs a new product/consent decision. |
| P1 | [lib/rules.ts](https://github.com/provable-team/provable-bid/blob/273de8f/lib/rules.ts#L4) | Minimum $10 and bidding choices 24/72/168 hours exclude the $5/five-minute demo and exceed the contract's 24-hour submission maximum. |
| P1 | [README.md](https://github.com/provable-team/provable-bid/blob/273de8f/README.md#L3), [lib/market.ts](https://github.com/provable-team/provable-bid/blob/273de8f/lib/market.ts#L329) | Bids carry prices, pitches, and partial HTML samples; complete delivery happens after award, followed by acceptance/revision. Contract competes with finished text/image artifacts before buyer selection and supports independent additional purchases. |
| P1 | [lib/paypal/payments.ts](https://github.com/provable-team/provable-bid/blob/273de8f/lib/paypal/payments.ts#L37), [lib/paypal/client.ts](https://github.com/provable-team/provable-bid/blob/273de8f/lib/paypal/client.ts#L5) | There is a Payouts implementation and an environment switch enabling live endpoints. README acknowledges production partner onboarding. Provisioning/approval is not established by source review or a PayPal login. Keep production marketplace settlement disabled until capabilities, approved model, funding, recipient setup, and acceptance evidence are explicitly established. |
| P1 | `git ls-tree -r 273de8f`, `lib/paypal/client.ts`, inspected routes | No PayPal webhook route was present in the inspected tree. A verification-related comment is not an implemented signed inbox/reconciler. Need verified durable webhook handling, canonical capture/refund/dispute reconciliation, and restart tests before treating this as the contract backend. |
| P2 | [lib/paypal/orders.ts](https://github.com/provable-team/provable-bid/blob/273de8f/lib/paypal/orders.ts#L49), [app/actions.ts](https://github.com/provable-team/provable-bid/blob/273de8f/app/actions.ts#L45) | Order creation generates a fresh provider request ID each call and attaches the resulting order afterward. No durable create-order operation/lease is established by the inspected path. Test duplicate creation and provider success followed by crash; preserve a persisted request ID and reconcile before replacement. Capture itself does use an order-derived stable key, which is useful but does not prove end-to-end crash recovery. |
| P2 | [README.md](https://github.com/provable-team/provable-bid/blob/273de8f/README.md#L12), [lib/rules.ts](https://github.com/provable-team/provable-bid/blob/273de8f/lib/rules.ts#L13) | Sandbox-observed pricing and the "never loses money" claim do not establish all live fees, caps, settlement reserves, refunds/disputes, or eligibility. Preserve actual fee evidence, disclose the subsidy policy, and test exact intended branches/account. |

The prototype already distinguishes operators and agent tokens and persists some
refund/payout ledger intentions before provider calls. Those are useful pieces to
adapt. They do not resolve the product differences above or prove multi-worker locking,
leases, signature validation, or provider capabilities. Its existing tests were not
run in this review; no negative conclusion about those tests is implied.

## Integration decision

Keep the finished-work authorization-first product as the proposed v0.3.0 contract.
Adapt useful prototype components behind that contract, or explicitly choose a new
product scope with updated contract and buyer terms. Do not merge the histories as if
their money flows, deadlines, or API routes already agree. This PR is a reviewable
contract/mock hardening proposal, not an automatic migration of that prototype.

Developer B can start with the [52-case acceptance matrix](ACCEPTANCE-PLAN.md), the
real sandbox branches in PAYPAL-FLOWS.md, and the breaking identity/reversal changes
in CONTRACT-CHANGES.md. Evidence from real database workers and sandbox account
operations must be attached separately from mock test output.
