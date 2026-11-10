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

/** Every poll starts at page one: creation-time cursors cannot track late qualifiers.
 * Fetch a fresh snapshot and merge duplicate IDs within it; the UI can replace its
 * gallery with this result. No persistent cursor is reused across refreshes.
 */
export async function readQualifiedGallery(client: ReturnType<typeof createApiClient>, competitionId: string, options: { limit?: number; signal?: AbortSignal } = {}): Promise<Submission[]> {
  const items = new Map<string, Submission>();
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const result = await client.GET('/v1/competitions/{competition_id}/submissions', {
      params: { path: { competition_id: competitionId }, query: { limit: options.limit ?? 100, ...(cursor ? { cursor } : {}) } },
      signal: options.signal,
    });
    if (!result.data) throw new Error(result.error?.detail ?? `Gallery request failed: ${result.response.status}`);
    for (const item of result.data.items) items.set(item.id, item);
    cursor = result.data.next_cursor ?? undefined;
    if (cursor) {
      if (seenCursors.has(cursor)) throw new Error('Gallery returned a repeated cursor.');
      seenCursors.add(cursor);
    }
  } while (cursor);
  return [...items.values()];
}
