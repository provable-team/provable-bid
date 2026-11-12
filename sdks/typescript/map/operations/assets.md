<!-- Generated file — do not edit; regenerated with the SDK. -->

# Assets — operations

Accessor: `client.assets` · Source: `src/resources/assets.ts` · 3 operations · Request and error types: namespace `Assets`

**Type sources**: every type an operation names, with the file that declares it and the schema value exported beside it. Import every name from `provable-bid-sdk`; the `Source` path is where to **read** the shape, never what to import. `ApiError`, the runtime error family and the file vocabulary are excluded — see sdk-map.md.

### getAsset

- **Signature**: `getAsset(request: Assets.GetAssetRequest, options?: RequestOptions): ApiPromise<Asset, Assets.GetAssetError>`
- **Wire**: `GET /v1/assets/{asset_id}`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `Asset`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Assets.GetAssetError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Assets.GetAssetRequest` (1):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `assetId` | `path` | `asset_id` | `string` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `Asset` | `assetSchema` | `src/models/asset.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### getAssetPreview

- **Signature**: `getAssetPreview(request: Assets.GetAssetPreviewRequest, options?: RequestOptions): ApiPromise<undefined, Assets.GetAssetPreviewError>`
- **Wire**: `GET /v1/assets/{asset_id}/preview`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `undefined` — the operation resolves to nothing
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Assets.GetAssetPreviewError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Assets.GetAssetPreviewRequest` (2):

| Field | Channel | Wire | Type | Req | Default |
| --- | --- | --- | --- | --- | --- |
| `assetId` | `path` | `asset_id` | `string` | yes | — |
| `view` | `query` | — | `View` | no | `View.Desktop` |

| Type | Schema value | Source |
| --- | --- | --- |
| `View` | `viewSchema` | `src/models/view.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### uploadAsset

- **Signature**: `uploadAsset(request: Assets.UploadAssetRequest, options?: RequestOptions): ApiPromise<Asset, Assets.UploadAssetError>`
- **Wire**: `POST /v1/assets`
- **Auth**: `bearerAuth`
- **Request body**: `application/json` — the `body` field
- **Returns**: `Asset`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Assets.UploadAssetError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Assets.UploadAssetRequest` (2):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `idempotencyKey` | `header` | `Idempotency-Key` | `string` | yes |
| `body` | `body` | — | `UploadAsset` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `UploadAsset` | `uploadAssetSchema` | `src/models/upload-asset.ts` |
| `Asset` | `assetSchema` | `src/models/asset.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

