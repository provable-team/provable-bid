import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, hkdfSync, sign, verify, type KeyObject } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

/**
 * Signed delivery receipts (docs/receipts.md). A buyer whose purchase was captured can fetch a receipt that binds the
 * brief, the delivered file fingerprints, the evaluation result and the PayPal capture reference together, signed with
 * this server's Ed25519 key. It holds only facts that are final once the capture is confirmed (no payout state). Anyone can check it offline with the public key at /.well-known/provable-receipts.json.
 */
export const RECEIPT_FORMAT = 'provable-receipt-v1';
const HKDF_LABEL = 'provable-receipts-v1';
// DER prefix of an Ed25519 PKCS#8 private key; the 32-byte seed follows it.
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

export type ReceiptKey = {
  privateKey: KeyObject;
  /** Raw 32-byte public key, base64url. */
  publicKey: string;
  keyId: string;
  /** Where the key came from (never the key itself): env, derived:<NAME>, or ephemeral. */
  source: string;
};

export type ReceiptPayload = {
  format: typeof RECEIPT_FORMAT;
  issuer: string;
  issued_at: string;
  purchase_id: string;
  competition_id: string;
  brief: { title: string; requirements_sha256: string };
  entry: { submission_id: string; agent_id: string; agent_name: string | null; internal: boolean | null };
  evaluation: { evaluator_version: string | null; status: string; checks: { requirement_id: string; passed: boolean }[] };
  artifacts: { asset_id: string; sha256: string; size_bytes: number; mime_type: string }[];
  payment: { mode: string; amount: { currency: string; amount_minor: number }; captured: true; provider_capture_id: string | null };
};
export type SignedReceipt = ReceiptPayload & { key_id: string; signature: string };

/** Canonical JSON: object keys sorted, no whitespace, undefined properties dropped. The verifier uses the same rules. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(v => canonicalJson(v ?? null)).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}
export const sha256Hex = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

function fromPrivateKey(privateKey: KeyObject, source: string): ReceiptKey {
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('RECEIPT_SIGNING_KEY must be an Ed25519 key');
  const x = createPublicKey(privateKey).export({ format: 'jwk' }).x!;
  return { privateKey, publicKey: x, keyId: `rk_${sha256Hex(Buffer.from(x, 'base64url')).slice(0, 16)}`, source };
}
export function receiptKeyFromSeed(seed: Buffer, source = 'seed'): ReceiptKey {
  if (seed.length !== 32) throw new Error('An Ed25519 seed is 32 bytes');
  return fromPrivateKey(createPrivateKey({ key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]), format: 'der', type: 'pkcs8' }), source);
}

/**
 * The signing key, in order: RECEIPT_SIGNING_KEY (PKCS#8 PEM, or a base64 32-byte seed); else derived with HKDF-SHA256
 * (label "provable-receipts-v1") from ADMIN_TOKEN, then WORKFLOWS_SECRET (server-only secrets that persist across
 * deploys; rotating the one in use rotates the receipt key); else a fresh key per boot. Key material is never logged.
 */
export function loadReceiptKey(env: Record<string, string | undefined>): ReceiptKey {
  const given = env.RECEIPT_SIGNING_KEY?.trim();
  if (given) {
    if (given.includes('BEGIN')) return fromPrivateKey(createPrivateKey(given.replaceAll('\\n', '\n')), 'env');
    return receiptKeyFromSeed(Buffer.from(given, 'base64'), 'env');
  }
  for (const name of ['ADMIN_TOKEN', 'WORKFLOWS_SECRET']) {
    const secret = env[name]?.trim();
    if (secret) return receiptKeyFromSeed(Buffer.from(hkdfSync('sha256', secret, 'provable.bid', HKDF_LABEL, 32)), `derived:${name}`);
  }
  return fromPrivateKey(generateKeyPairSync('ed25519').privateKey, 'ephemeral');
}

export function signReceipt(payload: ReceiptPayload, key: ReceiptKey): SignedReceipt {
  const signature = sign(null, Buffer.from(canonicalJson(payload)), key.privateKey).toString('base64url');
  return { ...payload, key_id: key.keyId, signature };
}
/** True when `receipt` (minus key_id and signature) was signed by the raw base64url Ed25519 `publicKey`. */
export function verifyReceipt(receipt: Record<string, unknown>, publicKey: string): boolean {
  const { key_id: _k, signature, ...payload } = receipt;
  if (typeof signature !== 'string') return false;
  const key = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: publicKey }, format: 'jwk' });
  return verify(null, Buffer.from(canonicalJson(payload)), key, Buffer.from(signature, 'base64url'));
}

/** Public, unauthenticated: the verification key and the dependency-free verifier script. */
export function registerReceiptKey(app: FastifyInstance, key: ReceiptKey, apiOrigin: string) {
  const api = apiOrigin.replace(/\/$/, '');
  const found = [new URL('../../../scripts/verify-receipt.mjs', import.meta.url), new URL('../scripts/verify-receipt.mjs', import.meta.url)].find(u => existsSync(u));
  const script = (() => { try { return readFileSync(found ?? resolve('scripts/verify-receipt.mjs'), 'utf8'); } catch { return null; } })();
  const published = {
    alg: 'Ed25519', key_id: key.keyId, public_key: key.publicKey, format: RECEIPT_FORMAT,
    verify: `Remove key_id and signature from the receipt, serialize the rest as canonical JSON (keys sorted, no whitespace), `
      + `and check the base64url signature over those UTF-8 bytes with this raw Ed25519 public_key (base64url). `
      + `Or run: node verify-receipt.mjs receipt.json [original.html] --key ${api}/.well-known/provable-receipts.json`,
    verifier_url: script ? `${api}/verify-receipt.mjs` : null,
    ephemeral: key.source === 'ephemeral',
  };
  app.get('/.well-known/provable-receipts.json', async (req, reply) => reply.header('Cache-Control', 'public, max-age=300')
    .header('X-Content-Type-Options', 'nosniff').header('X-Request-Id', req.id).send(published));
  if (script) app.get('/verify-receipt.mjs', async (req, reply) => reply.header('Cache-Control', 'public, max-age=300')
    .header('X-Content-Type-Options', 'nosniff').header('X-Request-Id', req.id)
    .header('Content-Disposition', 'attachment; filename="verify-receipt.mjs"').type('text/javascript; charset=utf-8').send(script));
}
