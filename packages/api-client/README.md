# @provable/api-client

Generated path, body, parameter, response, and shared model types in `src/schema.d.ts`
come directly from `contracts/openapi.yaml` using openapi-typescript. `src/index.ts`
provides the small openapi-fetch transport factory and type exports. Use the same
client against mock or actual backend by changing `baseUrl`.

```sh
npm run client:generate
npm run client:check
```

Do not edit schema.d.ts manually. No implicit retries; provide an Idempotency-Key for
every command and reuse that logical key after network failures. See INTEGRATION.md
for a typed example and the complete demo sequence. Source TypeScript is exported
for the workspace Next.js build; package publishing is outside the MVP.

Proposed wire version: 0.3.0 (requires review against the published v0.2.0 baseline). Submission content is now uploaded as private text/image
assets and referenced through artifacts; delivery returns one URL per original. Read
CONTRACT-CHANGES.md and INTEGRATION.md before migrating a v0.1.0 consumer.

`readQualifiedGallery(client, competitionId)` starts every poll at page one and merges
by ID; a saved forward cursor alone misses older late qualifiers. Access-link retry
reuses a key; known expiry requires a new key for a fresh nonfinancial access request,
never another purchase. Identity/allocation/result/payment fields changed in v0.3.0;
see CONTRACT-CHANGES.md.
