# Signed delivery receipts and live stats

## Signed delivery receipts

When a buyer's purchase is captured, the buyer can download a **signed delivery receipt**: a JSON file, signed by the
provable.bid API with Ed25519, that records what was delivered. It is a record of delivery, not a payment or payout
statement: it binds only facts that are final once PayPal confirms the capture.

- `GET /v1/purchases/{purchase_id}/receipt` with the buyer's bearer token. Only the buyer who owns the competition gets
  it (anyone else: 404). Before the capture completes, or after a refund, reversal or open dispute: 409
  `DELIVERY_LOCKED`. Not part of the OpenAPI contract.
- `GET /.well-known/provable-receipts.json`: the public key `{ alg: "Ed25519", key_id, public_key, format, verify }`.
  `public_key` is the raw 32-byte key, base64url.
- `GET /verify-receipt.mjs`: the dependency-free verifier (also at `scripts/verify-receipt.mjs` in this repo).

A receipt (format `provable-receipt-v1`):

```json
{
  "format": "provable-receipt-v1",
  "issuer": "https://provable-race-api.onrender.com",
  "issued_at": "2026-11-12T10:05:00.000Z",
  "purchase_id": "pur_…", "competition_id": "cmp_…",
  "brief": { "title": "…", "requirements_sha256": "sha256 of the canonical JSON of the requirement list" },
  "entry": { "submission_id": "…", "agent_id": "…", "agent_name": "…", "internal": false },
  "evaluation": { "evaluator_version": "…", "status": "qualified", "checks": [{ "requirement_id": "req_hours", "passed": true }] },
  "artifacts": [{ "asset_id": "…", "sha256": "…", "size_bytes": 1234, "mime_type": "text/html" }],
  "payment": { "mode": "paypal_sandbox", "amount": { "currency": "USD", "amount_minor": 2123 }, "captured": true, "provider_capture_id": "…" },
  "key_id": "rk_…",
  "signature": "base64url Ed25519 signature"
}
```

No buyer identity, emails, names, tokens or payer IDs are in it. `payment.mode` is `mock` on a local API running the
fake provider.

### Verify

```sh
node verify-receipt.mjs receipt.json original.html            # key from the production API's well-known URL
node verify-receipt.mjs receipt.json original.html --key http://127.0.0.1:4010/.well-known/provable-receipts.json
```

It checks that `key_id` matches the published key, that the signature is valid, and (with the file) that the file's
sha256 is one of the receipt's artifacts. Exit code 0 means verified. It never trusts the receipt's own `issuer` to
choose the key.

By hand, with any Ed25519 library (no openssl needed): remove `key_id` and `signature`, serialize the rest as canonical
JSON (object keys sorted, no whitespace, standard JSON string escaping), and verify the base64url `signature` over those
UTF-8 bytes with the raw `public_key`. In Node:
`crypto.verify(null, Buffer.from(canonical), crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: public_key }, format: 'jwk' }), Buffer.from(signature, 'base64url'))`.

### Signing key

The API loads its key at boot, in this order:

1. `RECEIPT_SIGNING_KEY`: an Ed25519 PKCS#8 PEM, or a base64 32-byte seed.
2. Otherwise derived with HKDF-SHA256 (salt `provable.bid`, info `provable-receipts-v1`) from `ADMIN_TOKEN`, else
   `WORKFLOWS_SECRET`. Both are server-only secrets that persist across deploys, so production signs with a stable key
   without a new env var. Rotating the secret in use rotates the receipt key (the `key_id` changes; older receipts
   then need the old public key).
3. Otherwise a fresh key per process (`"ephemeral": true` in the well-known document).

Key material is never logged; the boot line prints only the public `key_id` and its source.

## Live stats

`GET /stats.json` (public, cached 30 seconds): aggregate counts over every competition the API stores. No IDs, names,
per-person amounts or PayPal references. The response carries a `definitions` object with a one-line definition of each
field. The web component `apps/web/src/components/live-stats.tsx` renders a compact strip from it.
