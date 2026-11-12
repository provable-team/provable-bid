import { randomBytes, randomInt } from 'node:crypto';
import type { components } from '../../../packages/api-client/src/schema.js';
import { hashToken, type AgentRecord, type Principal } from './identity.js';
import type { Collection } from './store.js';

type S = components['schemas'];

/**
 * Agent onboarding with a short code (OAuth 2.0 Device Authorization Grant, RFC 8628).
 *
 * An outside agent asks for a device code (secret, kept by the agent) and a user code (8 letters, shown to its human
 * operator). The operator signs in on the web app, reviews who is asking and approves; approval registers the agent
 * exactly as manual registration does. The agent's polling then receives its credential once. Only the device code's
 * SHA-256 is stored, every state change is in the DocStore (so it survives restarts), and the agent token itself is
 * minted at exchange time by the same function as manual registration, so it is never stored in plain text.
 */
export const DEVICE_CODE_TTL_MS = 600_000;
export const DEVICE_POLL_INTERVAL_S = 5;
/** Once approved, the agent still has at least this long to collect its credential. */
const APPROVED_PICKUP_MS = 120_000;
/** Expired and used codes are kept this long (so a late poll gets EXPIRED_TOKEN), then deleted. */
const RETAIN_MS = 15 * 60_000;
export const DEVICE_LIMITS = { perClient: 10, global: 500, failedLookups: 10, failedLookupWindowMs: 15 * 60_000 };
/** No vowels (no words), no look-alikes (0/O, 1/I/L are absent or unambiguous in upper case). */
const ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ';

export type DeviceGrant = {
  user_code: string; // normalized: 8 letters, no hyphen
  client_name: string; description: string | null; webhook_url: string | null;
  /** Hash of a coarse caller key (see clientKey) for the outstanding-code limit. Not an identity. */
  client: string;
  status: 'pending' | 'approved' | 'denied' | 'consumed';
  created_at: string; expires: number; last_poll: number | null;
  operator_id: string | null; agent_id: string | null; decided_at: string | null;
};

type Fail = (status: number, code: S['Problem']['code'], message: string, retryable?: boolean, retryAfterSeconds?: number) => Error;
export interface DeviceFlowDeps {
  grants: Collection<DeviceGrant>;
  /** Failed user-code lookups per operator (timestamps), for the brute-force limit. */
  lookups: Collection<{ failures: number[] }>;
  time: () => number;
  stamp: () => string;
  webOrigin: string;
  fail: Fail;
  /** Same webhook_url validation as manual registration. */
  validateWebhookUrl: (url: string | null | undefined) => void;
  /** Manual registration's own logic (operator check, limits); returns the stored agent record. */
  registerAgent: (me: Principal | undefined, input: S['RegisterAgent']) => { record: AgentRecord };
  /** Manual registration's own credential issue (scopes, hashing); the token is returned once. */
  issueCredential: (agentId: string) => S['AgentCredential'];
}
type Result = { status: number; body: any; cache?: string };

export const formatUserCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;
/** Case-insensitive, hyphen and spaces optional. */
export const normalizeUserCode = (input: string) => input.toUpperCase().replace(/[\s-]/g, '');

/**
 * The address the nearest proxy saw (rightmost X-Forwarded-For entry), else 'direct'. Spoofed leftmost entries are
 * ignored; at worst many callers share a key, and the global cap still bounds storage.
 */
export function clientKey(headers: Record<string, unknown>) {
  const forwarded = String(headers['x-forwarded-for'] ?? '').split(',').map(s => s.trim()).filter(Boolean);
  return (forwarded.at(-1) ?? 'direct').slice(0, 64);
}

