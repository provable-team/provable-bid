import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServer, type ClientRequest, type IncomingMessage, type RequestOptions } from 'node:http';
import type { LookupFunction } from 'node:net';
import { publicWebhookAddress, sendWebhook, webhookDestination, webhookUrl } from '../apps/api/src/outbound-webhook.js';

test('outbound webhooks reject private/special IPv4, mapped IPv4 and non-public IPv6', () => {
  for (const address of ['0.0.0.0', '10.1.2.3', '100.64.0.1', '127.0.0.1', '169.254.169.254', '172.16.1.1',
    '192.168.1.1', '192.0.0.8', '192.0.2.1', '192.88.99.1', '198.18.0.1', '198.51.100.1', '203.0.113.1',
    '224.0.0.1', '255.255.255.255', '::', '::1', '::ffff:127.0.0.1', '::ffff:8.8.8.8', 'fc00::1', 'fe80::1',
    'ff02::1', '64:ff9b::a00:1', '2001::1', '2001:db8::1', '2002:7f00:1::1', '3fff::1', 'not-an-ip'])
    assert.equal(publicWebhookAddress(address), false, address);
  for (const address of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111', '2001:4860:4860::8888'])
    assert.equal(publicWebhookAddress(address), true, address);
});

test('webhook registration requires public HTTPS; explicit loopback is fake-mode only', () => {
  for (const url of ['https://127.0.0.1/cb', 'https://2130706433/cb', 'https://0x7f000001/cb', 'https://[::1]/cb',
    'https://[::ffff:127.0.0.1]/cb', 'https://169.254.169.254/cb', 'http://localhost/cb', 'https://localhost./cb',
    'https://api.internal/cb', 'https://a.localhost/cb', 'https://a.local/cb', 'https://name:secret@hooks.example/cb',
    'https://hooks.example/cb#fragment', 'file:///tmp/cb', 'not-a-url'])
    assert.throws(() => webhookUrl(url), Error, url);
  assert.equal(webhookUrl('https://hooks.example/cb').hostname, 'hooks.example');
  for (const url of ['http://localhost:4010/cb', 'http://127.0.0.1:4010/cb', 'http://[::1]:4010/cb'])
    assert.equal(webhookUrl(url, true).protocol, 'http:');
  assert.throws(() => webhookUrl('http://10.0.0.1/cb', true), 'fake mode is not a private-network exemption');
});

test('every DNS answer must be public, including IPv6; only explicit fake-mode loopback can resolve locally', async () => {
  const url = new URL('https://hooks.example/cb');
  for (const address of ['10.1.1.1', '169.254.169.254', '::ffff:127.0.0.1', 'fd00::1', 'fe80::1'])
    await assert.rejects(webhookDestination(url, false, async () => [{ address: '8.8.8.8', family: 4 }, { address, family: address.includes(':') ? 6 : 4 }]), /exclusively to public/);
  await assert.rejects(webhookDestination(url, false, async () => []), /exclusively to public/);
  await assert.rejects(webhookDestination(url, true, async () => [{ address: '127.0.0.1', family: 4 }]), /exclusively to public/);
  const local = await webhookDestination(new URL('http://localhost/cb'), true, async () => [{ address: '::1', family: 6 }]);
  assert.equal(local.address, '::1');
});

test('the validated DNS address is pinned to the socket; a rebound retry is rejected and redirects are never followed', async () => {
  let resolutions = 0; let requests = 0; let destroyed = false;
  const resolve = async () => [{ address: ++resolutions === 1 ? '8.8.8.8' : '127.0.0.1', family: 4 }];
  const request = (url: URL, options: RequestOptions, ack: (response: IncomingMessage) => void) => {
    requests++;
    assert.equal(url.hostname, 'hooks.example', 'the hostname stays intact for TLS verification and Host');
    assert.equal(options.agent, false, 'no unvalidated pooled socket is reused');
    (options.lookup as LookupFunction)('hooks.example', { family: 4, all: false }, (error, address, family) => {
      assert.equal(error, null); assert.equal(address, '8.8.8.8'); assert.equal(family, 4);
    });
    const req = new EventEmitter();
    return Object.assign(req, { end(body: string) {
      assert.equal(body, '{"event":"opened"}');
      assert.equal((options.headers as Record<string, string>)['X-Provable-Signature'], 'signed');
      queueMicrotask(() => ack({ statusCode: 307, headers: { location: 'http://169.254.169.254/' }, destroy() { destroyed = true; } } as unknown as IncomingMessage));
      return req;
    } }) as ClientRequest;
  };
  const options = { resolve, request };
  await assert.rejects(sendWebhook('https://hooks.example/cb', '{"event":"opened"}', 'signed', options), /HTTP 307/);
  assert.equal(destroyed, true);
  assert.equal(resolutions, 1, 'no second DNS lookup can rebind between validation and connection');
  await assert.rejects(sendWebhook('https://hooks.example/cb', '{"event":"opened"}', 'signed', options), /exclusively to public/);
  assert.equal(requests, 1, 'rebound IP is rejected before any second socket opens');
});

test('native delivery sends the signed body to fake-mode loopback and refuses a redirect without hitting its target', async t => {
  let targetHits = 0; let body = ''; let signature: string | undefined;
  const target = createServer((_request, response) => { targetHits++; response.end(); });
  await new Promise<void>(resolve => target.listen(0, '127.0.0.1', resolve));
  const targetPort = (target.address() as { port: number }).port;
  let redirect = false;
  const source = createServer((request, response) => {
    if (request.url === '/stall') { request.resume(); return; }
    signature = request.headers['x-provable-signature'] as string;
    request.on('data', chunk => { body += String(chunk); });
    request.on('end', () => {
      if (redirect) { response.writeHead(302, { Location: `http://127.0.0.1:${targetPort}/internal` }); response.end(); }
      else { response.writeHead(204); response.end(); }
    });
  });
  await new Promise<void>(resolve => source.listen(0, '127.0.0.1', resolve));
  t.after(() => { source.closeAllConnections(); target.closeAllConnections(); source.close(); target.close(); });
  const url = `http://127.0.0.1:${(source.address() as { port: number }).port}/cb`;
  await assert.rejects(sendWebhook(url, '{}', 'sig'), /public HTTPS/);
  await sendWebhook(url, '{"event":"opened"}', 'sig', { allowLoopback: true });
  assert.equal(body, '{"event":"opened"}'); assert.equal(signature, 'sig');
  redirect = true;
  await assert.rejects(sendWebhook(url, '{}', 'sig', { allowLoopback: true }), /HTTP 302/);
  assert.equal(targetHits, 0);
  await assert.rejects(sendWebhook(new URL('/stall', url).href, '{}', 'sig', { allowLoopback: true, timeoutMs: 20 }), /abort/i);
});

test('the total delivery deadline also bounds DNS resolution and never opens a socket after timing out', async () => {
  let requests = 0;
  await assert.rejects(sendWebhook('https://hooks.example/cb', '{}', 'sig', {
    timeoutMs: 10,
    resolve: () => new Promise(resolve => setTimeout(() => resolve([{ address: '8.8.8.8', family: 4 }]), 30)),
    request: () => { requests++; throw new Error('must not connect'); },
  }), /timed out/);
  assert.equal(requests, 0);
});
