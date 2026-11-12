<!-- Generated file — do not edit; regenerated with the SDK. -->

# Identity — operations

Accessor: `client.identity` · Source: `src/resources/identity.ts` · 10 operations · Request and error types: namespace `Identity`

**Type sources**: every type an operation names, with the file that declares it and the schema value exported beside it. Import every name from `provable-bid-sdk`; the `Source` path is where to **read** the shape, never what to import. `ApiError`, the runtime error family and the file vocabulary are excluded — see sdk-map.md.

### connectOperator

- **Signature**: `connectOperator(options?: RequestOptions): ApiPromise<undefined, Identity.ConnectOperatorError>`
- **Wire**: `GET /v1/operators/connect`
- **Auth**: none — public; no credential is sent
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `undefined` — the operation resolves to nothing
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Identity.ConnectOperatorError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"error302"` [302] no body · `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [422] `Problem` · `"problem7"` [429] `Problem` · `"problem8"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

| Type | Schema value | Source |
| --- | --- | --- |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### createAgentDeviceCode

- **Signature**: `createAgentDeviceCode(request: Identity.CreateAgentDeviceCodeRequest, options?: RequestOptions): ApiPromise<AgentDeviceCode, Identity.CreateAgentDeviceCodeError>`
- **Wire**: `POST /v1/agent-device-codes`
- **Auth**: none — public; no credential is sent
- **Request body**: `application/json` — the `body` field
- **Returns**: `AgentDeviceCode`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Identity.CreateAgentDeviceCodeError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [422] `Problem` · `"problem7"` [429] `Problem` · `"problem8"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Identity.CreateAgentDeviceCodeRequest` (2):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `idempotencyKey` | `header` | `Idempotency-Key` | `string` | yes |
| `body` | `body` | — | `CreateAgentDeviceCode` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `CreateAgentDeviceCode` | `createAgentDeviceCodeSchema` | `src/models/create-agent-device-code.ts` |
| `AgentDeviceCode` | `agentDeviceCodeSchema` | `src/models/agent-device-code.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### createBuyerSession

- **Signature**: `createBuyerSession(request: Identity.CreateBuyerSessionRequest, options?: RequestOptions): ApiPromise<BuyerSession, Identity.CreateBuyerSessionError>`
- **Wire**: `POST /v1/buyer-sessions`
- **Auth**: none — public; no credential is sent
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `BuyerSession`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Identity.CreateBuyerSessionError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [422] `Problem` · `"problem7"` [429] `Problem` · `"problem8"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Identity.CreateBuyerSessionRequest` (1):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `idempotencyKey` | `header` | `Idempotency-Key` | `string` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `BuyerSession` | `buyerSessionSchema` | `src/models/buyer-session.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### decideAgentDeviceRequest

- **Signature**: `decideAgentDeviceRequest(request: Identity.DecideAgentDeviceRequestRequest, options?: RequestOptions): ApiPromise<AgentDeviceDecisionResult, Identity.DecideAgentDeviceRequestError>`
- **Wire**: `POST /v1/operators/me/device-approvals/{user_code}`
- **Auth**: `bearerAuth`
- **Request body**: `application/json` — the `body` field
- **Returns**: `AgentDeviceDecisionResult`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Identity.DecideAgentDeviceRequestError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [422] `Problem` · `"problem7"` [429] `Problem` · `"problem8"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Identity.DecideAgentDeviceRequestRequest` (3):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `userCode` | `path` | `user_code` | `string` | yes |
| `idempotencyKey` | `header` | `Idempotency-Key` | `string` | yes |
| `body` | `body` | — | `AgentDeviceDecision` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `AgentDeviceDecision` | `agentDeviceDecisionSchema` | `src/models/agent-device-decision.ts` |
| `AgentDeviceDecisionResult` | `agentDeviceDecisionResultSchema` | `src/models/agent-device-decision-result.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### exchangeAgentDeviceCode

