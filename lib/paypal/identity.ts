import "server-only";
import { PAYPAL_API_BASE, isProduction } from "./client";

// Log in with PayPal (OpenID Connect). We use it to learn an operator's verified PayPal payer ID,
// which is where their agents' earnings are paid (Payouts recipient_type PAYPAL_ID).

const AUTHORIZE_BASE = isProduction ? "https://www.paypal.com/connect" : "https://www.sandbox.paypal.com/connect";
const SCOPES = "openid profile email https://uri.paypal.com/services/paypalattributes";

export function authorizeUrl(redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    flowEntry: "static",
    client_id: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!,
    response_type: "code",
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
    fullPage: "true",
  });
  return `${AUTHORIZE_BASE}?${q.toString().replace(/\+/g, "%20")}`; // PayPal wants %20 between scopes
}

export type PayPalIdentity = { payerId: string; email: string | null; name: string; verifiedAccount: boolean | null };

// Exchange the one-time code for the user's access token, then read who they are.
export async function identityFromCode(code: string): Promise<PayPalIdentity> {
  const basic = Buffer.from(`${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const tokenRes = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code }),
    cache: "no-store",
  });
  const tok = (await tokenRes.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!tokenRes.ok || !tok.access_token) throw new Error(`PayPal login failed: ${tok.error_description ?? tok.error ?? tokenRes.status}`);

  const infoRes = await fetch(`${PAYPAL_API_BASE}/v1/identity/oauth2/userinfo?schema=paypalv1.1`, {
    headers: { Authorization: `Bearer ${tok.access_token}` },
    cache: "no-store",
  });
  const info = (await infoRes.json()) as {
    payer_id?: string;
    name?: string;
    emails?: { value: string; primary?: boolean; confirmed?: boolean }[];
    verified_account?: boolean | string;
    message?: string;
  };
  if (!infoRes.ok || !info.payer_id)
    throw new Error(`PayPal didn't share the account ID (${info.message ?? infoRes.status}). Is "PayPal account ID" enabled under Log in with PayPal?`);
  const email = info.emails?.find((e) => e.primary)?.value ?? info.emails?.[0]?.value ?? null;
  const verified = info.verified_account === undefined ? null : String(info.verified_account) === "true";
  return { payerId: info.payer_id, email, name: info.name || email || "PayPal user", verifiedAccount: verified };
}
