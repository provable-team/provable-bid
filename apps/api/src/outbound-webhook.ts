import { lookup as dnsLookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { request as httpRequest, type ClientRequest, type IncomingMessage, type RequestOptions } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';

// Conservatively exclude special-use space, not just RFC 1918: metadata, CGNAT, multicast and transition networks
// must not turn an operator-controlled callback into a request to the API's own network.
const blockedV4 = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blockedV4.addSubnet(network, prefix, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
const blockedV6 = new BlockList();
for (const [network, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]] as const)
  blockedV6.addSubnet(network, prefix, 'ipv6');

export function publicWebhookAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedV4.check(address, 'ipv4');
  // An allowlisted global-unicast prefix also excludes mapped IPv4, ULA, link-local, multicast and NAT64.
  return family === 6 && globalV6.check(address, 'ipv6') && !blockedV6.check(address, 'ipv6');
}
const hostnameOf = (url: URL) => url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
const loopback = (host: string) => host === 'localhost' || host === '::1' || (isIP(host) === 4 && host.startsWith('127.'));

/** Syntactic/literal validation at registration. DNS is checked again immediately before every actual delivery. */
export function webhookUrl(input: string, allowLoopback = false): URL {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error('webhook_url must be a valid public HTTPS URL.'); }
  const host = hostnameOf(url);
  const local = allowLoopback && loopback(host);
  if (url.username || url.password || url.hash || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))
    || (!local && (loopback(host) || /\.(localhost|local|internal)$/.test(host) || (isIP(host) && !publicWebhookAddress(host)))))
    throw new Error('webhook_url must use a public HTTPS destination; loopback callbacks are allowed only with fake payments.');
  return url;
}

type Resolver = (hostname: string) => Promise<LookupAddress[]>;
type Requester = (url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => ClientRequest;
type DeliveryOptions = { allowLoopback?: boolean; resolve?: Resolver; request?: Requester; timeoutMs?: number };

/** Resolve and validate every answer. The returned address is then pinned to the actual socket's lookup. */
export async function webhookDestination(url: URL, allowLoopback = false, resolve: Resolver = host => dnsLookup(host, { all: true, verbatim: true })) {
  const host = hostnameOf(webhookUrl(url.href, allowLoopback));
  const family = isIP(host);
  const addresses: LookupAddress[] = family ? [{ address: host, family }] : await resolve(host);
  const local = allowLoopback && loopback(host);
  if (!addresses.length || addresses.some(a => a.family !== isIP(a.address) || !(publicWebhookAddress(a.address) || (local && loopback(a.address)))))
    throw new Error('Webhook DNS must resolve exclusively to public addresses.');
  // Pinning deliberately disables the runtime's family fallback. Prefer IPv4 for dual-stack callbacks on hosts
  // without outbound IPv6; IPv6-only public endpoints remain supported.
  return addresses.find(a => a.family === 4) ?? addresses[0];
}

/** Native requests do not follow redirects; pinning the validated DNS result prevents a second/rebound lookup. */
export async function sendWebhook(input: string, body: string, signature: string, options: DeliveryOptions = {}): Promise<void> {
  const url = webhookUrl(input, options.allowLoopback);
  const signal = AbortSignal.timeout(options.timeoutMs ?? 10_000);
  let abortDns!: () => void;
  const aborted = new Promise<never>((_, reject) => {
    abortDns = () => reject(new Error('Webhook delivery timed out.'));
    signal.addEventListener('abort', abortDns, { once: true });
  });
  let address: LookupAddress;
  try { address = await Promise.race([webhookDestination(url, options.allowLoopback, options.resolve), aborted]); }
  finally { signal.removeEventListener('abort', abortDns); }
  signal.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const request: Requester = options.request ?? (url.protocol === 'https:' ? httpsRequest : httpRequest);
    const req = request(url, {
      method: 'POST', agent: false, signal, family: address.family, maxHeaderSize: 16_384,
      // Keep URL hostname/Host/SNI and certificate verification intact; only the socket destination is pinned.
      lookup: (_host, lookupOptions, callback) => {
        if (lookupOptions.all) callback(null, [address]);
        else callback(null, address.address, address.family);
      },
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-Provable-Signature': signature },
    }, response => {
      const status = response.statusCode ?? 0;
      response.destroy(); // We need only the acknowledgement; never download an operator-controlled response body.
      if (status >= 200 && status < 300) resolve();
      else reject(new Error(`Webhook HTTP ${status}; redirects are not followed.`));
    });
    req.once('error', reject);
    req.end(body);
  });
}
