<!-- Generated file — do not edit; regenerated with the SDK. -->

# Competitions — operations

Accessor: `client.competitions` · Source: `provable_bid_api/apis/competitions.py` · 5 operations

Each `###` block is one operation and assumes `sdk-map.md` is loaded: blocks omit what its invariants table covers and are otherwise self-contained, so chunk at block level. Signatures are the sync parsed spelling; the async and raw spellings take the same parameters (see sdk-map.md). **Type sources** names the module declaring each type an operation mentions, so resolving a body, return or error payload is a lookup rather than a search; the runtime types `RawError` and `ApiResult` are excluded.

### client.competitions.create_competition

- **Route**: `POST /v1/competitions`
- **Auth**: `bearer_auth`
- **Signature**: `def create_competition(idempotency_key: str, body: CreateCompetition | CreateCompetitionDict, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `idempotency_key`, `body`
- **Params**: `idempotency_key` — header `Idempotency-Key` · `body` — JSON body
- **Returns (parsed)**: `Competition`
- **Returns (raw)**: `ApiResult[Competition, CreateCompetitionErrorBody]`
- **Error**: `CreateCompetitionErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `CreateCompetition` | `provable_bid_api/models/create_competition.py` |
| `CreateCompetitionDict` | `provable_bid_api/models/create_competition.py` |
| `Competition` | `provable_bid_api/models/competition.py` |
| `CreateCompetitionErrorBody` | `provable_bid_api/errors/create_competition_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.competitions.get_competition

- **Route**: `GET /v1/competitions/{competition_id}`
- **Auth**: `bearer_auth`
- **Signature**: `def get_competition(competition_id: str, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `competition_id`
- **Params**: `competition_id` — path
- **Returns (parsed)**: `Competition`
- **Returns (raw)**: `ApiResult[Competition, GetCompetitionErrorBody]`
- **Error**: `GetCompetitionErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `Competition` | `provable_bid_api/models/competition.py` |
| `GetCompetitionErrorBody` | `provable_bid_api/errors/get_competition_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.competitions.list_competitions

- **Route**: `GET /v1/competitions`
- **Auth**: `bearer_auth`
- **Signature**: `def list_competitions(*, cursor: str | None = None, limit: int | None = 20, request_options: RequestOptionsOrDict | None = None)`
- **Params**: `cursor` — query · `limit` — query
- **Returns (parsed)**: `CompetitionPage`
- **Returns (raw)**: `ApiResult[CompetitionPage, ListCompetitionsErrorBody]`
- **Error**: `ListCompetitionsErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `CompetitionPage` | `provable_bid_api/models/competition_page.py` |
| `ListCompetitionsErrorBody` | `provable_bid_api/errors/list_competitions_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.competitions.reject_all

- **Route**: `POST /v1/competitions/{competition_id}/rejection`
- **Auth**: `bearer_auth`
- **Signature**: `def reject_all(competition_id: str, idempotency_key: str, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `competition_id`, `idempotency_key`
- **Params**: `competition_id` — path · `idempotency_key` — header `Idempotency-Key`
- **Returns (parsed)**: `Payment`
- **Returns (raw)**: `ApiResult[Payment, RejectAllErrorBody]`
- **Error**: `RejectAllErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `Payment` | `provable_bid_api/models/payment.py` |
| `RejectAllErrorBody` | `provable_bid_api/errors/reject_all_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.competitions.select_first_winner

- **Route**: `POST /v1/competitions/{competition_id}/selection`
- **Auth**: `bearer_auth`
- **Signature**: `def select_first_winner(competition_id: str, idempotency_key: str, body: SelectSubmission | SelectSubmissionDict, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `competition_id`, `idempotency_key`, `body`
- **Params**: `competition_id` — path · `idempotency_key` — header `Idempotency-Key` · `body` — JSON body
- **Returns (parsed)**: `Purchase`
- **Returns (raw)**: `ApiResult[Purchase, SelectFirstWinnerErrorBody]`
- **Error**: `SelectFirstWinnerErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `SelectSubmission` | `provable_bid_api/models/select_submission.py` |
| `SelectSubmissionDict` | `provable_bid_api/models/select_submission.py` |
| `Purchase` | `provable_bid_api/models/purchase.py` |
| `SelectFirstWinnerErrorBody` | `provable_bid_api/errors/select_first_winner_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

