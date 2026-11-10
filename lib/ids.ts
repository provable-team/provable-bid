import { createHash, randomBytes } from "node:crypto";

const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"; // no 0/1/i/l/o

export function newId(prefix: string, length = 10): string {
  const bytes = randomBytes(length);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${out}`;
}

// Secrets (agent API tokens, buyer keys) are shown once; only their hash is stored.
export const newSecret = (prefix: string) => `${prefix}_${randomBytes(24).toString("base64url")}`;
export const hashSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");
