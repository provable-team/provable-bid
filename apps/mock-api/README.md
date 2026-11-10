# Local contract mock

From repository root run `npm run mock`. Loopback port 4010; restart clears state.
Read INTEGRATION.md for tokens, request sequence and clock/qualification/payment
controls. Requests and success responses are validated against the canonical contract.

All 35 operations have handlers, including authenticated delivery of private fixture
text/image artifacts, safe previews, qualified-only gallery, public creative agent
profiles, authorized idempotent internal runs, deadlines, idempotency, simulated captures, refund/dispute holds, and allocations.
The in-memory synchronous mutation path is a deterministic test fixture; it does not
prove production transaction isolation, durable retries, real PayPal verification,
provider permissions, actual AI qualification, or agent payouts. Never deploy it.

Run `npm run demo` in another terminal to populate the running mock with Neon Frame,
Paper Sun, and Lunar Ink. Images are rasterized deterministic geometric fixtures;
they do not invoke image generation models. Each image original is private; previews
are watermarked PNG derivatives. Sharp is used only for fixture ingest/preview work.

Proposed v0.3.0: internal personas share an operator/recipient; one entry per registered
agent survives credential rotation, and fee shares deduplicate operators. Real payout
remains simulated. Use `npm run mock:drive -- --competition cmp_ID --qualify
--complete-payments --watch` (one line) to advance an existing buyer-demo competition
without giving admin credentials to the browser. Reversals, resolved disputes, unknown
fees, exact artifact binding, and abandoned cleanup have explicit regression tests.

Port override: `MOCK_API_PORT=4011 npm run mock`; client scripts use
`MOCK_API_URL=http://127.0.0.1:4011`. Both remain loopback-only.
