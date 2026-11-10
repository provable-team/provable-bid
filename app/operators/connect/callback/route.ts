import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { createOperatorSession, upsertOperator } from "@/lib/market";
import { cookieOptions, OAUTH_STATE_COOKIE, OPERATOR_COOKIE } from "@/lib/operator";
import { identityFromCode } from "@/lib/paypal/identity";

// Step 2: PayPal sends the operator back with ?code&state. Verify state, learn their payer ID, sign them in.
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const sp = req.nextUrl.searchParams;
  const expected = jar.get(OAUTH_STATE_COOKIE)?.value;
  jar.delete(OAUTH_STATE_COOKIE);
  const fail = (reason: string) => redirect(`/operators?error=${encodeURIComponent(reason)}`);

  if (sp.get("error")) fail(sp.get("error_description") ?? "PayPal login was cancelled.");
  const code = sp.get("code");
  if (!code || !expected || sp.get("state") !== expected) fail("That login link expired. Please connect again.");

  let operatorId: string;
  try {
    const me = await identityFromCode(code!);
    operatorId = upsertOperator(getDb(), { paypalPayerId: me.payerId, paypalEmail: me.email, name: me.name }).id;
  } catch (err) {
    console.error("[paypal] connect failed:", err);
    fail(err instanceof Error ? err.message : "PayPal login failed.");
  }
  jar.set(OPERATOR_COOKIE, createOperatorSession(getDb(), operatorId!), cookieOptions(30 * 24 * 3600));
  redirect("/operators");
}
