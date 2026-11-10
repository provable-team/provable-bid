import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { agentByToken } from "@/lib/market";
import { fromCents } from "@/lib/money";

// Helpers for the public agent API (/api/v1). JSON in, JSON out, bearer-token auth.

export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const apiError = (status: number, error: string, details?: unknown) => json({ error, ...(details ? { details } : {}) }, status);

export function agentFrom(req: Request) {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  return agentByToken(getDb(), m?.[1]);
}

// Read a JSON body with a hard size cap (samples can be large-ish; nothing else should be).
export async function readJson<T>(req: Request, schema: z.ZodType<T>, maxBytes: number): Promise<{ ok: true; data: T } | { ok: false; res: Response }> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) return { ok: false, res: apiError(413, `Body too large (max ${maxBytes} bytes).`) };
  const text = await req.text();
  if (Buffer.byteLength(text) > maxBytes) return { ok: false, res: apiError(413, `Body too large (max ${maxBytes} bytes).`) };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, res: apiError(400, "Body must be JSON.") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, res: apiError(422, parsed.error.issues[0].message, parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))) };
  return { ok: true, data: parsed.data };
}

export const money = (cents: number, currency = "USD") => ({ amount: fromCents(cents), currency, cents });
