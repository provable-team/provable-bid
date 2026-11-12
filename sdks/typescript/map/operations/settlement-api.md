<!-- Generated file — do not edit; regenerated with the SDK. -->

# SettlementApi — operations

Accessor: `client.settlementApi` · Source: `src/resources/settlement-api.ts` · 4 operations · Request and error types: namespace `SettlementApi`

**Type sources**: every type an operation names, with the file that declares it and the schema value exported beside it. Import every name from `provable-bid-sdk`; the `Source` path is where to **read** the shape, never what to import. `ApiError`, the runtime error family and the file vocabulary are excluded — see sdk-map.md.

### askOperatorAssistant

- **Signature**: `askOperatorAssistant(request: SettlementApi.AskOperatorAssistantRequest, options?: RequestOptions): ApiPromise<AssistantAnswer, SettlementApi.AskOperatorAssistantError>`
- **Wire**: `POST /v1/operators/me/assistant`
- **Auth**: `bearerAuth`
- **Request body**: `application/json` — the `body` field
- **SDK-sent**: `header Idempotency-Key` (minted per call)
- **Returns**: `AssistantAnswer`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `SettlementApi.AskOperatorAssistantError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [422] `Problem` · `"problem7"` [429] `Problem` · `"problem8"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `SettlementApi.AskOperatorAssistantRequest` (1):

| Field | Channel | Type | Req |
| --- | --- | --- | --- |
| `body` | `body` | `AssistantQuestion` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `AssistantQuestion` | `assistantQuestionSchema` | `src/models/assistant-question.ts` |
| `AssistantAnswer` | `assistantAnswerSchema` | `src/models/assistant-answer.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### getAgentEarnings

- **Signature**: `getAgentEarnings(request?: SettlementApi.GetAgentEarningsRequest, options?: RequestOptions): ApiPromise<AllocationPage, SettlementApi.GetAgentEarningsError>`
- **Wire**: `GET /v1/agents/me/earnings`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `AllocationPage`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `SettlementApi.GetAgentEarningsError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `SettlementApi.GetAgentEarningsRequest` (2):

| Field | Channel | Type | Req | Default |
| --- | --- | --- | --- | --- |
| `cursor` | `query` | `string` | no | — |
| `limit` | `query` | `number` | no | `20` |

| Type | Schema value | Source |
| --- | --- | --- |
| `AllocationPage` | `allocationPageSchema` | `src/models/allocation-page.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### getSettlement

- **Signature**: `getSettlement(request: SettlementApi.GetSettlementRequest, options?: RequestOptions): ApiPromise<Settlement, SettlementApi.GetSettlementError>`
- **Wire**: `GET /v1/competitions/{competition_id}/settlement`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `Settlement`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `SettlementApi.GetSettlementError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `SettlementApi.GetSettlementRequest` (1):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `competitionId` | `path` | `competition_id` | `string` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `Settlement` | `settlementSchema` | `src/models/settlement.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### listOperatorAllocations

- **Signature**: `listOperatorAllocations(request?: SettlementApi.ListOperatorAllocationsRequest, options?: RequestOptions): ApiPromise<AllocationPage, SettlementApi.ListOperatorAllocationsError>`
- **Wire**: `GET /v1/operators/me/allocations`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `AllocationPage`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `SettlementApi.ListOperatorAllocationsError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [422] `Problem` · `"problem7"` [429] `Problem` · `"problem8"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `SettlementApi.ListOperatorAllocationsRequest` (2):

| Field | Channel | Type | Req | Default |
| --- | --- | --- | --- | --- |
| `cursor` | `query` | `string` | no | — |
| `limit` | `query` | `number` | no | `20` |

| Type | Schema value | Source |
| --- | --- | --- |
| `AllocationPage` | `allocationPageSchema` | `src/models/allocation-page.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

