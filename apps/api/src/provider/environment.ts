export type PayPalEnvironment = 'sandbox' | 'live';

/** Do not start a real-money server until durable, environment-bound storage and recovery are implemented. */
export function assertLiveActivationReady(environment: PayPalEnvironment): void {
  if (environment === 'live') throw new Error('Live payments are disabled: environment-bound persistent storage and production recovery safeguards are not implemented.');
}

/** Parse deployment configuration without starting the server or contacting PayPal. Sandbox remains the default. */
export function paymentConfiguration(env: Record<string, string | undefined>) {
  const environment = env.PAYPAL_ENV ?? 'sandbox';
  if (environment !== 'sandbox' && environment !== 'live') throw new Error('PAYPAL_ENV must be sandbox or live.');
  const testCardCheckout = env.PAYPAL_TEST_CARD_CHECKOUT === '1';
  if (environment === 'live' && testCardCheckout) throw new Error('PAYPAL_TEST_CARD_CHECKOUT is sandbox-only.');
  const clientId = env.PAYPAL_CLIENT_ID ?? env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const clientSecret = env.PAYPAL_CLIENT_SECRET;
  const payments = env.PAYMENTS ?? (clientId && clientSecret ? 'paypal' : 'fake');
  if (payments !== 'paypal' && payments !== 'fake') throw new Error('PAYMENTS must be paypal or fake.');
  if (environment === 'live' && payments !== 'paypal') throw new Error('PAYPAL_ENV=live requires the PayPal provider and live credentials.');
  if (payments === 'paypal' && (!clientId || !clientSecret)) throw new Error('The PayPal provider requires PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.');
  return {
    usePayPal: payments === 'paypal', environment: environment as PayPalEnvironment,
    options: { clientId: clientId ?? '', clientSecret: clientSecret ?? '', webhookId: env.PAYPAL_WEBHOOK_ID ?? null,
      live: environment === 'live', testCardCheckout },
  };
}

/** Payment approval must stay on the exact PayPal hosts belonging to the configured environment. */
export function paypalApprovalUrl(input: string, live = false): string {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error('Invalid PayPal approval URL.'); }
  const hosts = live ? ['www.paypal.com', 'paypal.com'] : ['www.sandbox.paypal.com', 'sandbox.paypal.com'];
  if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || url.username || url.password || url.port || url.hash)
    throw new Error('PayPal approval URL does not match the configured payment environment.');
  return url.href;
}
