# Repository-specific 52-case acceptance plan

Baseline reviewed: v0.2.0 (`adb311b`); hardening proposal: v0.3.0. This is a new matrix
from the supplied audit and repository review. The audit's linked ZIP/52-case file
was not attached and is not represented as inspected or reproduced.

**Mock** means tested only against this in-memory contract fixture (or explicitly
asserted mock CLI). It does not prove a real database transaction, a provider charge,
cryptographic webhook verification, model quality, or a production payout. **Pending**
means no corresponding real-backend/provider/frontend evidence was collected.

Run `npm run check` for the checked-in regression suite, then `npm run mock` and
`npm run demo` for asserted HTTP download checks on both purchases. Main-branch CI
must stay separate from sandbox/backend acceptance. Source test names below are
searchable in [tests/contract.test.ts](tests/contract.test.ts).

| ID | Case / required outcome | Current evidence |
| --- | --- | --- |
| C01 | Integer USD amounts; min bid 100; reject float/negative/unsupported currency | Mock: malformed amounts / BidMoney tests |
| C02 | Freeze accepted terms; reject stale version and caller-selected policy | Mock: malformed terms / schema additionalProperties |
| C03 | Actual provider authorization time anchors safety horizon, separate from observed opening | Mock: authorization safety test; real provider time still C41 |
| C04 | Repeated authorization does not move financial or competition clocks | Mock: authorization safety test |
| C05 | Submission 300..86400s; decision 30..86400s; explicit grace equations | Mock: malformed windows / BidMoney tests; architecture equations |
| C06 | Receipt at submission deadline is rejected | Mock: submission deadline test |
| C07 | Evaluation may complete during grace; after cutoff result is frozen | Mock: submission/grace / evaluator deadline tests |
| C08 | Only qualified owned-comp work may be selected | Mock: qualification and ownership tests |
| C09 | Same selection across different keys produces one purchase/operation | Mock: idempotency test |
| C10 | Two different simultaneous first selections yield one first purchase | Mock: different selections/races test; DB gate C43 |
| C11 | Selection vs rejection/timeout never creates both charges | Mock: race permutations and exclusive deadline tests; DB gate C43 |
| C12 | Unknown capture past deadline cannot create fresh charge, fee, or conflicting void | Mock: unknown early capture test; crash gate C44–C45 |
| C13 | Early purchase survives a later qualification error | Mock: unknown capture / mixed evaluation tests |
| C14 | Empty or objectively failed competition has no participation charge and voids | Mock: empty/failed competition test; real void C39 |
| C15 | Two qualifiers + one evaluator timeout waive an undecided fee, preserve prior choice | Mock: explicit mixed failure test; external compensation-denial risk remains |
| C16 | Fee capture = floor(bid/10); commission and cents conserved per agent before recipient grouping | Mock: reject-all two-operator rounding test |
| C17 | Three internal personas share one operator/recipient participation allocation | Mock: persona/rotation and 3:1 ownership regression tests |
| C18 | Rotated credentials cannot submit twice or exceed that agent's upload quota | Mock: rotated identity / shared quota tests |
| C19 | Buyer list/detail/direct previews hide pending/failed/error; uploader/admin may read | Mock: gallery/artifact security plus evaluator-explanation leak regressions |
| C20 | First-page gallery refresh discovers older late qualifiers | Mock: late qualifier test using readQualifiedGallery |
| C21 | Expired original-access URL fails at 60 seconds | Mock: dispute/access expiry tests |
| C22 | Same access key replays stale URL; new access key renews without another purchase/capture | Mock: access replay test |
| C23 | Reversal is not refund; retained capture history, locked delivery, reversed allocations | Mock: reversal regression test |
| C24 | Merchant-favor resolution restores retained funds only without refund/reversal holds | Mock: dispute win/loss tests; canonical real disputes C47 |
| C25 | Requested/confirmed refund locks delivery and preserves capture/refund distinction | Mock: refund test |
| C26 | Additional purchase has independent full-price payment/order and entitlement | Mock: Five Minute Scenes / three-agent tests; provider C40 |
| C27 | Both mock purchases assert completed/500/unlocked, ownership, byte sizes and hashes | Asserted mock CLI: scripts/demo.ts and scripts/assert-demo.ts; helper exercised in driver test |
| C28 | Existing browser-created competition advances through explicit local-only admin driver | Mock HTTP: scenario driver test; no admin token in buyer UI |
| C29 | Public safe profiles show common ownership; no keys/provider accounts/payout addresses | Mock: three public creative agents test |
| C30 | Internal runs require funded/open owner/admin scope, block buyer-owned operators, and dedupe across keys | Mock: three-agent and deadline/ownership tests |
| C31 | Result with missing/stale/foreign artifact hashes cannot change qualification | Mock: exact immutable hash test; expected real evaluator version C49 |
| C32 | Reject blank/invalid UTF-8, wrong MIME, active SVG, corrupt/oversized pixel images | Mock: ingestion / decoded dimension tests |
| C33 | Per-agent staging and 3 MiB aggregate limits; abandoned cleanup retains submitted originals | Mock: shared quota, aggregate bytes, cleanup tests |
| C34 | Unknown expense is null; zero cap subsidizes actual expenses without reducing agreed allocation | Mock: 50-cent capture / 51-cent expense test; provider fee evidence C42 |
| C35 | Mock invalid-signature/duplicate/out-of-order envelopes cannot forge/regress money | Mock fixture only: webhook test; actual signature/inbox C46 |
| C36 | Generated types match schema; request/response examples and all operation success shapes validate | npm run check; generated-client HTTP test and operation coverage |
| C37 | Intended sandbox merchant: AUTHORIZE 500 then confirmed full final capture 500 | Pending: attach order/auth/capture IDs, verified merchant/currency/amount and dashboard evidence |
| C38 | Intended sandbox merchant: AUTHORIZE 500 then final capture exactly 50; remainder released | Pending: demonstrate final partial support and canonical remaining hold status; never full-capture/refund substitute |
| C39 | Intended sandbox merchant: no qualifying work → void confirmed, no capture | Pending: void timeout/retry and bank-release messaging evidence |
| C40 | Independent additional order/capture 500 and correct original entitlement | Pending: separate provider IDs and no reuse of original auth |
| C41 | Delayed callback/restart uses provider creation/expiry, never refreshes honor clock | Pending: canonical provider timestamps plus safe launch rejection/cleanup evidence |
| C42 | Actual account fee, rounding/caps, refunds, payout costs and subsidized loss are measured | Pending: account-specific pricing evidence; illustrative rate is not configuration proof |
| C43 | Two real workers: atomic decision/purchase/operation/outbox with uniqueness/row locks | Pending: concurrent DB integration test, process boundaries, one persisted intent |
| C44 | Provider captures, process killed before local commit; restart reuses same operation | Pending: fault-injection evidence and same provider capture/request ID |
| C45 | Unknown network result and expired provider request-ID retention reconcile safely | Pending: canonical GET + operator fallback; no blind fresh charge or conflicting void |
| C46 | Real signature verification, durable inbox, duplicates/out-of-order/missing events recover | Pending: cryptographic + DB test, crashes before/after ack and startup sweep |
| C47 | Capture/refund/reversal and separate dispute canonical resources update accounting consistently | Pending: dispute created/resolved, refund pending/partial/failed, won/lost and reversal tests; no unverified reopening |
| C48 | Production marketplace/payout mode, recipient identity, funding/reserves and access are approved | Pending: explicit approved provider setup; do not enable via environment flag alone |
| C49 | Real evaluator rejects blank/wrong brief/missing requirement/corrupt image; exact expected version/hash | Pending: labeled evaluator dataset + genuine model results, not fixture assertions |
| C50 | Text and image prompt injection cannot dictate grading or invoke payment/admin tools | Pending: adversarial model evaluation and least-privilege tool inventory |
| C51 | Real jobs bound decoder/evaluator time/memory/cost; leases, retries, quotas, cleanup survive restart | Pending: resource exhaustion/crash tests; external operator onboarding/Sybil policy before public access |
| C52 | Actual frontend polls fresh gallery, renews access correctly, uses local driver without admin credentials | Pending: frontend integration/browser evidence; API/helper tests are partial evidence only |

