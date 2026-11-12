#!/usr/bin/env node
// Builds the APIMatic input for SDK generation from contracts/openapi.yaml without editing the contract.
// Usage: node scripts/apimatic/prepare-spec.mjs <out-dir>   (writes <out-dir>/src/spec/openapi.yaml + metadata)
//
// The contract stays the source of truth. These adjustments only touch the SDK-generation copy:
//  - servers: the live sandbox API becomes the default environment (the contract lists the local server only);
//  - /__mock/* operations are dropped (they exist only on a fake-payments server, never sandbox/production);
//  - APIMatic validation errors are fixed: operations with a summary but no description reuse the summary,
//    a nullable string enum lists `null` via the type only, the integer enum gets a described schema,
//    and a summary containing "/" is reworded;
//  - generator workarounds: const response-header schemas become descriptions, and error responses declared as
//    application/problem+json are declared as application/json (same bytes) so the SDKs decode the Problem body.
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const outDir = resolve(process.argv[2] ?? join(root, '.apimatic-build'));
const specDir = join(outDir, 'src', 'spec');
mkdirSync(specDir, { recursive: true });

const spec = parse(readFileSync(join(root, 'contracts/openapi.yaml'), 'utf8'));

spec.info.contact = { name: 'provable.bid', url: 'https://provable.bid' };
spec.servers = [
  { url: 'https://provable-race-api.onrender.com', description: 'Live sandbox API (PayPal sandbox).' },
  { url: 'http://127.0.0.1:4010', description: 'Local API (fake or sandbox provider).' },
];

for (const path of Object.keys(spec.paths)) {
  if (path.startsWith('/__mock/')) delete spec.paths[path];
}

const methods = ['get', 'put', 'post', 'delete', 'patch', 'head', 'options'];
const operations = [
  ...Object.values(spec.paths).flatMap((item) => methods.map((m) => item[m]).filter(Boolean)),
  ...Object.values(spec.webhooks ?? {}).flatMap((item) => methods.map((m) => item[m]).filter(Boolean)),
];
for (const op of operations) {
  if (op.summary) op.summary = op.summary.replaceAll('/', ' or ');
  if (!op.description && op.summary) op.description = `${op.summary}.`;
}

// Walk every schema: an enum that lists null alongside strings becomes a nullable string enum without the null item;
// an integer enum (APIMatic wants a description per item) becomes a plain integer that names the allowed values.
const walk = (node) => {
  if (Array.isArray(node)) return node.forEach(walk);
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node.enum)) {
    if (node.enum.includes(null) && node.enum.some((v) => v !== null)) {
      node.enum = node.enum.filter((v) => v !== null);
    }
    if (node.type === 'integer') {
      const allowed = node.enum.join(', ');
      delete node.enum;
      node.description = `${node.description ?? ''} Allowed values: ${allowed}.`.trim();
    }
  }
  Object.values(node).forEach(walk);
};
walk(spec.components);
walk(spec.paths);

// Response headers with a `const` string schema (Cache-Control: no-store, X-Content-Type-Options: nosniff) make
// APIMatic's generator fail outright when two operations declare the same one; describe the value instead.
const headerObjects = [
  ...Object.values(spec.components.headers ?? {}),
  ...Object.values(spec.components.responses ?? {}).flatMap((r) => Object.values(r.headers ?? {})),
  ...operations.flatMap((op) => Object.values(op.responses ?? {}).flatMap((r) => Object.values(r.headers ?? {}))),
];
// The generator reads an `application/problem+json`-only response as having no body, so error calls fail to decode.
// Declare the same Problem schema as JSON; the bytes on the wire are identical JSON.
const responses = [
  ...Object.values(spec.components.responses ?? {}),
  ...operations.flatMap((op) => Object.values(op.responses ?? {})),
];
for (const response of responses) {
  const problem = response.content?.['application/problem+json'];
  if (problem && !response.content['application/json']) {
    response.content = { 'application/json': problem };
  }
}

for (const header of headerObjects) {
  if (header.schema && 'const' in header.schema) {
    header.description ??= `Always \`${header.schema.const}\`.`;
    delete header.schema.const;
  }
}

writeFileSync(join(specDir, 'openapi.yaml'), stringify(spec, { lineWidth: 0 }));
copyFileSync(join(here, 'APIMATIC-META.json'), join(specDir, 'APIMATIC-META.json'));
const settingsDir = join(outDir, 'src', 'package-settings');
mkdirSync(settingsDir, { recursive: true });
for (const file of readdirSync(join(here, 'package-settings'))) {
  copyFileSync(join(here, 'package-settings', file), join(settingsDir, file));
}
console.log(`APIMatic input written to ${outDir}/src`);
