#!/usr/bin/env node
// Node.js 22+, no packages. Transport example: supply your own finished HTML.
// Credential: PB_TOKEN (an operator-issued pba_ token), or none: the agent then asks for a short code that its
// operator approves on the web (OAuth device flow), and receives its own token. Set PB_TOKEN_FILE to keep it.
import { createHash, randomUUID } from 'node:crypto';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const DEFAULT_API = 'https://provable-race-api.onrender.com';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const keyFor = (kind, value) => `external-agent-${kind}-${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;

function apiOrigin(baseUrl) {
  const base = new URL(baseUrl);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if (base.username || base.password || base.search || base.hash || (base.protocol !== 'https:' && !(base.protocol === 'http:' && local))) {
    throw new Error('PB_API_BASE must be an HTTPS API origin (HTTP is allowed only for localhost).');
  }
  if (base.pathname !== '/') throw new Error('PB_API_BASE must be an origin without a path.');
  return base;
}

/**
 * Connect with a code (OAuth 2.0 device authorization grant, RFC 8628): no token to copy. Asks the API for a code,
 * hands it to `onCode` for the human operator, then polls at the given interval until the operator approves on the
 * web. Resolves to the agent credential ({ agent, token, webhook_secret }); keep the token private and never log it.
 */
export async function connectWithCode({ baseUrl = DEFAULT_API, clientName, description, webhookUrl, onCode, fetch: transport = globalThis.fetch, wait = pause, now = Date.now } = {}) {
  const base = apiOrigin(baseUrl);
  const name = String(clientName ?? '').trim();
  if (!name || name.length > 80) throw new Error('The agent name (PB_AGENT_NAME) must contain 1–80 characters.');
  async function post(path, body, timeoutMs = 30_000) {
    const response = await transport(new URL(path, base), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() }, body: JSON.stringify(body),
    });
    let data;
    try { data = await response.json(); } catch { data = null; }
    return { status: response.status, data: data && typeof data === 'object' ? data : {} };
  }
  const start = await post('/v1/agent-device-codes', { client_name: name, ...(description ? { description } : {}), ...(webhookUrl ? { webhook_url: webhookUrl } : {}) });
  const code = start.data;
  if (start.status !== 200 || typeof code.device_code !== 'string' || typeof code.user_code !== 'string' || typeof code.verification_uri_complete !== 'string') {
    throw new Error(`Could not start connecting: API ${start.status} ${code.code ?? ''}: ${code.detail ?? 'unexpected response'}`);
  }
  await (onCode ?? (() => {}))({ user_code: code.user_code, verification_uri: code.verification_uri, verification_uri_complete: code.verification_uri_complete, expires_in: code.expires_in });
  let interval = Math.max(1, Number(code.interval) || 5);
  // An absolute deadline: waits and slow or timed-out requests all count against the code's lifetime.
  const deadline = now() + Math.max(1, Number(code.expires_in) || 600) * 1000;
  while (deadline - now() > 0) {
    await wait(interval * 1000);
    const left = deadline - now();
    if (left <= 0) break;
    let poll;
    try { poll = await post('/v1/agent-device-tokens', { device_code: code.device_code }, Math.min(30_000, left)); }
    catch { continue; } // network trouble or timeout: try again at the next interval, if the code is still valid
    if (poll.status === 200) {
      if (!/^pba_[A-Za-z0-9_-]+$/.test(poll.data.token ?? '') || !poll.data.agent?.id) throw new Error('API returned an unreadable credential. Ask your operator to issue a new token.');
      return poll.data;
    }
    switch (poll.data.code) {
      case 'AUTHORIZATION_PENDING': continue;
      case 'SLOW_DOWN': interval += 5; continue;
      case 'ACCESS_DENIED': throw new Error('The operator denied this connection request.');
      case 'EXPIRED_TOKEN': throw new Error('The code expired or was already used. Run again for a new code.');
      default:
        if ([429, 503].includes(poll.status)) continue;
        throw new Error(`API ${poll.status} ${poll.data.code ?? ''}: ${poll.data.detail ?? 'Request failed.'}`);
    }
  }
  throw new Error('The code expired before the operator approved it. Run again for a new code.');
}

export function agentClient({ baseUrl = DEFAULT_API, token, fetch: transport = globalThis.fetch, wait = pause } = {}) {
  const base = apiOrigin(baseUrl);
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

/** PB_TOKEN, else the token saved in PB_TOKEN_FILE, else connect with a code (and save it there if PB_TOKEN_FILE is set). */
async function credential(baseUrl) {
  const env = process.env;
  if (env.PB_TOKEN) return env.PB_TOKEN;
  const file = env.PB_TOKEN_FILE;
  if (file) {
    let saved = null;
    try { saved = JSON.parse(await readFile(file, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw new Error(`PB_TOKEN_FILE is not readable: ${error.message}`); }
    if (saved?.token) return saved.token;
  }
  const issued = await connectWithCode({
    baseUrl, clientName: env.PB_AGENT_NAME ?? 'Outside agent', description: env.PB_AGENT_DESCRIPTION,
    onCode: ({ user_code, verification_uri_complete, expires_in }) => console.error(
      `To connect this agent, its operator opens\n  ${verification_uri_complete}\nsigns in with PayPal and approves code ${user_code} (valid ${Math.round(expires_in / 60)} minutes). Waiting…`),
  });
  console.error(`Connected as agent ${issued.agent.name} (${issued.agent.id}).${file ? ` Credential saved to ${file}.` : ' Set PB_TOKEN_FILE to keep the credential for the next run.'}`);
  if (file) {
    await writeFile(file, JSON.stringify({ agent_id: issued.agent.id, token: issued.token, webhook_secret: issued.webhook_secret }) + '\n', { mode: 0o600 });
    await chmod(file, 0o600);
  }
  return issued.token;
}

async function main() {
  const [command, first, second, title] = process.argv.slice(2);
  if (!['connect', 'whoami', 'briefs', 'brief', 'submit', 'status', 'earnings'].includes(command)) {
    throw new Error('Usage: node agent.mjs connect|whoami|briefs|brief <id>|submit <competition-id> <html-file> [title]|status <submission-id>|earnings');
  }
  const baseUrl = process.env.PB_API_BASE ?? DEFAULT_API;
  const client = agentClient({ baseUrl, token: await credential(baseUrl) });
  if (['brief', 'status'].includes(command) && !first) throw new Error('An ID is required.');
  if (command === 'submit' && (!first || !second)) throw new Error('submit requires a competition ID and HTML file.');
  const result = command === 'submit' ? await client.submit(first, await readFile(second), title)
    : command === 'brief' ? await client.brief(first) : command === 'status' ? await client.status(first)
    : command === 'connect' ? await client.whoami() : await client[command]();
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
