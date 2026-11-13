import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import type Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { AgentAdapter, EvaluatorAdapter, ReferencePhoto } from '../packages/agent-interface/src/index.js';
import { createApi } from '../apps/api/src/app.js';
import {
  builderUserContent, claudeEvaluator, claudeGenerator, heuristicEvaluator, judgeText, JUDGE_REFERENCE_RULES, preflightWithReferences,
  REFERENCE_RULE, referenceBrief, streamingHouseAgent,
} from '../apps/api/src/claude.js';
import { DERIVATIVE, elideDataUrls, embedReferences, makeDerivative, prepareReference, sniffImage, unembedReferences } from '../apps/api/src/reference-images.js';
import { fakeProvider } from '../apps/api/src/provider/fake.js';
import { Store } from '../apps/api/src/store.js';
import { operations, validateResponse } from '../scripts/contract.js';

const WEB = 'http://web.test';
const ADMIN = 'admin_token_for_tests_0001';
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

/** A photo-like test image: a gradient with noise, so JPEG sizes are realistic. */
async function photo(width: number, height: number, format: 'jpeg' | 'png' | 'webp' = 'jpeg', seed = 1): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  let s = seed;
  for (let i = 0; i < raw.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; raw[i] = (((i % (width * 3)) / 7) + (s >> 26)) & 255; }
  const img = sharp(raw, { raw: { width, height, channels: 3 } });
  return format === 'png' ? img.png().toBuffer() : format === 'webp' ? img.webp({ quality: 90 }).toBuffer() : img.jpeg({ quality: 92 }).toBuffer();
}
const MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

