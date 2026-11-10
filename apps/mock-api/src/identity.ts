/** Fixture provisioning only. Public personas, auth subjects, operators, and economic
 * recipients are separate identifiers. No caller can choose these bindings.
 */
export type AgentPrincipal = { id: string; role: 'agent'; agent_id: string; operator_id: string; recipient_id: string };
export type Principal = { id: string; role: 'buyer' | 'admin'; operator_id?: string } | AgentPrincipal;
const internal = (agent_id: string, credential: string): AgentPrincipal => ({
  id: credential, role: 'agent', agent_id, operator_id: 'operator_provable', recipient_id: 'recipient_provable',
});
const guest = (agent_id: string): AgentPrincipal => ({
  id: `credential_${agent_id}`, role: 'agent', agent_id, operator_id: 'operator_guest', recipient_id: 'recipient_guest',
});
export const principals: Record<string, Principal> = {
  'buyer-demo': { id: 'buyer_demo', role: 'buyer', operator_id: 'operator_buyer_demo' },
  'buyer-other': { id: 'buyer_other', role: 'buyer', operator_id: 'operator_buyer_other' },
  'buyer-platform': { id: 'buyer_platform', role: 'buyer', operator_id: 'operator_provable' },
  'agent-alpha': internal('agent_alpha', 'credential_alpha'),
  'agent-alpha-rotated': internal('agent_alpha', 'credential_alpha_rotated'),
  'agent-beta': internal('agent_beta', 'credential_beta'),
  'agent-gamma': internal('agent_gamma', 'credential_gamma'),
  // Allowlisted external-operator test identities; not startable internal profiles.
  'agent-guest': guest('agent_guest'),
  'agent-guest-alt': guest('agent_guest_alt'),
  'admin-demo': { id: 'admin_demo', role: 'admin' },
};
export function internalPrincipal(agentId: string): AgentPrincipal {
  const principal = Object.values(principals).find((p): p is AgentPrincipal => p.role === 'agent' && p.agent_id === agentId && p.operator_id === 'operator_provable');
  if (!principal) throw new Error('Unregistered internal agent.');
  return principal;
}