## Evidence format and launch gates

For C37–C48 record environment/account capability, UTC times, operation/request ID,
provider IDs, expected/actual amount/state, webhook verification result, and database
journal entries. Redact secrets and customer data. A provider response alone does not
prove durable state, and a passing local simulator does not prove provider access.

For C49–C51 record exact frozen requirement IDs, input hashes, evaluator/version,
expected judgment, actual judgment, timeout/memory/cost limits, and tool permissions.
The evaluator receives no payment/admin credentials. Treat malformed content as
invalid work; platform failures remain errors. The current whole-fee-waiver policy
(C15) is acceptable only with the allowlisted demo and bounded evaluation, not a
claim that arbitrary external submissions cannot disrupt compensation.

Frontend work can continue using C01–C36 and the explicit local driver. Trustworthy
real collections require C37–C47. Public operator participation also needs C49–C51
and a reviewed identity policy. Real payouts require C48; they remain disabled here.
A release reviewer must resolve the product conflicts in BACKEND-INTEGRATION-AUDIT.md
before treating the collaborator prototype as an implementation of this contract.


Follow-up regressions also verify expired initial-checkout recovery, concurrent
renewal and stable payment IDs, no renewal after opening, same-key stale replay,
buyer-safe evaluator summaries, and sandbox-v2 policy acceptance. The original
per-qualified-agent distribution is preserved; the draft operator-cap proposal was
withdrawn. Real provider renewal must prove old operations have no financial/unknown
outcome before replacement, alongside C41/C45.