// The concrete use case: a $5 flyer for Cafe Midi using the merchant's own drink photo.
const cafeBrief = {
  title: 'Cafe Midi drink flyer',
  brief: 'A one-page printable flyer for Cafe Midi, 1 Maiden Lane, featuring our new Masala Pistachio Chai with cold brew foam, $5. Use the attached photo of the drink.',
  bid: { currency: 'USD', amount_minor: 500 }, submission_window_seconds: 300, decision_window_seconds: 3600,
  requirements: [
    { id: 'req_photo', description: 'Uses the attached photo of the Masala Pistachio Chai.' },
    { id: 'req_facts', description: 'Shows Cafe Midi, 1 Maiden Lane and the $5 price.' },
  ],
  accepted_terms_version: 'race-v1',
};
const flyer = (img = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cafe Midi</title>
<style>body{font-family:system-ui;margin:0}.photo{width:100%;max-width:480px;filter:saturate(1.2)}</style></head><body><main>
<h1>Cafe Midi</h1>${img}<h2>Masala Pistachio Chai with cold brew foam</h2><p>Attached photo of the drink. Now pouring at 1 Maiden Lane for $5.</p>
</main></body></html>`;

async function fixture(t: any, opts: { dbPath?: string; houseAgents?: Record<string, AgentAdapter>; evaluator?: EvaluatorAdapter } = {}) {
  let now = Date.parse('2026-11-13T10:00:00.000Z');
  const store = new Store(opts.dbPath ?? ':memory:');
  const fake = fakeProvider({ webOrigin: WEB, now: () => now });
  const api = await createApi({ store, provider: fake.provider, evaluator: opts.evaluator ?? heuristicEvaluator(), webOrigin: WEB, apiOrigin: 'http://api.test',
    adminToken: ADMIN, houseOperatorPayerId: 'HOUSEPAYER0001', houseAgents: opts.houseAgents ?? null, now: () => now, strictResponses: true,
    simulatePayouts: true, log: () => {}, notify: async () => {} });
  t.after(async () => { await api.idle(); await api.app.close(); store.close(); });
  let sequence = 0;
  async function request(method: 'GET' | 'POST' | 'DELETE', path: string, body?: any, token: string | null = null, key?: string) {
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (method === 'POST') headers['idempotency-key'] = key ?? `command_${++sequence}_key`;
    const r = await api.app.inject({ method, url: path, headers, ...(body !== undefined ? { payload: body } : {}) });
    const type = String(r.headers['content-type'] ?? '');
    const data = type.startsWith('image/') ? r.rawPayload : r.json();
    const op = operations.find(o => o.method === method.toLowerCase() && new RegExp(`^${o.path.replace(/\{[^}]+\}/g, '[^/]+')}$`).test(path.split('?')[0]));
    assert.ok(op, `contract operation for ${method} ${path}`);
    validateResponse(op, r.statusCode, type, data);
    return { status: r.statusCode, data, headers: r.headers };
  }
  const post = (path: string, body: any, token: string | null, key?: string) => request('POST', path, body, token, key);
  const get = (path: string, token: string | null) => request('GET', path, undefined, token);
  const del = (path: string, token: string | null) => request('DELETE', path, undefined, token);
  const settle = async () => { for (let i = 0; i < 4; i++) { await api.work(); await api.idle(); } };
  const buyer = async () => (await post('/v1/buyer-sessions', undefined, null)).data.token as string;
  async function operator(payerId: string, name: string) {
    const start = await api.app.inject('/v1/operators/connect');
    const state = new URL(String(start.headers.location)).searchParams.get('state')!;
    const back = await api.app.inject(`/v1/operators/connect/callback?code=${encodeURIComponent(`fake:${payerId}:${name}`)}&state=${state}`);
    return new URLSearchParams(String(back.headers.location).split('#')[1]).get('operator_token')!;
  }
  async function agent(name = 'Alpha') {
    const op = await operator(`PAYER${++sequence}`.padEnd(13, '0'), `${name} operator`);
    const r = await post('/v1/operators/me/agents', { name, description: `${name} builds pages.`, style: 'Clean.', webhook_url: null }, op);
    assert.equal(r.status, 201, JSON.stringify(r.data));
    return { token: r.data.token as string, operator: op };
  }
  const draft = async (b: string, body: any = cafeBrief) => (await post('/v1/competitions', body, b)).data;
  async function upload(b: string, competitionId: string, bytes: Buffer, mime: string, caption: string | null = 'Masala Pistachio Chai', key?: string) {
    return post(`/v1/competitions/${competitionId}/references`, { mime_type: mime, content_base64: bytes.toString('base64'), caption }, b, key);
  }
  async function authorize(b: string, competitionId: string) {
    const checkout = (await post(`/v1/competitions/${competitionId}/checkout`, undefined, b)).data;
    fake.controls.approve(checkout.provider_order_id);
    const auth = await post(`/v1/competitions/${competitionId}/authorize`, undefined, b);
    assert.equal(auth.status, 202, JSON.stringify(auth.data));
    return (await get(`/v1/competitions/${competitionId}`, b)).data;
  }
  return { api, store, request, post, get, del, settle, buyer, operator, agent, draft, upload, authorize, advance: async (s: number) => { now += s * 1000; await settle(); } };
}

test('reference upload: PNG, JPEG and WebP by magic bytes, original kept byte for byte, provenance on the brief', async t => {
  const f = await fixture(t);
  const b = await f.buyer();
  const c = await f.draft(b);
  assert.deepEqual(c.reference_images, []);
  for (const format of ['jpeg', 'png', 'webp'] as const) {
    const bytes = await photo(1600, 1000, format, format.length);
    const r = await f.upload(b, c.id, bytes, MIME[format], `${format} photo`);
    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.equal(r.data.mime_type, MIME[format]);
    assert.equal(r.data.size_bytes, bytes.length);
    assert.equal(r.data.sha256, sha(bytes));
    assert.deepEqual([r.data.width, r.data.height], [1600, 1000]);
    assert.deepEqual([r.data.derivative.width, r.data.derivative.height], [1200, 750]);
    assert.equal(r.data.derivative.source_sha256, r.data.sha256);
    assert.equal(r.data.derivative.recipe, 'jpeg-q82-max1200-v1');
    assert.equal(r.data.caption, `${format} photo`);
    const original = await f.get(`/v1/competitions/${c.id}/references/${r.data.id}/original`, b);
    assert.equal(original.headers['content-type'], MIME[format]);
    assert.ok((original.data as Buffer).equals(bytes), 'the original comes back unchanged');
    const derivative = await f.get(`/v1/competitions/${c.id}/references/${r.data.id}/derivative`, b);
    assert.equal(derivative.headers['content-type'], 'image/jpeg');
    assert.equal(derivative.headers['cache-control'], 'private, max-age=31536000, immutable');
    assert.equal(derivative.headers['x-content-type-options'], 'nosniff');
    assert.equal(sha(derivative.data as Buffer), r.data.derivative.sha256);
    assert.equal((derivative.data as Buffer).length, r.data.derivative.size_bytes);
  }
  const brief = (await f.get(`/v1/competitions/${c.id}`, b)).data;
  assert.equal(brief.reference_images.length, 3);
  const list = (await f.get(`/v1/competitions/${c.id}/references`, b)).data;
  assert.equal(list.frozen, false);
  assert.equal(list.max_items, 3);
  assert.deepEqual(list.items, brief.reference_images);
});

test('reference upload validation: type, magic bytes, size, dimensions, count, duplicates', async t => {
  const f = await fixture(t);
  const b = await f.buyer();
  const c = await f.draft(b);
  const jpeg = await photo(400, 300);
  const expectProblem = async (r: Awaited<ReturnType<typeof f.post>>, status: number, code: string, detail: RegExp) => {
    assert.equal(r.status, status, JSON.stringify(r.data));
    assert.equal(r.data.code, code);
    assert.match(r.data.detail, detail);
  };
  // The declared type must match the bytes; anything that isn't PNG/JPEG/WebP is refused, whatever it claims.
  await expectProblem(await f.upload(b, c.id, jpeg, 'image/png'), 400, 'VALIDATION_ERROR', /is image\/jpeg but mime_type says image\/png/);
  const gif = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');
  await expectProblem(await f.upload(b, c.id, gif, 'image/png'), 400, 'VALIDATION_ERROR', /Only PNG, JPEG and WebP/);
  await expectProblem(await f.upload(b, c.id, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/png'), 400, 'VALIDATION_ERROR', /Only PNG, JPEG and WebP/);
  const gifType = await f.post(`/v1/competitions/${c.id}/references`, { mime_type: 'image/gif', content_base64: gif.toString('base64') }, b);
  assert.equal(gifType.status, 400, 'the contract only allows png, jpeg and webp');
  // Right magic bytes, but not a decodable image.
  const broken = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);
  await expectProblem(await f.upload(b, c.id, broken, 'image/png'), 400, 'VALIDATION_ERROR', /could not be decoded/);
  await expectProblem(await f.post(`/v1/competitions/${c.id}/references`, { mime_type: 'image/jpeg', content_base64: `${jpeg.toString('base64')}\n` }, b),
    400, 'VALIDATION_ERROR', /canonical base64/);
  // Over 5 MiB decoded: 413 (a PNG of random pixels compresses badly).
  const noise = Buffer.alloc(1400 * 1400 * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) >>> 24 ^ (i >> 3);
  const big = await sharp(noise, { raw: { width: 1400, height: 1400, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
  assert.ok(big.length > 5 * 1024 * 1024, `test image is ${big.length} bytes`);
  await expectProblem(await f.upload(b, c.id, big, 'image/png'), 413, 'PAYLOAD_TOO_LARGE', /5 MiB/);
  // Over 4096 px on one side, even though it is small in bytes.
  const wide = await sharp({ create: { width: 4097, height: 8, channels: 3, background: '#cc8844' } }).png().toBuffer();
  await expectProblem(await f.upload(b, c.id, wide, 'image/png'), 400, 'VALIDATION_ERROR', /4097x8 px; each side must be at most 4096 px/);
  const edge = await sharp({ create: { width: 4096, height: 16, channels: 3, background: '#cc8844' } }).png().toBuffer();
  assert.equal((await f.upload(b, c.id, edge, 'image/png')).status, 201, '4096 px is allowed');
  // The same image twice is refused; at most three per brief.
  assert.equal((await f.upload(b, c.id, jpeg, 'image/jpeg')).status, 201);
  await expectProblem(await f.upload(b, c.id, jpeg, 'image/jpeg'), 409, 'INVALID_STATE', /already attached/);
  assert.equal((await f.upload(b, c.id, await photo(300, 300, 'webp', 9), 'image/webp')).status, 201);
  await expectProblem(await f.upload(b, c.id, await photo(200, 200, 'jpeg', 5), 'image/jpeg'), 409, 'INVALID_STATE', /At most 3/);
  assert.equal((await f.get(`/v1/competitions/${c.id}/references`, b)).data.items.length, 3);
});

test('reference upload auth: only the brief\'s buyer; retries replay; delete only before the brief opens', async t => {
  const f = await fixture(t);
  const b = await f.buyer();
  const other = await f.buyer();
  const alpha = await f.agent();
  const c = await f.draft(b);
  const jpeg = await photo(640, 480);
  assert.equal((await f.upload('', c.id, jpeg, 'image/jpeg')).status, 401);
  assert.equal((await f.upload(other, c.id, jpeg, 'image/jpeg')).status, 404, 'another buyer cannot see the draft');
  assert.equal((await f.upload(alpha.token, c.id, jpeg, 'image/jpeg')).status, 404, 'agents cannot attach images');
  assert.equal((await f.upload(alpha.operator, c.id, jpeg, 'image/jpeg')).status, 404);
  assert.equal((await f.upload(ADMIN, c.id, jpeg, 'image/jpeg')).status, 404);
  // A retried upload (same key, same body) returns the same image instead of a second one.
  const first = await f.upload(b, c.id, jpeg, 'image/jpeg', 'chai', 'reference_upload_key_1');
  const again = await f.upload(b, c.id, jpeg, 'image/jpeg', 'chai', 'reference_upload_key_1');
  assert.equal(first.status, 201);
  assert.deepEqual(again.data, first.data);
  const conflict = await f.upload(b, c.id, jpeg, 'image/jpeg', 'another caption', 'reference_upload_key_1');
  assert.equal(conflict.data.code, 'IDEMPOTENCY_CONFLICT');
  // Delete: buyer only, before opening; the remaining set comes back.
  assert.equal((await f.del(`/v1/competitions/${c.id}/references/${first.data.id}`, other)).status, 404);
  assert.equal((await f.del(`/v1/competitions/${c.id}/references/${first.data.id}`, null)).status, 401);
  const removed = await f.del(`/v1/competitions/${c.id}/references/${first.data.id}`, b);
  assert.equal(removed.status, 200, JSON.stringify(removed.data));
  assert.deepEqual(removed.data.items, []);
  assert.equal((await f.del(`/v1/competitions/${c.id}/references/${first.data.id}`, b)).status, 404);
  assert.equal((await f.get(`/v1/competitions/${c.id}/references/${first.data.id}/original`, b)).status, 404);
});

test('the reference set freezes when the brief is authorized and opens (409), and is recorded on the competition', async t => {
  const f = await fixture(t);
  const b = await f.buyer();
  const c = await f.draft(b);
  const kept = (await f.upload(b, c.id, await photo(1000, 1400), 'image/jpeg')).data;
  assert.equal((await f.post(`/v1/competitions/${c.id}/checkout`, undefined, b)).status, 201);
  // Still changeable while awaiting authorization.
  const extra = await f.upload(b, c.id, await photo(500, 500, 'png', 3), 'image/png', null);
  assert.equal(extra.status, 201);
  assert.equal((await f.del(`/v1/competitions/${c.id}/references/${extra.data.id}`, b)).status, 200);
  const opened = await f.authorize(b, c.id);
  assert.equal(opened.state, 'open');
  assert.deepEqual(opened.reference_images.map((r: any) => [r.id, r.sha256, r.derivative.sha256]), [[kept.id, kept.sha256, kept.derivative.sha256]]);
  const late = await f.upload(b, c.id, await photo(300, 300, 'jpeg', 4), 'image/jpeg');
  assert.equal(late.status, 409);
  assert.equal(late.data.code, 'INVALID_STATE');
  assert.match(late.data.detail, /frozen/);
  const remove = await f.del(`/v1/competitions/${c.id}/references/${kept.id}`, b);
  assert.equal(remove.status, 409);
  assert.match(remove.data.detail, /frozen/);
  const list = (await f.get(`/v1/competitions/${c.id}/references`, b)).data;
  assert.equal(list.frozen, true);
  assert.deepEqual(list.items, opened.reference_images);
});

test('agents read a published brief\'s references over REST with their own token; everyone else is denied', async t => {
  const f = await fixture(t);
  const b = await f.buyer();
  const other = await f.buyer();
  const alpha = await f.agent('Alpha');
  const c = await f.draft(b);
  const bytes = await photo(2000, 1500, 'webp', 11);
  const ref = (await f.upload(b, c.id, bytes, 'image/webp')).data;
  const base = `/v1/competitions/${c.id}/references`;
  // Draft: invisible to agents and other buyers.
  for (const path of [base, `${base}/${ref.id}/derivative`, `${base}/${ref.id}/original`]) {
    assert.equal((await f.get(path, alpha.token)).status, 404, path);
    assert.equal((await f.get(path, other)).status, 404, path);
    assert.equal((await f.get(path, null)).status, 401, path);
  }
  assert.equal((await f.get(base, ADMIN)).status, 200);
  await f.authorize(b, c.id);
  const list = await f.get(base, alpha.token);
  assert.equal(list.status, 200);
  assert.deepEqual(list.data.items.map((r: any) => r.id), [ref.id]);
  const derivative = await f.get(`${base}/${ref.id}/derivative`, alpha.token);
  assert.equal(sha(derivative.data as Buffer), ref.derivative.sha256);
  const meta = await sharp(derivative.data as Buffer).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height], ['jpeg', 1200, 900]);
  const original = await f.get(`${base}/${ref.id}/original`, alpha.token);
  assert.equal(original.headers['content-type'], 'image/webp');
  assert.ok((original.data as Buffer).equals(bytes));
  // Published, but not for other roles; no token at all is 401; unknown or foreign IDs are 404.
  assert.equal((await f.get(base, other)).status, 403);
  assert.equal((await f.get(`${base}/${ref.id}/derivative`, alpha.operator)).status, 403);
  assert.equal((await f.get(`${base}/${ref.id}/original`, null)).status, 401);
  assert.equal((await f.get(`${base}/ref_missing/derivative`, alpha.token)).status, 404);
  const c2 = await f.draft(b, { ...cafeBrief, title: 'Second brief' });
  await f.authorize(b, c2.id);
  assert.equal((await f.get(`/v1/competitions/${c2.id}/references/${ref.id}/original`, alpha.token)).status, 404, 'a reference only under its own brief');
  // Agents never attach images to someone else's brief, even published.
  assert.equal((await f.upload(alpha.token, c.id, await photo(100, 100), 'image/jpeg')).status, 404);
});

test('MCP: list_brief_references and get_brief_reference return metadata and image content; denials are tool errors', async t => {
  const f = await fixture(t);
  await f.api.app.listen({ port: 0, host: '127.0.0.1' });
  const address = f.api.app.server.address();
  assert.ok(address && typeof address !== 'string');
  const url = new URL(`http://127.0.0.1:${address.port}/mcp`);
  const clients: Client[] = [];
  t.after(async () => { for (const c of clients) await c.close().catch(() => {}); });
  const connect = async (token?: string) => {
    const client = new Client({ name: 'reference-test', version: '0.0.1' });
    await client.connect(new StreamableHTTPClientTransport(url, token ? { requestInit: { headers: { Authorization: `Bearer ${token}` } } } : undefined));
    clients.push(client);
    return client;
  };
  const b = await f.buyer();
  const alpha = await f.agent();
  const c = await f.draft(b);
  const bytes = await photo(900, 1200, 'png', 21);
  const ref = (await f.upload(b, c.id, bytes, 'image/png')).data;
  const client = await connect(alpha.token);
  const call = (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args }) as Promise<{ isError?: boolean; content: any[] }>;

  const hidden = await call('list_brief_references', { competition_id: c.id });
  assert.equal(hidden.isError, true);
  assert.match(hidden.content[0].text, /NOT_FOUND \(HTTP 404\)/, 'a draft is not visible to agents');
  await f.authorize(b, c.id);

  const listed = await call('list_brief_references', { competition_id: c.id });
  assert.ok(!listed.isError, listed.content[0].text);
  const list = JSON.parse(listed.content[0].text);
  assert.equal(list.frozen, true);
  assert.deepEqual(list.items.map((r: any) => [r.id, r.sha256]), [[ref.id, sha(bytes)]]);

  const derivative = await call('get_brief_reference', { competition_id: c.id, reference_id: ref.id });
  assert.ok(!derivative.isError, derivative.content[0].text);
  const info = JSON.parse(derivative.content[0].text);
  assert.equal(info.variant, 'derivative');
  assert.equal(info.sha256, ref.derivative.sha256);
  assert.equal(derivative.content[1].type, 'image');
  assert.equal(derivative.content[1].mimeType, 'image/jpeg');
  assert.equal(sha(Buffer.from(derivative.content[1].data, 'base64')), ref.derivative.sha256);

  const original = await call('get_brief_reference', { competition_id: c.id, reference_id: ref.id, variant: 'original' });
  assert.equal(original.content[1].mimeType, 'image/png');
  assert.ok(Buffer.from(original.content[1].data, 'base64').equals(bytes));

  const missing = await call('get_brief_reference', { competition_id: c.id, reference_id: 'ref_missing' });
  assert.equal(missing.isError, true);
  assert.match(missing.content[0].text, /NOT_FOUND/);

  const anonymous = await connect();
  for (const [name, args] of [['list_brief_references', { competition_id: c.id }], ['get_brief_reference', { competition_id: c.id, reference_id: ref.id }]] as const) {
    const r = await anonymous.callTool({ name, arguments: args }) as { isError?: boolean; content: any[] };
    assert.equal(r.isError, true);
    assert.match(r.content[0].text, /^UNAUTHENTICATED/);
  }
  const { tools } = await client.listTools();
  for (const name of ['list_brief_references', 'get_brief_reference']) {
    const tool = tools.find(x => x.name === name)!;
    assert.equal(tool.annotations?.readOnlyHint, true);
  }
  assert.match(tools.find(x => x.name === 'list_brief_references')!.description!, new RegExp(REFERENCE_RULE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('derivative: deterministic, JPEG, long side at most 1200 px, never enlarged, orientation applied', async () => {
  const big = await photo(3000, 2000);
  const [a, b] = [await makeDerivative(big), await makeDerivative(big)];
  assert.ok(a.bytes.equals(b.bytes), 'same input, same bytes');
  assert.equal(sniffImage(a.bytes), 'image/jpeg');
  assert.deepEqual([a.width, a.height], [1200, 800]);
  assert.ok(a.bytes.length < 400 * 1024, `derivative is ${a.bytes.length} bytes`);
  const prepared = await prepareReference(big.toString('base64'), 'image/jpeg');
  assert.ok(prepared.derivative.bytes.equals(a.bytes));
  assert.equal(prepared.derivative.sha256, sha(a.bytes));
  // Small images are re-encoded but not enlarged.
  const small = await makeDerivative(await photo(300, 200, 'png'));
  assert.deepEqual([small.width, small.height], [300, 200]);
  // EXIF orientation 6 (rotate 90°): the derivative is upright, so 2000x3000 becomes 800x1200.
  const rotated = await sharp(big).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const upright = await makeDerivative(rotated);
  assert.deepEqual([upright.width, upright.height], [800, 1200]);
  const meta = await sharp(upright.bytes).metadata();
  assert.equal(meta.orientation, undefined, 'no metadata in the derivative');
  // Transparency is flattened onto white.
  const clear = await sharp({ create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const { data } = await sharp((await makeDerivative(clear)).bytes).raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[0] > 245 && data[1] > 245 && data[2] > 245, 'white, not black');
  assert.equal(DERIVATIVE.recipe, 'jpeg-q82-max1200-v1');
});

test('embedding: provable-ref tokens become data: URLs and back; unknown IDs and oversize pages are preflight issues', async () => {
  const jpeg = (await makeDerivative(await photo(1200, 900))).bytes;
  const ref: ReferencePhoto = { id: 'ref_chai', sha256: 'a'.repeat(64), derivative_sha256: sha(jpeg), width: 1200, height: 900, size_bytes: jpeg.length, caption: 'Chai', jpeg_base64: jpeg.toString('base64') };
  const page = flyer('<img class="photo" src="provable-ref:ref_chai" alt="Masala Pistachio Chai">');
  const { html, used, unknown } = embedReferences(page, [ref]);
  assert.deepEqual([used, unknown], [['ref_chai'], []]);
  assert.ok(html.includes(`src="data:image/jpeg;base64,${ref.jpeg_base64}"`));
  assert.equal(unembedReferences(html, [ref]), page);
  const ok = preflightWithReferences(page, 'end_turn', [ref]);
  assert.deepEqual(ok.issues, []);
  assert.equal(ok.raw, page);
  assert.ok(ok.html.includes(ref.jpeg_base64));
  const bad = preflightWithReferences(flyer('<img src="provable-ref:ref_other" alt="x">'), 'end_turn', [ref]);
  assert.match(bad.issues[0], /Unknown reference photo id\(s\): ref_other/);
  // The same photo written four times does not fit in 512 KiB once embedded.
  const many = preflightWithReferences(flyer('<img src="provable-ref:ref_chai" alt="a">'.repeat(4)), 'end_turn', [ref]);
  assert.match(many.issues[0], /the limit is 512 KiB/);
  // A judge prompt never carries the embedded base64, only its size and sha256.
  const elided = elideDataUrls(html);
  assert.ok(!elided.includes(ref.jpeg_base64));
  assert.ok(elided.includes(`[${jpeg.length} bytes elided, sha256 ${sha(jpeg)}]`));
  assert.equal(elideDataUrls('<img src="data:image/png;base64,iVBORw0KGgo=">'), '<img src="data:image/png;base64,iVBORw0KGgo=">', 'small data URLs stay');
});

const sampleRef = (): ReferencePhoto => ({ id: 'ref_chai', sha256: 'b'.repeat(64), derivative_sha256: 'c'.repeat(64), width: 1200, height: 800, size_bytes: 1000,
  caption: 'Masala Pistachio "Chai"', jpeg_base64: Buffer.from('fake-jpeg').toString('base64') });

test('builder prompt: the reference rule, provable-ref tokens, sizes and the images themselves', async () => {
  const text = referenceBrief([sampleRef()]);
  assert.ok(text.includes(REFERENCE_RULE));
  assert.equal(REFERENCE_RULE, 'You may crop, cut out, recolor, halftone, collage or reinterpret the photo; embed whichever assets you actually use inside the single self-contained HTML file.');
  assert.match(text, /provable-ref:ref_chai \(1200x800px JPEG; embedding it adds about 1 KiB/);
  assert.match(text, /Buyer's label: "Masala Pistachio  Chai"\./, 'labels are quoted with their quotes neutralised');
  assert.match(text, /not a source of facts/);
  assert.equal(referenceBrief([]), '');
  const competition = { title: 'Cafe Midi drink flyer', brief: cafeBrief.brief, requirements: cafeBrief.requirements } as any;
  assert.equal(typeof builderUserContent(competition, []), 'string', 'no photos: the prompt is unchanged');
  // The generator sends the rules and the image blocks to Claude.
  let sent: any;
  const client = { beta: { messages: { stream(body: any) {
    sent = body;
    return { on() {}, async finalMessage() { return { stop_reason: 'end_turn', content: [{ type: 'text', text: flyer() }] }; } };
  } } } } as unknown as Anthropic;
  await claudeGenerator(client)({ competition, signal: AbortSignal.timeout(1000) } as any, { id: 'agent_house_atelier', name: 'Atelier', style: '.', description: '.' }, () => {}, undefined, [sampleRef()]);
  const content = sent.messages[0].content;
  assert.equal(content[0].type, 'text');
  assert.ok(content[0].text.includes(REFERENCE_RULE));
  assert.deepEqual(content[1], { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: sampleRef().jpeg_base64 } });
  assert.match(content[2].text, /^Brief title: Cafe Midi drink flyer/);
});

test('judge prompt: told about the photos and shown them; may not demand exact bytes or colours; evaluator v5', async () => {
  let request: any;
  const client = { beta: { messages: { async parse(body: any) {
    request = body;
    return { stop_reason: 'end_turn', parsed_output: { checks: cafeBrief.requirements.map(r => ({ requirement_id: r.id, passed: true, reason: 'Seen.' })),
      summary: 'Uses the photo and the brief\'s facts.', narrative: { overall_verdict: 'A clear flyer.', strengths: [], weaknesses: [], best_for: null } } };
  } } } } as unknown as Anthropic;
  const page = flyer(`<img src="data:image/jpeg;base64,${'A'.repeat(8000)}" alt="Chai">`);
  const result = await claudeEvaluator(client).qualify({ title: cafeBrief.title, brief: cafeBrief.brief, requirements: cafeBrief.requirements, references: [sampleRef()],
    artifacts: [{ metadata: {} as any, bytes: new TextEncoder().encode(page) }], signal: AbortSignal.timeout(1000) });
  assert.match(result.evaluator_version, /^claude-judge-v5:/);
  const content = request.messages[0].content;
  assert.match(content[0].text, /reference photo\(s\)/);
  assert.deepEqual(content[1], { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: sampleRef().jpeg_base64 } });
  const text = content.at(-1).text;
  assert.ok(text.includes(JUDGE_REFERENCE_RULES));
  assert.match(text, /<reference_photos>[\s\S]*Photo 1: id ref_chai, original sha256 b{64}, derivative sha256 c{64}/);
  assert.match(JUDGE_REFERENCE_RULES, /uses it or clearly draws from it/);
  assert.match(JUDGE_REFERENCE_RULES, /Do not require, and never claim, exact bytes, unchanged pixels, original colours/);
  assert.match(JUDGE_REFERENCE_RULES, /business name, the product, the address and prices against the brief/);
  assert.ok(!text.includes('A'.repeat(8000)), 'embedded base64 is elided from the judge prompt');
  assert.match(text, /bytes elided, sha256 [a-f0-9]{64}/);
  // Without photos the judge's message has no reference section.
  const plain = judgeText({ title: 't', brief: 'b', requirements: cafeBrief.requirements }, '<p>x</p>');
  assert.ok(!plain.includes('reference_photos'));
  assert.equal(plain, judgeText({ title: 't', brief: 'b', requirements: cafeBrief.requirements, references: [] }, '<p>x</p>'));
});

test('house agent end to end: fetches the frozen photo, embeds it, and the judge receives the same derivative', async t => {
  const prompts: (ReferencePhoto[] | undefined)[] = [];
  const judged: any[] = [];
  const keyword = heuristicEvaluator();
  const evaluator: EvaluatorAdapter = { version: 'claude-judge-v5:fake', async qualify(input) { judged.push(input); return keyword.qualify(input); } };
  const house = {
    agent_house_atelier: streamingHouseAgent({ id: 'agent_house_atelier', name: 'Atelier', style: '.', description: '.' }, async (_ctx, _p, onText, _revision, references) => {
      prompts.push(references);
      const text = flyer(`<img class="photo" src="provable-ref:${references![0].id}" alt="Masala Pistachio Chai with cold brew foam">`);
      onText(text);
      return { text, stopReason: 'end_turn' };
    }),
  };
  const f = await fixture(t, { houseAgents: house, evaluator });
  const b = await f.buyer();
  const c = await f.draft(b);
  const bytes = await photo(2400, 1800, 'jpeg', 33);
  const ref = (await f.upload(b, c.id, bytes, 'image/jpeg', 'Masala Pistachio Chai with cold brew foam')).data;
  assert.equal(c.bid.amount_minor, 500);
  await f.authorize(b, c.id);
  await f.settle();
  assert.equal(prompts.length, 1);
  assert.deepEqual(prompts[0]!.map(r => [r.id, r.sha256, r.derivative_sha256, r.width, r.height]), [[ref.id, ref.sha256, ref.derivative.sha256, 1200, 900]]);
  const entries = (await f.get(`/v1/competitions/${c.id}/submissions`, ADMIN)).data.items;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].qualification_status, 'qualified', JSON.stringify(entries[0].qualification));
  const page = Buffer.from(judged[0].artifacts[0].bytes).toString('utf8');
  assert.ok(page.includes(`src="data:image/jpeg;base64,${prompts[0]![0].jpeg_base64}"`), 'the photo is embedded in the submitted page');
  assert.ok(!page.includes('provable-ref:'));
  assert.ok(Buffer.byteLength(page) <= 512 * 1024);
  assert.deepEqual(judged[0].references.map((r: ReferencePhoto) => [r.id, r.derivative_sha256]), [[ref.id, ref.derivative.sha256]]);
  assert.equal(sha(Buffer.from(judged[0].references[0].jpeg_base64, 'base64')), ref.derivative.sha256);
});

test('reference images survive a restart (stored once, never rewritten)', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'provable-refs-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const dbPath = join(dir, 'api.db');
  const bytes = await photo(800, 600, 'png', 41);
  let competitionId = ''; let ref: any; let token = '';
  {
    const f = await fixture(t, { dbPath });
    token = await f.buyer();
    competitionId = (await f.draft(token)).id;
    ref = (await f.upload(token, competitionId, bytes, 'image/png')).data;
    await f.api.idle();
  }
  const f = await fixture(t, { dbPath });
  const list = (await f.get(`/v1/competitions/${competitionId}/references`, token)).data;
  assert.deepEqual(list.items, [ref]);
  const original = await f.get(`/v1/competitions/${competitionId}/references/${ref.id}/original`, token);
  assert.ok((original.data as Buffer).equals(bytes));
  // A saved immutable document is not re-serialized on later flushes.
  const store = f.store as any;
  const collection = store.collections.find((c: any) => c.kind === 'reference_image');
  assert.equal(collection.immutable, true);
  assert.deepEqual(store.pending().writes.filter((w: any) => w.kind === 'reference_image'), []);
});

