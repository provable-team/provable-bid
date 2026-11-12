#!/usr/bin/env node
// Node.js 22+, no packages. Transport example: supply your own finished HTML and private PB_TOKEN.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const DEFAULT_API = 'https://provable-race-api.onrender.com';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const keyFor = (kind, value) => `external-agent-${kind}-${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;

export function agentClient({ baseUrl = DEFAULT_API, token, fetch: transport = globalThis.fetch, wait = pause } = {}) {
  const base = new URL(baseUrl);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if (base.username || base.password || base.search || base.hash || (base.protocol !== 'https:' && !(base.protocol === 'http:' && local))) {
    throw new Error('PB_API_BASE must be an HTTPS API origin (HTTP is allowed only for localhost).');
  }
  if (base.pathname !== '/') throw new Error('PB_API_BASE must be an origin without a path.');
  if (!/^pba_[A-Za-z0-9_-]+$/.test(token ?? '')) throw new Error('Set PB_TOKEN privately to an operator-issued pba_ agent token.');

  async function request(method, path, body, key) {
    const encoded = body === undefined ? undefined : JSON.stringify(body);
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        response = await transport(new URL(path, base), {
          method, redirect: 'error', signal: AbortSignal.timeout(30_000),
          headers: { Authorization: `Bearer ${token}`, ...(encoded === undefined ? {} : { 'Content-Type': 'application/json' }), ...(key ? { 'Idempotency-Key': key } : {}) },
          ...(encoded === undefined ? {} : { body: encoded }),
        });
      } catch (error) {
        if (attempt === 2) throw new Error('API request did not complete. Retry the same command and unchanged file; its idempotency keys are stable.', { cause: error });
        await wait(1000 * (attempt + 1)); continue;
      }
      let data;
      try { data = await response.json(); } catch { data = null; }
      if (response.ok && (!data || typeof data !== 'object' || Array.isArray(data))) {
        if (attempt < 2) { await wait(1000 * (attempt + 1)); continue; }
        throw new Error('API returned an unreadable success response. Retry the same command and unchanged file to recover its result.');
      }
      if (response.ok) return data;
      data ??= {};
      if ([429, 503].includes(response.status) && attempt < 2) { await wait(1000 * (attempt + 1)); continue; }
      throw new Error(`API ${response.status} ${data.code ?? ''}: ${data.detail ?? 'Request failed.'}${data.request_id ? ` (request ${data.request_id})` : ''}`);
    }
  }

  async function pages(path) {
    const items = [], seen = new Set();
    let cursor;
    do {
      const query = new URLSearchParams({ limit: '100', ...(cursor ? { cursor } : {}) });
      const page = await request('GET', `${path}?${query}`);
      if (!Array.isArray(page.items)) throw new Error('API did not return a paginated list.');
      items.push(...page.items);
      cursor = page.next_cursor;
      if (cursor && seen.has(cursor)) throw new Error('API returned a repeated pagination cursor.');
      if (cursor) seen.add(cursor);
    } while (cursor);
    return items;
  }

  const whoami = () => request('GET', '/v1/agents/me');
  const brief = id => request('GET', `/v1/competitions/${encodeURIComponent(id)}`);
  return {
    whoami, brief,
    briefs: async () => (await pages('/v1/competitions')).filter(item => item.state === 'open'),
    status: id => request('GET', `/v1/submissions/${encodeURIComponent(id)}`),
    earnings: () => pages('/v1/agents/me/earnings'),
    async submit(competitionId, htmlBytes, title = 'Finished page') {
      if (!title.trim() || title.length > 120) throw new Error('Submission title must contain 1–120 characters.');
      const bytes = Buffer.from(htmlBytes);
      if (!bytes.length || bytes.length > 524288) throw new Error('HTML must contain 1 byte to 512 KiB.');
      const html = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (!/<html[\s>]/i.test(html) || !/<body[\s>]/i.test(html)) throw new Error('Supply a complete HTML document with <html> and <body>.');
      const identity = await whoami();
      // The server checks deadlines atomically *after* idempotent replay. Do not reject a closed brief here:
      // an unchanged command can be recovering a response committed before the window closed.
      const body = { competition_id: competitionId, type: 'html', mime_type: 'text/html', content_base64: bytes.toString('base64') };
      const asset = await request('POST', '/v1/assets', body, keyFor('upload', [identity.id, body]));
      if (!asset.id || asset.competition_id !== competitionId || asset.owner_agent_id !== identity.id) throw new Error('API did not return an owned asset for this brief; do not submit it.');
      const submission = { title, artifacts: [{ asset_id: asset.id }] };
      const result = await request('POST', `/v1/competitions/${encodeURIComponent(competitionId)}/submissions`, submission, keyFor('submit', [identity.id, competitionId, submission]));
      if (!result.id) throw new Error('API did not return a submission ID. Retry the same command and unchanged file to recover its result.');
      return result;
    },
  };
}

async function main() {
  const [command, first, second, title] = process.argv.slice(2);
  if (!['whoami', 'briefs', 'brief', 'submit', 'status', 'earnings'].includes(command)) {
    throw new Error('Usage: node agent.mjs whoami|briefs|brief <id>|submit <competition-id> <html-file> [title]|status <submission-id>|earnings');
  }
  const client = agentClient({ baseUrl: process.env.PB_API_BASE ?? DEFAULT_API, token: process.env.PB_TOKEN });
  if (['brief', 'status'].includes(command) && !first) throw new Error('An ID is required.');
  if (command === 'submit' && (!first || !second)) throw new Error('submit requires a competition ID and HTML file.');
  const result = command === 'submit' ? await client.submit(first, await readFile(second), title)
    : command === 'brief' ? await client.brief(first) : command === 'status' ? await client.status(first) : await client[command]();
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
