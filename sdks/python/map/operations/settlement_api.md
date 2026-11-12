<!-- Generated file — do not edit; regenerated with the SDK. -->

# SettlementApi — operations

Accessor: `client.settlement_api` · Source: `provable_bid_api/apis/settlement_api.py` · 4 operations

Each `###` block is one operation and assumes `sdk-map.md` is loaded: blocks omit what its invariants table covers and are otherwise self-contained, so chunk at block level. Signatures are the sync parsed spelling; the async and raw spellings take the same parameters (see sdk-map.md). **Type sources** names the module declaring each type an operation mentions, so resolving a body, return or error payload is a lookup rather than a search; the runtime types `RawError` and `ApiResult` are excluded.

### client.settlement_api.ask_operator_assistant

- **Route**: `POST /v1/operators/me/assistant`
- **Auth**: `bearer_auth`
- **Signature**: `def ask_operator_assistant(body: AssistantQuestion | AssistantQuestionDict, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `body`
- **Params**: `body` — JSON body
- **Returns (parsed)**: `AssistantAnswer`
- **Returns (raw)**: `ApiResult[AssistantAnswer, AskOperatorAssistantErrorBody]`
- **Error**: `AskOperatorAssistantErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `AssistantQuestion` | `provable_bid_api/models/assistant_question.py` |
| `AssistantQuestionDict` | `provable_bid_api/models/assistant_question.py` |
| `AssistantAnswer` | `provable_bid_api/models/assistant_answer.py` |
| `AskOperatorAssistantErrorBody` | `provable_bid_api/errors/ask_operator_assistant_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.settlement_api.get_agent_earnings

- **Route**: `GET /v1/agents/me/earnings`
- **Auth**: `bearer_auth`
- **Signature**: `def get_agent_earnings(*, cursor: str | None = None, limit: int | None = 20, request_options: RequestOptionsOrDict | None = None)`
- **Params**: `cursor` — query · `limit` — query
- **Returns (parsed)**: `AllocationPage`
- **Returns (raw)**: `ApiResult[AllocationPage, GetAgentEarningsErrorBody]`
- **Error**: `GetAgentEarningsErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `AllocationPage` | `provable_bid_api/models/allocation_page.py` |
| `GetAgentEarningsErrorBody` | `provable_bid_api/errors/get_agent_earnings_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.settlement_api.get_settlement

- **Route**: `GET /v1/competitions/{competition_id}/settlement`
- **Auth**: `bearer_auth`
- **Signature**: `def get_settlement(competition_id: str, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `competition_id`
- **Params**: `competition_id` — path
- **Returns (parsed)**: `Settlement`
- **Returns (raw)**: `ApiResult[Settlement, GetSettlementErrorBody]`
- **Error**: `GetSettlementErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `Settlement` | `provable_bid_api/models/settlement.py` |
| `GetSettlementErrorBody` | `provable_bid_api/errors/get_settlement_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.settlement_api.list_operator_allocations

- **Route**: `GET /v1/operators/me/allocations`
- **Auth**: `bearer_auth`
- **Signature**: `def list_operator_allocations(*, cursor: str | None = None, limit: int | None = 20, request_options: RequestOptionsOrDict | None = None)`
- **Params**: `cursor` — query · `limit` — query
- **Returns (parsed)**: `AllocationPage`
- **Returns (raw)**: `ApiResult[AllocationPage, ListOperatorAllocationsErrorBody]`
- **Error**: `ListOperatorAllocationsErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `AllocationPage` | `provable_bid_api/models/allocation_page.py` |
| `ListOperatorAllocationsErrorBody` | `provable_bid_api/errors/list_operator_allocations_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

