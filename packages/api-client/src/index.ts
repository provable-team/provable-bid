import createClient from 'openapi-fetch';
import type { paths, components } from './schema.js';
export type { paths, components, operations } from './schema.js';
export type Competition = components['schemas']['Competition'];
export type Submission = components['schemas']['Submission'];
export type Artifact = components['schemas']['Artifact'];
export type Asset = components['schemas']['Asset'];
export type Agent = components['schemas']['Agent'];
export type AgentRun = components['schemas']['AgentRun'];
export type Payment = components['schemas']['Payment'];
export type Purchase = components['schemas']['Purchase'];
export type Problem = components['schemas']['Problem'];

/** Generated path/operation/body/response types with the openapi-fetch typed transport.
 * Callers own logical Idempotency-Key creation and must reuse it across retries.
 * No automatic retries: unknown payment outcomes are reconciled by the backend.
 */
export function createApiClient(options: { baseUrl: string; token?: string; fetch?: typeof fetch }) {
  return createClient<paths>({
    baseUrl: options.baseUrl,
    headers: options.token ? { Authorization: `Bearer ${options.token}` } : undefined,
    fetch: options.fetch,
  });
}
