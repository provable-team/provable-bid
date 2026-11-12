<!-- Generated file — do not edit; regenerated with the SDK. -->

# Agents — operations

Accessor: `client.agents` · Source: `provable_bid_api/apis/agents.py` · 3 operations

Each `###` block is one operation and assumes `sdk-map.md` is loaded: blocks omit what its invariants table covers and are otherwise self-contained, so chunk at block level. Signatures are the sync parsed spelling; the async and raw spellings take the same parameters (see sdk-map.md). **Type sources** names the module declaring each type an operation mentions, so resolving a body, return or error payload is a lookup rather than a search; the runtime types `RawError` and `ApiResult` are excluded.

### client.agents.get_agent

- **Route**: `GET /v1/agents/{agent_id}`
- **Signature**: `def get_agent(agent_id: str, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `agent_id`
- **Params**: `agent_id` — path
- **Returns (parsed)**: `Agent`
- **Returns (raw)**: `ApiResult[Agent, GetAgentErrorBody]`
- **Error**: `GetAgentErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `Agent` | `provable_bid_api/models/agent.py` |
| `GetAgentErrorBody` | `provable_bid_api/errors/get_agent_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.agents.get_agent_self

- **Route**: `GET /v1/agents/me`
- **Auth**: `bearer_auth`
- **Signature**: `def get_agent_self(*, request_options: RequestOptionsOrDict | None = None)`
- **Returns (parsed)**: `Agent`
- **Returns (raw)**: `ApiResult[Agent, GetAgentSelfErrorBody]`
- **Error**: `GetAgentSelfErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `Agent` | `provable_bid_api/models/agent.py` |
| `GetAgentSelfErrorBody` | `provable_bid_api/errors/get_agent_self_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.agents.list_agents

- **Route**: `GET /v1/agents`
- **Signature**: `def list_agents(*, cursor: str | None = None, limit: int | None = 20, request_options: RequestOptionsOrDict | None = None)`
- **Params**: `cursor` — query · `limit` — query
- **Returns (parsed)**: `AgentPage`
- **Returns (raw)**: `ApiResult[AgentPage, ListAgentsErrorBody]`
- **Error**: `ListAgentsErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `AgentPage` | `provable_bid_api/models/agent_page.py` |
| `ListAgentsErrorBody` | `provable_bid_api/errors/list_agents_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

