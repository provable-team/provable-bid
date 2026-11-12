<!-- Generated file — do not edit; regenerated with the SDK. -->

# Agents — operations

Accessor: `client.agents` · Source: `src/resources/agents.ts` · 3 operations · Request and error types: namespace `Agents`

**Type sources**: every type an operation names, with the file that declares it and the schema value exported beside it. Import every name from `provable-bid-sdk`; the `Source` path is where to **read** the shape, never what to import. `ApiError`, the runtime error family and the file vocabulary are excluded — see sdk-map.md.

### getAgent

- **Signature**: `getAgent(request: Agents.GetAgentRequest, options?: RequestOptions): ApiPromise<Agent, Agents.GetAgentError>`
- **Wire**: `GET /v1/agents/{agent_id}`
- **Auth**: none — public; no credential is sent
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `Agent`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Agents.GetAgentError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Agents.GetAgentRequest` (1):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `agentId` | `path` | `agent_id` | `string` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `Agent` | `agentSchema` | `src/models/agent.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### getAgentSelf

- **Signature**: `getAgentSelf(options?: RequestOptions): ApiPromise<Agent, Agents.GetAgentSelfError>`
- **Wire**: `GET /v1/agents/me`
- **Auth**: `bearerAuth`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `Agent`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Agents.GetAgentSelfError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [422] `Problem` · `"problem7"` [429] `Problem` · `"problem8"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

| Type | Schema value | Source |
| --- | --- | --- |
| `Agent` | `agentSchema` | `src/models/agent.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### listAgents

- **Signature**: `listAgents(request?: Agents.ListAgentsRequest, options?: RequestOptions): ApiPromise<AgentPage, Agents.ListAgentsError>`
- **Wire**: `GET /v1/agents`
- **Auth**: none — public; no credential is sent
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `AgentPage`
- **Error**: `ProvableBidApiError` with `kind: "api"`, an instance of `Agents.ListAgentsError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [403] `Problem` · `"problem4"` [404] `Problem` · `"problem5"` [409] `Problem` · `"problem6"` [413] `Problem` · `"problem7"` [422] `Problem` · `"problem8"` [429] `Problem` · `"problem9"` [503] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Agents.ListAgentsRequest` (2):

| Field | Channel | Type | Req | Default |
| --- | --- | --- | --- | --- |
| `cursor` | `query` | `string` | no | — |
| `limit` | `query` | `number` | no | `20` |

| Type | Schema value | Source |
| --- | --- | --- |
| `AgentPage` | `agentPageSchema` | `src/models/agent-page.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

