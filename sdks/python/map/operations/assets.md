<!-- Generated file — do not edit; regenerated with the SDK. -->

# Assets — operations

Accessor: `client.assets` · Source: `provable_bid_api/apis/assets.py` · 3 operations

Each `###` block is one operation and assumes `sdk-map.md` is loaded: blocks omit what its invariants table covers and are otherwise self-contained, so chunk at block level. Signatures are the sync parsed spelling; the async and raw spellings take the same parameters (see sdk-map.md). **Type sources** names the module declaring each type an operation mentions, so resolving a body, return or error payload is a lookup rather than a search; the runtime types `RawError` and `ApiResult` are excluded.

### client.assets.get_asset

- **Route**: `GET /v1/assets/{asset_id}`
- **Auth**: `bearer_auth`
- **Signature**: `def get_asset(asset_id: str, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `asset_id`
- **Params**: `asset_id` — path
- **Returns (parsed)**: `Asset`
- **Returns (raw)**: `ApiResult[Asset, GetAssetErrorBody]`
- **Error**: `GetAssetErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `Asset` | `provable_bid_api/models/asset.py` |
| `GetAssetErrorBody` | `provable_bid_api/errors/get_asset_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.assets.get_asset_preview

- **Route**: `GET /v1/assets/{asset_id}/preview`
- **Auth**: `bearer_auth`
- **Signature**: `def get_asset_preview(asset_id: str, *, view: ViewOrStr | None = View.DESKTOP, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `asset_id`
- **Params**: `asset_id` — path · `view` — query
- **Returns (parsed)**: `None`
- **Returns (raw)**: `ApiResult[None, GetAssetPreviewErrorBody]`
- **Error**: `GetAssetPreviewErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `ViewOrStr` | `provable_bid_api/models/enums/view.py` |
| `GetAssetPreviewErrorBody` | `provable_bid_api/errors/get_asset_preview_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

### client.assets.upload_asset

- **Route**: `POST /v1/assets`
- **Auth**: `bearer_auth`
- **Signature**: `def upload_asset(idempotency_key: str, body: UploadAsset | UploadAssetDict, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `idempotency_key`, `body`
- **Params**: `idempotency_key` — header `Idempotency-Key` · `body` — JSON body
- **Returns (parsed)**: `Asset`
- **Returns (raw)**: `ApiResult[Asset, UploadAssetErrorBody]`
- **Error**: `UploadAssetErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 404, 409, 413, 422, 429, 503] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `UploadAsset` | `provable_bid_api/models/upload_asset.py` |
| `UploadAssetDict` | `provable_bid_api/models/upload_asset.py` |
| `Asset` | `provable_bid_api/models/asset.py` |
| `UploadAssetErrorBody` | `provable_bid_api/errors/upload_asset_error.py` |
| `Problem` | `provable_bid_api/models/problem.py` |

