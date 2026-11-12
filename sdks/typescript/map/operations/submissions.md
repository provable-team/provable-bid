<!-- Generated file — do not edit; regenerated with the SDK. -->

# Submissions — operations

Accessor: `client.submissions` · Source: `src/resources/submissions.ts` · 3 operations · Request and error types: namespace `Submissions`

**Type sources**: every type an operation names, with the file that declares it and the schema value exported beside it. Import every name from `provable-bid-sdk`; the `Source` path is where to **read** the shape, never what to import. `ApiError`, the runtime error family and the file vocabulary are excluded — see sdk-map.md.

### getSubmission

- **Signature**: `getSubmission(request: Submissions.GetSubmissionRequest, options?: RequestOptions): ApiPromise<Submission, Submissions.GetSubmissionError>`
- **Wire**: `GET /v1/submissions/{submission_id}`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `Submission`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Submissions.GetSubmissionError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Submissions.GetSubmissionRequest` (1):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `submissionId` | `path` | `submission_id` | `string` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `Submission` | `submissionSchema` | `src/models/submission.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### listSubmissions

- **Signature**: `listSubmissions(request: Submissions.ListSubmissionsRequest, options?: RequestOptions): ApiPromise<SubmissionPage, Submissions.ListSubmissionsError>`
- **Wire**: `GET /v1/competitions/{competition_id}/submissions`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `SubmissionPage`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Submissions.ListSubmissionsError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Submissions.ListSubmissionsRequest` (3):

| Field | Channel | Wire | Type | Req | Default |
| --- | --- | --- | --- | --- | --- |
| `competitionId` | `path` | `competition_id` | `string` | yes | — |
| `cursor` | `query` | — | `string` | no | — |
| `limit` | `query` | — | `number` | no | `20` |

| Type | Schema value | Source |
| --- | --- | --- |
| `SubmissionPage` | `submissionPageSchema` | `src/models/submission-page.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### submitWork

- **Signature**: `submitWork(request: Submissions.SubmitWorkRequest, options?: RequestOptions): ApiPromise<Submission, Submissions.SubmitWorkError>`
- **Wire**: `POST /v1/competitions/{competition_id}/submissions`
- **Auth**: `bearerAuth`
- **Request body**: `application/json` — the `body` field
- **Returns**: `Submission`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Submissions.SubmitWorkError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Submissions.SubmitWorkRequest` (3):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `competitionId` | `path` | `competition_id` | `string` | yes |
| `idempotencyKey` | `header` | `Idempotency-Key` | `string` | yes |
| `body` | `body` | — | `SubmitWork` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `SubmitWork` | `submitWorkSchema` | `src/models/submit-work.ts` |
| `Submission` | `submissionSchema` | `src/models/submission.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

