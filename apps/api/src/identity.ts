import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { components } from '../../../packages/api-client/src/schema.js';
import type { Collection } from './store.js';

/**
 * Who is calling. Derived server-side from a bearer credential; callers never choose these bindings.
 * Public agent profiles, credentials, operators and payout recipients are separate identifiers.
 */
export type AgentPrincipal = { id: string; role: 'agent'; agent_id: string; operator_id: string; recipient_id: string };
export type Principal =
  | { id: string; role: 'buyer' }
  | { id: string; role: 'admin' }
  | { id: string; role: 'operator'; operator_id: string }
  | AgentPrincipal;

export type Credential = { principal: Principal; created_at: string; revoked: boolean };
export type Operator = { id: string; name: string; email: string | null; paypal_payer_id: string | null; recipient_id: string; house: boolean; created_at: string };
export type AgentRecord = {
  profile: components['schemas']['Agent'];
  operator_id: string;
  webhook_url: string | null;
  webhook_secret: string | null;
  credential_hashes: string[];
  created_at: string;
};

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const newToken = (prefix: 'pbb' | 'pba' | 'pbo') => `${prefix}_${randomBytes(24).toString('base64url')}`;
export const newSecret = () => randomBytes(32).toString('hex');

export function resolvePrincipal(token: string | undefined, credentials: Collection<Credential>, adminToken: string | null): Principal | undefined {
  if (!token) return undefined;
  if (adminToken && token.length === adminToken.length && timingSafeEqual(Buffer.from(token), Buffer.from(adminToken))) return { id: 'admin', role: 'admin' };
  const c = credentials.get(hashToken(token));
  return c && !c.revoked ? c.principal : undefined;
}

/** The house agents: labelled, run by provable.bid, entering through the same public API as outside agents. */
export const HOUSE_AGENTS: { id: string; name: string; description: string; style: string; avatar_color: string }[] = [
  { id: 'agent_house_atelier', name: 'Atelier', description: 'Editorial, typography-led pages with generous whitespace and a single strong call to action.', style: 'Serif headlines, warm neutrals, calm and confident.', avatar_color: '#8a5a44' },
  { id: 'agent_house_voltage', name: 'Voltage', description: 'Bold, high-contrast pages that sell in the first screen.', style: 'Big sans type, saturated accent colour, punchy sections.', avatar_color: '#e4572e' },
  { id: 'agent_house_meadow', name: 'Meadow', description: 'Friendly, soft and accessible pages with rounded shapes and illustrations drawn in CSS.', style: 'Pastels, rounded cards, playful but tidy.', avatar_color: '#4f8a5b' },
];
export const HOUSE_OPERATOR_ID = 'operator_provable';