export function createDeviceFlow(d: DeviceFlowDeps) {
  const ops = new Set(['createAgentDeviceCode', 'exchangeAgentDeviceCode', 'getAgentDeviceRequest', 'decideAgentDeviceRequest']);
  const iso = (ms: number) => new Date(ms).toISOString();

  function prune() {
    const now = d.time();
    for (const [key, g] of d.grants) if (now > g.expires + RETAIN_MS) d.grants.delete(key);
    for (const [key, l] of d.lookups) if (!l.failures.some(t => t > now - DEVICE_LIMITS.failedLookupWindowMs)) d.lookups.delete(key);
  }
  const live = (g: DeviceGrant) => g.status === 'pending' && d.time() < g.expires;

  function newUserCode(): string {
    const taken = new Set([...d.grants.values()].map(g => g.user_code));
    for (;;) {
      const code = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
      if (!taken.has(code)) return code;
    }
  }

  function operatorOnly(p: Principal | undefined): string {
    if (!p) throw d.fail(401, 'UNAUTHENTICATED', 'Valid bearer credential required.');
    if (p.role !== 'operator') throw d.fail(403, 'OPERATOR_REQUIRED', 'Connect PayPal as an agent operator first.');
    return p.operator_id;
  }
  /** Brute-force guard: too many unknown codes from one operator in the window → 429 before any lookup. */
  function checkAttempts(operatorId: string) {
    const recent = (d.lookups.get(operatorId)?.failures ?? []).filter(t => t > d.time() - DEVICE_LIMITS.failedLookupWindowMs);
    if (recent.length >= DEVICE_LIMITS.failedLookups) {
      const wait = Math.max(1, Math.ceil((recent[0] + DEVICE_LIMITS.failedLookupWindowMs - d.time()) / 1000));
      throw d.fail(429, 'RATE_LIMITED', 'Too many codes that did not match. Check the code your agent shows and try again later.', true, wait);
    }
  }
  function notFound(operatorId: string): Error {
    const failures = (d.lookups.get(operatorId)?.failures ?? []).filter(t => t > d.time() - DEVICE_LIMITS.failedLookupWindowMs);
    failures.push(d.time());
    d.lookups.set(operatorId, { failures });
    return d.fail(404, 'NOT_FOUND', 'No pending request has this code. It may have expired (codes last 10 minutes); ask your agent for a new one.');
  }
  const byUserCode = (raw: string) => {
    const code = normalizeUserCode(raw);
    return [...d.grants.values()].find(g => g.user_code === code);
  };

  function create(body: S['CreateAgentDeviceCode'], headers: Record<string, unknown>): Result {
    const clientName = body.client_name.trim();
    if (!clientName) throw d.fail(400, 'VALIDATION_ERROR', 'client_name must not be blank.');
    d.validateWebhookUrl(body.webhook_url);
    const client = hashToken(`client:${clientKey(headers)}`).slice(0, 32); // grouped, not stored as an address
    const outstanding = [...d.grants.values()].filter(live);
    const mine = outstanding.filter(g => g.client === client);
    const full = mine.length >= DEVICE_LIMITS.perClient ? mine : outstanding.length >= DEVICE_LIMITS.global ? outstanding : null;
    if (full) {
      const wait = Math.max(1, Math.ceil((Math.min(...full.map(g => g.expires)) - d.time()) / 1000));
      throw d.fail(429, 'RATE_LIMITED', 'Too many connection codes are waiting for approval. Use an existing code or try again later.', true, wait);
    }
    const deviceCode = `pbd_${randomBytes(32).toString('base64url')}`;
    const userCode = newUserCode();
    d.grants.set(hashToken(deviceCode), {
      user_code: userCode, client_name: clientName, description: body.description?.trim() || null, webhook_url: body.webhook_url ?? null, client,
      status: 'pending', created_at: d.stamp(), expires: d.time() + DEVICE_CODE_TTL_MS, last_poll: null, operator_id: null, agent_id: null, decided_at: null,
    });
    const verification = `${d.webOrigin}/operators/activate`;
    return { status: 200, cache: 'no-store', body: {
      device_code: deviceCode, user_code: formatUserCode(userCode),
      verification_uri: verification, verification_uri_complete: `${verification}?code=${formatUserCode(userCode)}`,
      expires_in: DEVICE_CODE_TTL_MS / 1000, interval: DEVICE_POLL_INTERVAL_S, server_time: d.stamp(),
    } satisfies S['AgentDeviceCode'] };
  }

  function exchange(body: S['ExchangeAgentDeviceCode']): Result {
    const key = hashToken(body.device_code);
    const g = d.grants.get(key);
    if (!g || g.status === 'consumed' || d.time() >= g.expires) throw d.fail(400, 'EXPIRED_TOKEN', 'This device code is unknown, expired or already used. Request a new code.');
    if (g.status === 'denied') throw d.fail(400, 'ACCESS_DENIED', 'The operator denied this request.');
    if (g.status === 'pending') {
      const last = g.last_poll;
      g.last_poll = d.time();
      // One second of slack for network jitter between polls sent `interval` seconds apart.
      if (last !== null && d.time() - last < (DEVICE_POLL_INTERVAL_S - 1) * 1000) {
        throw d.fail(400, 'SLOW_DOWN', `Polling too fast. Wait at least ${DEVICE_POLL_INTERVAL_S + 5} seconds between requests from now on.`, true);
      }
      throw d.fail(400, 'AUTHORIZATION_PENDING', 'Waiting for the operator to approve this code.', true);
    }
    const credential = d.issueCredential(g.agent_id!);
    g.status = 'consumed';
    g.last_poll = d.time();
    return { status: 200, cache: 'no-store', body: credential };
  }

  function request(p: Principal | undefined, params: { user_code: string }): Result {
    const operatorId = operatorOnly(p);
    checkAttempts(operatorId);
    const g = byUserCode(params.user_code);
    if (!g || !live(g)) throw notFound(operatorId);
    return { status: 200, cache: 'no-store', body: {
      user_code: formatUserCode(g.user_code), client_name: g.client_name, description: g.description, webhook_url: g.webhook_url,
      created_at: g.created_at, expires_at: iso(g.expires), server_time: d.stamp(),
    } satisfies S['AgentDeviceRequest'] };
  }

  function decide(p: Principal | undefined, params: { user_code: string }, body: S['AgentDeviceDecision']): Result {
    const operatorId = operatorOnly(p);
    checkAttempts(operatorId);
    const g = byUserCode(params.user_code);
    if (g && g.operator_id === operatorId && g.status !== 'pending') {
      throw d.fail(409, 'INVALID_STATE', g.status === 'denied' ? 'You already denied this request.' : 'You already approved this request.');
    }
    if (!g || !live(g)) throw notFound(operatorId);
    let agent: S['Agent'] | null = null;
    if (body.decision === 'approve') {
      const name = (body.name ?? g.client_name).trim();
      if (name.length < 2) throw d.fail(400, 'VALIDATION_ERROR', 'Give the agent a name of at least 2 characters.');
      const { record } = d.registerAgent(p, {
        name: name.slice(0, 80), description: (body.description ?? g.description ?? '').trim().slice(0, 500), style: (body.style ?? '').trim().slice(0, 200),
        webhook_url: g.webhook_url,
      });
      agent = record.profile;
      g.status = 'approved'; g.agent_id = record.profile.id;
      g.expires = Math.max(g.expires, d.time() + APPROVED_PICKUP_MS);
    } else g.status = 'denied';
    g.operator_id = operatorId; g.decided_at = d.stamp();
    return { status: 200, body: { user_code: formatUserCode(g.user_code), decision: body.decision, agent: agent && structuredClone(agent), server_time: d.stamp() } satisfies S['AgentDeviceDecisionResult'] };
  }

  return {
    ops,
    run(op: string, p: Principal | undefined, params: any, body: any, headers: Record<string, unknown>): Result {
      prune();
      switch (op) {
        case 'createAgentDeviceCode': return create(body, headers);
        case 'exchangeAgentDeviceCode': return exchange(body);
        case 'getAgentDeviceRequest': return request(p, params);
        case 'decideAgentDeviceRequest': return decide(p, params, body);
        default: throw new Error(`No device-flow handler for ${op}`);
      }
    },
  };
}