test('API client: uploadReferenceImage sends a browser file and returns the stored metadata; local checks come first', async t => {
  const { createApiClient, uploadReferenceImage, REFERENCE_IMAGE_LIMITS } = await import('../packages/api-client/src/index.js');
  const f = await fixture(t);
  const b = await f.buyer();
  const c = await f.draft(b);
  const fetchViaInject = async (input: Request) => {
    const url = new URL(input.url);
    const headers: Record<string, string> = {};
    input.headers.forEach((value, key) => { headers[key] = value; });
    const r = await f.api.app.inject({ method: input.method as 'POST', url: url.pathname + url.search, headers,
      ...(input.body ? { payload: await input.text() } : {}) });
    return new Response(new Uint8Array(r.rawPayload), { status: r.statusCode, headers: { 'content-type': String(r.headers['content-type'] ?? '') } });
  };
  const client = createApiClient({ baseUrl: 'http://api.test', token: b, fetch: fetchViaInject as typeof fetch });
  const bytes = await photo(700, 500, 'webp', 51);
  const stored = await uploadReferenceImage(client, c.id, new Blob([new Uint8Array(bytes)], { type: 'image/webp' }), { idempotencyKey: 'client_upload_key_1', caption: 'Chai' });
  assert.equal(stored.sha256, sha(bytes));
  assert.equal(stored.caption, 'Chai');
  await assert.rejects(uploadReferenceImage(client, c.id, new Blob([new Uint8Array(bytes)], { type: 'image/gif' }), { idempotencyKey: 'client_upload_key_2' }), /PNG, JPEG or WebP/);
  await assert.rejects(uploadReferenceImage(client, c.id, new Blob([new Uint8Array(bytes)], { type: 'image/png' }), { idempotencyKey: 'client_upload_key_3' }), /is image\/webp but mime_type says image\/png/);
  assert.equal(REFERENCE_IMAGE_LIMITS.maxPerBrief, 3);
});
