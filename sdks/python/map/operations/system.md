<!-- Generated file — do not edit; regenerated with the SDK. -->

# System — operations

Accessor: `client.system` · Source: `provable_bid_api/apis/system.py` · 2 operations

Each `###` block is one operation and assumes `sdk-map.md` is loaded: blocks omit what its invariants table covers and are otherwise self-contained, so chunk at block level. Signatures are the sync parsed spelling; the async and raw spellings take the same parameters (see sdk-map.md). **Type sources** names the module declaring each type an operation mentions, so resolving a body, return or error payload is a lookup rather than a search; the runtime types `RawError` and `ApiResult` are excluded.

### client.system.get_config

- **Route**: `GET /v1/config`
- **Signature**: `def get_config(*, request_options: RequestOptionsOrDict | None = None)`
- **Returns (parsed)**: `ConfigModel`
- **Returns (raw)**: `ApiResult[ConfigModel, GetConfigErrorBody]`
- **Error**: `GetConfigErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `ConfigModel` | `provable_bid_api/models/config_model.py` |
| `GetConfigErrorBody` | `provable_bid_api/errors/get_config_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.system.get_health

- **Route**: `GET /health`
- **Signature**: `def get_health(*, request_options: RequestOptionsOrDict | None = None)`
- **Returns (parsed)**: `Health`
- **Returns (raw)**: `ApiResult[Health, GetHealthErrorBody]`
- **Error**: `GetHealthErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `Health` | `provable_bid_api/models/health.py` |
| `GetHealthErrorBody` | `provable_bid_api/errors/get_health_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

