import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authorizeUrl } from "@/lib/paypal/identity";
import { cookieOptions, OAUTH_STATE_COOKIE, publicOrigin } from "@/lib/operator";

// Step 1 of "Connect with PayPal": send the operator to PayPal with a one-time state value.
export async function GET() {
  const state = randomBytes(16).toString("base64url");
  (await cookies()).set(OAUTH_STATE_COOKIE, state, cookieOptions(10 * 60));
  redirect(authorizeUrl(`${await publicOrigin()}/operators/connect/callback`, state));
}
