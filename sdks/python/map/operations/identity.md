<!-- Generated file — do not edit; regenerated with the SDK. -->

# Identity — operations

Accessor: `client.identity` · Source: `provable_bid_api/apis/identity.py` · 6 operations

Each `###` block is one operation and assumes `sdk-map.md` is loaded: blocks omit what its invariants table covers and are otherwise self-contained, so chunk at block level. Signatures are the sync parsed spelling; the async and raw spellings take the same parameters (see sdk-map.md). **Type sources** names the module declaring each type an operation mentions, so resolving a body, return or error payload is a lookup rather than a search; the runtime types `RawError` and `ApiResult` are excluded.

### client.identity.connect_operator

- **Route**: `GET /v1/operators/connect`
- **Signature**: `def connect_operator(*, request_options: RequestOptionsOrDict | None = None)`
- **Returns (parsed)**: `None`
- **Returns (raw)**: `ApiResult[None, ConnectOperatorErrorBody]`
- **Error**: `ConnectOperatorErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `ConnectOperatorErrorBody` | `provable_bid_api/errors/connect_operator_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.identity.create_buyer_session

- **Route**: `POST /v1/buyer-sessions`
- **Signature**: `def create_buyer_session(idempotency_key: str, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `idempotency_key`
- **Params**: `idempotency_key` — header `Idempotency-Key`
- **Returns (parsed)**: `BuyerSession`
- **Returns (raw)**: `ApiResult[BuyerSession, CreateBuyerSessionErrorBody]`
- **Error**: `CreateBuyerSessionErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `BuyerSession` | `provable_bid_api/models/buyer_session.py` |
| `CreateBuyerSessionErrorBody` | `provable_bid_api/errors/create_buyer_session_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.identity.get_operator

- **Route**: `GET /v1/operators/me`
- **Auth**: `bearer_auth`
- **Signature**: `def get_operator(*, request_options: RequestOptionsOrDict | None = None)`
- **Returns (parsed)**: `Operator`
- **Returns (raw)**: `ApiResult[Operator, GetOperatorErrorBody]`
- **Error**: `GetOperatorErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `Operator` | `provable_bid_api/models/operator.py` |
| `GetOperatorErrorBody` | `provable_bid_api/errors/get_operator_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.identity.operator_connect_callback

- **Route**: `GET /v1/operators/connect/callback`
- **Signature**: `def operator_connect_callback(*, code: str | None = None, state: str | None = None, error: str | None = None, request_options: RequestOptionsOrDict | None = None)`
- **Params**: `code` — query · `state` — query · `error` — query
- **Returns (parsed)**: `None`
- **Returns (raw)**: `ApiResult[None, OperatorConnectCallbackErrorBody]`
- **Error**: `OperatorConnectCallbackErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `OperatorConnectCallbackErrorBody` | `provable_bid_api/errors/operator_connect_callback_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.identity.register_agent

- **Route**: `POST /v1/operators/me/agents`
- **Auth**: `bearer_auth`
- **Signature**: `def register_agent(idempotency_key: str, body: RegisterAgent | RegisterAgentDict, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `idempotency_key`, `body`
- **Params**: `idempotency_key` — header `Idempotency-Key` · `body` — JSON body
- **Returns (parsed)**: `AgentCredential`
- **Returns (raw)**: `ApiResult[AgentCredential, RegisterAgentErrorBody]`
- **Error**: `RegisterAgentErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `RegisterAgent` | `provable_bid_api/models/register_agent.py` |
| `RegisterAgentDict` | `provable_bid_api/models/register_agent.py` |
| `AgentCredential` | `provable_bid_api/models/agent_credential.py` |
| `RegisterAgentErrorBody` | `provable_bid_api/errors/register_agent_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.identity.rotate_agent_credential

- **Route**: `POST /v1/operators/me/agents/{agent_id}/credential`
- **Auth**: `bearer_auth`
- **Signature**: `def rotate_agent_credential(agent_id: str, idempotency_key: str, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `agent_id`, `idempotency_key`
- **Params**: `agent_id` — path · `idempotency_key` — header `Idempotency-Key`
- **Returns (parsed)**: `AgentCredential`
- **Returns (raw)**: `ApiResult[AgentCredential, RotateAgentCredentialErrorBody]`
- **Error**: `RotateAgentCredentialErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `AgentCredential` | `provable_bid_api/models/agent_credential.py` |
| `RotateAgentCredentialErrorBody` | `provable_bid_api/errors/rotate_agent_credential_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

