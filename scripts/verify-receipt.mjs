#!/usr/bin/env node
// Verify a provable.bid signed delivery receipt (docs/receipts.md). Dependency-free; Node 22+.
//
//   node verify-receipt.mjs receipt.json [original.html] [--key <url | key.json | base64url public key>]
//
// The key defaults to $PROVABLE_API/.well-known/provable-receipts.json (PROVABLE_API defaults to the production API).
// The receipt's own `issuer` is printed but never trusted to choose the key. Exit code 0 = valid, 1 = not valid.
import { readFileSync } from 'node:fs';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const DEFAULT_API = 'https://provable-race-api.onrender.com';

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(v => canonicalJson(v ?? null)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).filter(k => value[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

async function loadKey(spec) {
  if (/^https?:\/\//.test(spec)) {
    const r = await fetch(spec, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`could not fetch the public key: HTTP ${r.status} from ${spec}`);
    return { ...(await r.json()), source: spec };
  }
  if (/^[A-Za-z0-9_-]{43}$/.test(spec)) return { alg: 'Ed25519', key_id: null, public_key: spec, source: 'command line' };
  return { ...JSON.parse(readFileSync(spec, 'utf8')), source: spec };
}

export async function verifyReceiptFile(receiptPath, originalPath, keySpec) {
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  const problems = [];
  const lines = [];
  const { key_id: keyId, signature, ...payload } = receipt;
  const key = await loadKey(keySpec);
  lines.push(`receipt  ${payload.format ?? '?'} for purchase ${payload.purchase_id ?? '?'} (issuer claims ${payload.issuer ?? '?'})`);
  lines.push(`key      ${key.key_id ?? '(raw)'} from ${key.source}`);
  if (payload.format !== 'provable-receipt-v1') problems.push(`unknown receipt format ${JSON.stringify(payload.format)}`);
  if (key.alg && key.alg !== 'Ed25519') problems.push(`unsupported key algorithm ${key.alg}`);
  if (key.key_id && keyId !== key.key_id) problems.push(`receipt was signed with key ${keyId}, not ${key.key_id}`);
  let valid = false;
  try {
    const pub = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: key.public_key }, format: 'jwk' });
    valid = typeof signature === 'string' && verify(null, Buffer.from(canonicalJson(payload)), pub, Buffer.from(signature, 'base64url'));
  } catch (e) { problems.push(`signature check failed: ${e.message}`); }
  if (!valid) problems.push('signature does NOT match: the receipt was altered or signed by another key');
  else lines.push('signature valid (Ed25519 over the canonical JSON payload)');
  if (originalPath) {
    const digest = createHash('sha256').update(readFileSync(originalPath)).digest('hex');
    const match = (payload.artifacts ?? []).find(a => a.sha256 === digest);
    if (match) lines.push(`original sha256 ${digest} matches artifact ${match.asset_id}`);
    else problems.push(`original sha256 ${digest} matches no artifact in the receipt`);
  }
  return { ok: problems.length === 0, lines, problems };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--key');
  const keySpec = at >= 0 ? args.splice(at, 2)[1] : `${(process.env.PROVABLE_API ?? DEFAULT_API).replace(/\/$/, '')}/.well-known/provable-receipts.json`;
  const [receiptPath, originalPath] = args;
  if (!receiptPath || !keySpec) {
    console.error('usage: node verify-receipt.mjs receipt.json [original.html] [--key <url | key.json | base64url public key>]');
    process.exit(2);
  }
  try {
    const r = await verifyReceiptFile(receiptPath, originalPath, keySpec);
    for (const l of r.lines) console.log(l);
    for (const p of r.problems) console.error(`FAIL     ${p}`);
    console.log(r.ok ? 'OK       receipt verified' : 'NOT VERIFIED');
    process.exit(r.ok ? 0 : 1);
  } catch (e) {
    console.error(`FAIL     ${e.message}`);
    process.exit(1);
  }
}
