import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { operations, resolve, validator } from '../scripts/contract.js';

const read = (file: string) => JSON.parse(readFileSync(new URL(`../postman/${file}`, import.meta.url), 'utf8'));
const collection = read('provable-v0.4.postman_collection.json');
const requests: { folder: string; item: any }[] = [];
(function walk(items: any[], folder: string) {
  for (const item of items) item.item ? walk(item.item, folder || item.name) : requests.push({ folder, item });
})(collection.item, '');
const keyOf = (request: any) => `${request.method} /${request.url.path.join('/')}`;
const operationFor = (request: any) => operations.find(op => {
  const pattern = new RegExp('^' + op.path.replace(/\{[^}]+\}/g, '[^/]+') + '$');
  return op.method.toUpperCase() === request.method && pattern.test('/' + request.url.path.join('/'));
});
// Stand-in values for Postman variables, so example bodies can be checked against the contract schemas.
const sample = (raw: string) => raw.replace(/\{\{(\w+)\}\}/g, (_, name) => (name === 'terms_version' ? 'race-v1' : `${name}_sample`));

test('the Postman API reference lists every contract operation exactly once', () => {
  const reference = requests.filter(r => r.folder.startsWith('API reference')).map(r => keyOf(r.item.request));
  const expected = operations.map(op => `${op.method.toUpperCase()} ${op.path.replace(/\{([^}]+)\}/g, ':$1')}`);
  assert.deepEqual([...reference].sort(), [...expected].sort());
});

test('every Postman request has tests and every example body matches the contract', () => {
  for (const { item } of requests) {
    const exec = item.event?.find((e: any) => e.listen === 'test')?.script.exec ?? [];
    assert.ok(exec.some((line: string) => line.includes('pm.test(')), `${item.name} has no tests`);
    const request = item.request;
    const operation = operationFor(request);
    if (!request.url.path[0].startsWith('.') && !request.url.path.join('/').match(/^(openapi\.json|agent-guide\.md|examples\/agent\.mjs)$/)) {
      assert.ok(operation, `${item.name}: ${keyOf(request)} is not in the contract`);
    }
    if (operation?.parameters.some((p: any) => p.name === 'Idempotency-Key' && p.required)) {
      assert.ok(request.header.some((h: any) => h.key === 'Idempotency-Key' && /^\{\{.+\}\}$/.test(h.value)), `${item.name} needs an Idempotency-Key`);
    }
    if (!request.body?.raw) continue;
    assert.ok(operation.requestBody, `${item.name}: ${operation.operationId} takes no body`);
    const schema = resolve(operation.requestBody).content['application/json'].schema;
    const check = validator(schema);
    assert.ok(check(JSON.parse(sample(request.body.raw))), `${item.name}: ${JSON.stringify(check.errors)}`);
  }
});

test('Postman files carry no credentials', () => {
  for (const file of ['provable-local.postman_environment.json', 'provable-bid-sandbox.postman_environment.json']) {
    for (const v of read(file).values) if (/token|secret|key/i.test(v.key) && v.key !== 'idempotencyKey') assert.equal(v.value, '', `${file}: ${v.key}`);
  }
  for (const v of collection.variable) if (/token/i.test(v.key)) assert.equal(v.value, '', `collection variable ${v.key}`);
  assert.doesNotMatch(JSON.stringify(collection), /\b(pba|pbb|pbo)_[A-Za-z0-9]{8,}/);
});
