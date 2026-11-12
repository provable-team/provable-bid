<!-- Generated file — do not edit; regenerated with the SDK. -->

# Studio — operations

Accessor: `client.studio` · Source: `provable_bid_api/apis/studio.py` · 3 operations

Each `###` block is one operation and assumes `sdk-map.md` is loaded: blocks omit what its invariants table covers and are otherwise self-contained, so chunk at block level. Signatures are the sync parsed spelling; the async and raw spellings take the same parameters (see sdk-map.md). **Type sources** names the module declaring each type an operation mentions, so resolving a body, return or error payload is a lookup rather than a search; the runtime types `RawError` and `ApiResult` are excluded.

### client.studio.get_studio_dashboard

- **Route**: `GET /v1/operators/me/studio-dashboard`
- **Auth**: `bearer_auth`
- **Signature**: `def get_studio_dashboard(*, request_options: RequestOptionsOrDict | None = None)`
- **Returns (parsed)**: `StudioDashboard`
- **Returns (raw)**: `ApiResult[StudioDashboard, GetStudioDashboardErrorBody]`
- **Error**: `GetStudioDashboardErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `StudioDashboard` | `provable_bid_api/models/studio_dashboard.py` |
| `GetStudioDashboardErrorBody` | `provable_bid_api/errors/get_studio_dashboard_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.studio.run_studio_ai_turn

- **Route**: `POST /v1/operators/me/studio-ai/turns`
- **Auth**: `bearer_auth`
- **Signature**: `def run_studio_ai_turn(idempotency_key: str, body: StudioAiTurnRequest | StudioAiTurnRequestDict, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `idempotency_key`, `body`
- **Params**: `idempotency_key` — header `Idempotency-Key` · `body` — JSON body
- **Returns (parsed)**: `StudioAiTurn`
- **Returns (raw)**: `ApiResult[StudioAiTurn, RunStudioAiTurnErrorBody]`
- **Error**: `RunStudioAiTurnErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `StudioAiTurnRequest` | `provable_bid_api/models/studio_ai_turn_request.py` |
| `StudioAiTurnRequestDict` | `provable_bid_api/models/studio_ai_turn_request.py` |
| `StudioAiTurn` | `provable_bid_api/models/studio_ai_turn.py` |
| `RunStudioAiTurnErrorBody` | `provable_bid_api/errors/run_studio_ai_turn_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.studio.save_studio_dashboard

- **Route**: `PUT /v1/operators/me/studio-dashboard`
- **Auth**: `bearer_auth`
- **Signature**: `def save_studio_dashboard(idempotency_key: str, body: StudioDashboardSave | StudioDashboardSaveDict, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `idempotency_key`, `body`
- **Params**: `idempotency_key` — header `Idempotency-Key` · `body` — JSON body
- **Returns (parsed)**: `StudioDashboardSaved`
- **Returns (raw)**: `ApiResult[StudioDashboardSaved, SaveStudioDashboardErrorBody]`
- **Error**: `SaveStudioDashboardErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `StudioDashboardSave` | `provable_bid_api/models/studio_dashboard_save.py` |
| `StudioDashboardSaveDict` | `provable_bid_api/models/studio_dashboard_save.py` |
| `StudioDashboardSaved` | `provable_bid_api/models/studio_dashboard_saved.py` |
| `SaveStudioDashboardErrorBody` | `provable_bid_api/errors/save_studio_dashboard_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

