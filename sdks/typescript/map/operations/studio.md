<!-- Generated file — do not edit; regenerated with the SDK. -->

# Studio — operations

Accessor: `client.studio` · Source: `src/resources/studio.ts` · 1 operation · Request and error types: namespace `Studio`

**Type sources**: every type an operation names, with the file that declares it and the schema value exported beside it. Import every name from `provable-bid-sdk`; the `Source` path is where to **read** the shape, never what to import. `ApiError`, the runtime error family and the file vocabulary are excluded — see sdk-map.md.

### runStudioAiTurn

- **Signature**: `runStudioAiTurn(request: Studio.RunStudioAiTurnRequest, options?: RequestOptions): ApiPromise<StudioAiTurn, Studio.RunStudioAiTurnError>`
- **Wire**: `POST /v1/operators/me/studio-ai/turns`
- **Auth**: `bearerAuth`
- **Request body**: `application/json` — the `body` field
- **Returns**: `StudioAiTurn`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Studio.RunStudioAiTurnError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [422] `Problem` · `"problem7"` [429] `Problem` · `"problem8"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Studio.RunStudioAiTurnRequest` (2):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `idempotencyKey` | `header` | `Idempotency-Key` | `string` | yes |
| `body` | `body` | — | `StudioAiTurnRequest` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `StudioAiTurnRequest` | `studioAiTurnRequestSchema` | `src/models/studio-ai-turn-request.ts` |
| `StudioAiTurn` | `studioAiTurnSchema` | `src/models/studio-ai-turn.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