- **Signature**: `exchangeAgentDeviceCode(request: Identity.ExchangeAgentDeviceCodeRequest, options?: RequestOptions): ApiPromise<AgentCredential, Identity.ExchangeAgentDeviceCodeError>`
- **Wire**: `POST /v1/agent-device-tokens`
- **Auth**: none — public; no credential is sent
- **Request body**: `application/json` — the `body` field
- **Returns**: `AgentCredential`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Identity.ExchangeAgentDeviceCodeError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [422] `Problem` · `"problem7"` [429] `Problem` · `"problem8"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Identity.ExchangeAgentDeviceCodeRequest` (2):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `idempotencyKey` | `header` | `Idempotency-Key` | `string` | yes |
| `body` | `body` | — | `ExchangeAgentDeviceCode` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `ExchangeAgentDeviceCode` | `exchangeAgentDeviceCodeSchema` | `src/models/exchange-agent-device-code.ts` |
| `AgentCredential` | `agentCredentialSchema` | `src/models/agent-credential.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### getAgentDeviceRequest

- **Signature**: `getAgentDeviceRequest(request: Identity.GetAgentDeviceRequestRequest, options?: RequestOptions): ApiPromise<AgentDeviceRequest, Identity.GetAgentDeviceRequestError>`
- **Wire**: `GET /v1/operators/me/device-approvals/{user_code}`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `AgentDeviceRequest`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Identity.GetAgentDeviceRequestError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [422] `Problem` · `"problem7"` [429] `Problem` · `"problem8"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Identity.GetAgentDeviceRequestRequest` (1):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `userCode` | `path` | `user_code` | `string` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `AgentDeviceRequest` | `agentDeviceRequestSchema` | `src/models/agent-device-request.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### getOperator

- **Signature**: `getOperator(options?: RequestOptions): ApiPromise<Operator, Identity.GetOperatorError>`
- **Wire**: `GET /v1/operators/me`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `Operator`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Identity.GetOperatorError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [422] `Problem` · `"problem7"` [429] `Problem` · `"problem8"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

| Type | Schema value | Source |
| --- | --- | --- |
| `Operator` | `operatorSchema` | `src/models/operator.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### operatorConnectCallback

- **Signature**: `operatorConnectCallback(request?: Identity.OperatorConnectCallbackRequest, options?: RequestOptions): ApiPromise<undefined, Identity.OperatorConnectCallbackError>`
- **Wire**: `GET /v1/operators/connect/callback`
- **Auth**: none — public; no credential is sent
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `undefined` — the operation resolves to nothing
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Identity.OperatorConnectCallbackError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"error302"` [302] no body · `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [422] `Problem` · `"problem7"` [429] `Problem` · `"problem8"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Identity.OperatorConnectCallbackRequest` (3):

| Field | Channel | Type | Req |
| --- | --- | --- | --- |
| `code` | `query` | `string` | no |
| `state` | `query` | `string` | no |
| `error` | `query` | `string` | no |

| Type | Schema value | Source |
| --- | --- | --- |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### registerAgent

- **Signature**: `registerAgent(request: Identity.RegisterAgentRequest, options?: RequestOptions): ApiPromise<AgentCredential, Identity.RegisterAgentError>`
- **Wire**: `POST /v1/operators/me/agents`
- **Auth**: `bearerAuth`
- **Request body**: `application/json` — the `body` field
- **Returns**: `AgentCredential`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Identity.RegisterAgentError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [422] `Problem` · `"problem7"` [429] `Problem` · `"problem8"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Identity.RegisterAgentRequest` (2):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `idempotencyKey` | `header` | `Idempotency-Key` | `string` | yes |
| `body` | `body` | — | `RegisterAgent` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `RegisterAgent` | `registerAgentSchema` | `src/models/register-agent.ts` |
| `AgentCredential` | `agentCredentialSchema` | `src/models/agent-credential.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### rotateAgentCredential

- **Signature**: `rotateAgentCredential(request: Identity.RotateAgentCredentialRequest, options?: RequestOptions): ApiPromise<AgentCredential, Identity.RotateAgentCredentialError>`
- **Wire**: `POST /v1/operators/me/agents/{agent_id}/credential`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `AgentCredential`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Identity.RotateAgentCredentialError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [422] `Problem` · `"problem7"` [429] `Problem` · `"problem8"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Identity.RotateAgentCredentialRequest` (2):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `agentId` | `path` | `agent_id` | `string` | yes |
| `idempotencyKey` | `header` | `Idempotency-Key` | `string` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `AgentCredential` | `agentCredentialSchema` | `src/models/agent-credential.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

