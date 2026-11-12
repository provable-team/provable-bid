<!-- Generated file — do not edit; regenerated with the SDK. -->

# Submissions — operations

Accessor: `client.submissions` · Source: `provable_bid_api/apis/submissions.py` · 3 operations

Each `###` block is one operation and assumes `sdk-map.md` is loaded: blocks omit what its invariants table covers and are otherwise self-contained, so chunk at block level. Signatures are the sync parsed spelling; the async and raw spellings take the same parameters (see sdk-map.md). **Type sources** names the module declaring each type an operation mentions, so resolving a body, return or error payload is a lookup rather than a search; the runtime types `RawError` and `ApiResult` are excluded.

### client.submissions.get_submission

- **Route**: `GET /v1/submissions/{submission_id}`
- **Auth**: `bearer_auth`
- **Signature**: `def get_submission(submission_id: str, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `submission_id`
- **Params**: `submission_id` — path
- **Returns (parsed)**: `Submission`
- **Returns (raw)**: `ApiResult[Submission, GetSubmissionErrorBody]`
- **Error**: `GetSubmissionErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `Submission` | `provable_bid_api/models/submission.py` |
| `GetSubmissionErrorBody` | `provable_bid_api/errors/get_submission_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.submissions.list_submissions

- **Route**: `GET /v1/competitions/{competition_id}/submissions`
- **Auth**: `bearer_auth`
- **Signature**: `def list_submissions(competition_id: str, *, cursor: str | None = None, limit: int | None = 20, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `competition_id`
- **Params**: `competition_id` — path · `cursor` — query · `limit` — query
- **Returns (parsed)**: `SubmissionPage`
- **Returns (raw)**: `ApiResult[SubmissionPage, ListSubmissionsErrorBody]`
- **Error**: `ListSubmissionsErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `SubmissionPage` | `provable_bid_api/models/submission_page.py` |
| `ListSubmissionsErrorBody` | `provable_bid_api/errors/list_submissions_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.submissions.submit_work

- **Route**: `POST /v1/competitions/{competition_id}/submissions`
- **Auth**: `bearer_auth`
- **Signature**: `def submit_work(competition_id: str, idempotency_key: str, body: SubmitWork | SubmitWorkDict, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `competition_id`, `idempotency_key`, `body`
- **Params**: `competition_id` — path · `idempotency_key` — header `Idempotency-Key` · `body` — JSON body
- **Returns (parsed)**: `Submission`
- **Returns (raw)**: `ApiResult[Submission, SubmitWorkErrorBody]`
- **Error**: `SubmitWorkErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `SubmitWork` | `provable_bid_api/models/submit_work.py` |
| `SubmitWorkDict` | `provable_bid_api/models/submit_work.py` |
| `Submission` | `provable_bid_api/models/submission.py` |
| `SubmitWorkErrorBody` | `provable_bid_api/errors/submit_work_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

