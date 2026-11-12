<!-- Generated file — do not edit; regenerated with the SDK. -->

# Competitions — operations

Accessor: `client.competitions` · Source: `src/resources/competitions.ts` · 5 operations · Request and error types: namespace `Competitions`

**Type sources**: every type an operation names, with the file that declares it and the schema value exported beside it. Import every name from `provable-bid-sdk`; the `Source` path is where to **read** the shape, never what to import. `ApiError`, the runtime error family and the file vocabulary are excluded — see sdk-map.md.

### createCompetition

- **Signature**: `createCompetition(request: Competitions.CreateCompetitionRequest, options?: RequestOptions): ApiPromise<Competition, Competitions.CreateCompetitionError>`
- **Wire**: `POST /v1/competitions`
- **Auth**: `bearerAuth`
- **Request body**: `application/json` — the `body` field
- **Returns**: `Competition`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Competitions.CreateCompetitionError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Competitions.CreateCompetitionRequest` (2):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `idempotencyKey` | `header` | `Idempotency-Key` | `string` | yes |
| `body` | `body` | — | `CreateCompetition` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `CreateCompetition` | `createCompetitionSchema` | `src/models/create-competition.ts` |
| `Competition` | `competitionSchema` | `src/models/competition.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### getCompetition

- **Signature**: `getCompetition(request: Competitions.GetCompetitionRequest, options?: RequestOptions): ApiPromise<Competition, Competitions.GetCompetitionError>`
- **Wire**: `GET /v1/competitions/{competition_id}`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `Competition`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Competitions.GetCompetitionError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Competitions.GetCompetitionRequest` (1):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `competitionId` | `path` | `competition_id` | `string` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `Competition` | `competitionSchema` | `src/models/competition.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### listCompetitions

- **Signature**: `listCompetitions(request?: Competitions.ListCompetitionsRequest, options?: RequestOptions): ApiPromise<CompetitionPage, Competitions.ListCompetitionsError>`
- **Wire**: `GET /v1/competitions`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `CompetitionPage`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Competitions.ListCompetitionsError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Competitions.ListCompetitionsRequest` (2):

| Field | Channel | Type | Req | Default |
| --- | --- | --- | --- | --- |
| `cursor` | `query` | `string` | no | — |
| `limit` | `query` | `number` | no | `20` |

| Type | Schema value | Source |
| --- | --- | --- |
| `CompetitionPage` | `competitionPageSchema` | `src/models/competition-page.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### rejectAll

- **Signature**: `rejectAll(request: Competitions.RejectAllRequest, options?: RequestOptions): ApiPromise<Payment, Competitions.RejectAllError>`
- **Wire**: `POST /v1/competitions/{competition_id}/rejection`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `Payment`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Competitions.RejectAllError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Competitions.RejectAllRequest` (2):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `competitionId` | `path` | `competition_id` | `string` | yes |
| `idempotencyKey` | `header` | `Idempotency-Key` | `string` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `Payment` | `paymentSchema` | `src/models/payment.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### selectFirstWinner

- **Signature**: `selectFirstWinner(request: Competitions.SelectFirstWinnerRequest, options?: RequestOptions): ApiPromise<Purchase, Competitions.SelectFirstWinnerError>`
- **Wire**: `POST /v1/competitions/{competition_id}/selection`
- **Auth**: `bearerAuth`
- **Request body**: `application/json` — the `body` field
- **Returns**: `Purchase`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Competitions.SelectFirstWinnerError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Competitions.SelectFirstWinnerRequest` (3):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `competitionId` | `path` | `competition_id` | `string` | yes |
| `idempotencyKey` | `header` | `Idempotency-Key` | `string` | yes |
| `body` | `body` | — | `SelectSubmission` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `SelectSubmission` | `selectSubmissionSchema` | `src/models/select-submission.ts` |
| `Purchase` | `purchaseSchema` | `src/models/purchase.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

