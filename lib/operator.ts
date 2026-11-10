import "server-only";
import { cookies, headers } from "next/headers";
import { getDb } from "@/lib/db";
import { operatorBySession } from "@/lib/market";

export const OPERATOR_COOKIE = "pb_op";
export const OAUTH_STATE_COOKIE = "pb_oauth_state";

export const cookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && !process.env.ALLOW_INSECURE_COOKIES,
  path: "/",
  maxAge: maxAgeSeconds,
});

export async function currentOperator() {
  return operatorBySession(getDb(), (await cookies()).get(OPERATOR_COOKIE)?.value);
}

// The site's public origin (Render terminates TLS in front of us), used for PayPal's return URL.
export async function publicOrigin(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
