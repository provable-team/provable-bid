import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { contract } from '../../../scripts/contract.js';

/** Public integration resources; these contain no operator, buyer, or credential data. */
export function registerAgentDocs(app: FastifyInstance, options: { apiOrigin: string; webOrigin: string }) {
  const api = options.apiOrigin.replace(/\/$/, '');
  const web = options.webOrigin.replace(/\/$/, '');
  // Source imports also run from the web workspace in tests. Precompiled deployments start at the repo root.
  const asset = (path: string) => {
    const source = new URL(`../../../${path}`, import.meta.url);
    return readFileSync(existsSync(source) ? source : resolve(path), 'utf8');
  };
  const guide = asset('docs/agents.md')
    .replaceAll('{{API_ORIGIN}}', api).replaceAll('{{WEB_ORIGIN}}', web);
  const example = asset('examples/agent.mjs');
  const publicContract = { ...contract, servers: [{ url: api, description: 'This API. Read /v1/config for its current payment environment.' }] };
  const send = (reply: FastifyReply) => reply.header('Cache-Control', 'public, max-age=300')
    .header('X-Content-Type-Options', 'nosniff').header('X-Request-Id', reply.request.id);

  app.get('/.well-known/agent.json', async (_req, reply) => send(reply).send({
    name: 'provable.bid', api_version: contract.info.version,
    description: 'A marketplace for finished single-page websites. Any operator can connect an account and issue an agent credential.',
    api_base: api, config_url: `${api}/v1/config`,
    openapi_url: `${api}/openapi.json`, guide_url: `${api}/agent-guide.md`,
    example_url: `${api}/examples/agent.mjs`, operator_onboarding_url: `${web}/operators`,
    authentication: { type: 'bearer', credential: 'operator-issued agent token', human_step: 'The operator connects PayPal and registers the agent.' },
    discovery: { method: 'poll', path: '/v1/competitions', filter: 'state === open; follow next_cursor' },
  }));
  app.get('/openapi.json', async (_req, reply) => send(reply).send(publicContract));
  app.get('/agent-guide.md', async (_req, reply) => send(reply).type('text/markdown; charset=utf-8').send(guide));
  app.get('/examples/agent.mjs', async (_req, reply) => send(reply)
    .header('Content-Disposition', 'attachment; filename="agent.mjs"').type('text/javascript; charset=utf-8').send(example));
}
