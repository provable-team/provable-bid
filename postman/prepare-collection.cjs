// Post-process the output of openapi-to-postmanv2 and merge the hand-written parts from curated.cjs; see README.md.
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const curated = require('./curated.cjs');
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node postman/prepare-collection.cjs <converted.json> <collection.json>');
const spec = YAML.parse(fs.readFileSync(path.join(__dirname, '../contracts/openapi.yaml'), 'utf8'));
const collection = JSON.parse(fs.readFileSync(input, 'utf8'));
const deref = value => value && value.$ref ? deref(value.$ref.split('/').slice(1).reduce((obj, key) => obj[key], spec)) : value;
const operations = new Map();
const byId = new Map();
for (const [path, pathItem] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!operation || !operation.operationId) continue;
    operations.set(`${method.toUpperCase()} ${path.replace(/\{([^}]+)\}/g, ':$1')}`, { operation, pathItem });
    byId.set(operation.operationId, operation);
  }
}

// Contract-derived checks. strict: the success status is required (runnable folders). Otherwise any documented
// status passes (API reference, usually sent without the right credential) and the matching shape is checked.
function contractChecks(operation, strict) {
  const codes = Object.keys(operation.responses);
  const success = codes.filter(c => /^[23]\d\d$/.test(c)).map(Number);
  const problems = codes.filter(c => /^[45]\d\d$/.test(c)).map(Number);
  const response = deref(operation.responses[String(success[0])]);
  const types = Object.keys(response.content || {});
  const schema = deref(response.content?.['application/json']?.schema);
  const required = schema?.required || [];
  return [
    `// Contract checks for ${operation.operationId}, generated from contracts/openapi.yaml.`,
    `const contract = ${JSON.stringify({ success, types, required, problems })};`,
    'const code = pm.response.code;',
    strict
      ? "pm.test(`Status is ${contract.success.join(' or ')}`, () => pm.expect(code).to.be.oneOf(contract.success));"
      : "pm.test('Status is documented by the contract', () => pm.expect(code).to.be.oneOf([...contract.success, ...contract.problems, 500]));",
    'if (contract.success.includes(code)) {',
    "  if (contract.types.length) pm.test(`Content-Type is ${contract.types.join(' or ')}`, () => pm.expect(contract.types.some(t => (pm.response.headers.get('Content-Type') || '').startsWith(t))).to.be.true);",
    "  if (contract.required.length) pm.test(`Has ${contract.required.join(', ')}`, () => pm.expect(pm.response.json()).to.include.all.keys(contract.required));",
    '} else if (code >= 400) {',
    "  pm.test('Problem is application/problem+json with a code', () => {",
    "    pm.expect(pm.response.headers.get('Content-Type')).to.include('application/problem+json');",
    '    const problem = pm.response.json();',
    "    pm.expect(problem.code).to.be.a('string').and.not.empty;",
    '    pm.expect(problem.status).to.eql(code);',
    '  });',
    '}',
  ];
}
const testEvent = exec => ({ listen: 'test', script: { type: 'text/javascript', exec } });

const seen = new Set();
const ids = new Set();
const usedBodies = new Set();
function walk(items) {
  for (const item of items) {
    delete item.id;
    if (item.item) { walk(item.item); continue; }
    delete item.response; // Avoid enormous generated response examples with invalid placeholder data.
    const request = item.request;
    const path = '/' + request.url.path.join('/');
    const key = `${request.method} ${path}`;
    const entry = operations.get(key);
    if (!entry || seen.has(key)) throw new Error(`Unknown or duplicate operation: ${key}`);
    seen.add(key);
    const {operation, pathItem} = entry;
    // Explicit noauth prevents accidentally forwarding credentials to public routes.
    if (Array.isArray(operation.security) && operation.security.length === 0) request.auth = {type:'noauth'};
    else delete request.auth;
    for (const variable of request.url.variable || []) {
      variable.value = `{{${variable.key}}}`;
      ids.add(variable.key);
    }
    const params = [...(pathItem.parameters || []), ...(operation.parameters || [])].map(deref);
    for (const query of request.url.query || []) {
      const definition = params.find(p => p.in === 'query' && p.name === query.key);
      if (definition && !definition.required) query.disabled = true;
    }
    for (const header of request.header || []) {
      if (header.key.toLowerCase() === 'idempotency-key') header.value = '{{idempotencyKey}}';
    }
    if (request.body && request.body.mode === 'raw' && request.body.raw) {
      const example = curated.bodies[operation.operationId];
      if (!example) throw new Error(`No example body in postman/curated.cjs for ${operation.operationId}`);
      usedBodies.add(operation.operationId);
      request.body.raw = JSON.stringify(example, null, 2);
      JSON.stringify(example).replace(/\{\{(\w+)\}\}/g, (_, name) => ids.add(name));
    }
    if (Object.keys(operation.responses).some(code => /^3/.test(code))) {
      item.protocolProfileBehavior = { followRedirects: false };
    }
    item.event = [testEvent(contractChecks(operation, false))];
  }
}
walk(collection.item);
if (seen.size !== operations.size) throw new Error(`Converted ${seen.size} of ${operations.size} operations`);
for (const id of Object.keys(curated.bodies)) if (!usedBodies.has(id)) throw new Error(`Unused example body: ${id}`);

// Hand-written folders from curated.cjs.
function buildItem(def) {
  const operation = def.operationId && byId.get(def.operationId);
  if (def.operationId && !operation) throw new Error(`Unknown operationId ${def.operationId}`);
  const header = [{ key: 'Accept', value: def.contentType || 'application/json' }];
  if (def.idempotent) header.push({ key: 'Idempotency-Key', value: '{{$guid}}', description: 'A fresh key per send. To retry the same command after a network error, reuse the key and body.' });
  if (def.body) header.push({ key: 'Content-Type', value: 'application/json' });
  const query = def.query || [];
  const exec = [];
  let guard = 'pm.response.code === 200';
  if (operation) { exec.push(...contractChecks(operation, true)); guard = 'contract.success.includes(code)'; }
  else {
    exec.push("pm.test('Status is 200', () => pm.response.to.have.status(200));");
    exec.push(`pm.test('Content-Type is ${def.contentType}', () => pm.expect(pm.response.headers.get('Content-Type') || '').to.include('${def.contentType}'));`);
  }
  if (def.tests?.length) exec.push(`if (${guard}) {`, ...def.tests.map(line => '  ' + line), '}');
  def.path.replace(/\{\{(\w+)\}\}/g, (_, name) => ids.add(name));
  return {
    name: def.name,
    ...(def.description ? { description: def.description } : {}),
    request: {
      method: def.method,
      ...(def.noauth ? { auth: { type: 'noauth' } } : {}),
      header,
      ...(def.body ? { body: { mode: 'raw', raw: JSON.stringify(def.body, null, 2), options: { raw: { language: 'json' } } } } : {}),
      url: {
        raw: '{{baseUrl}}' + def.path + (query.length ? '?' + query.map(q => `${q.key}=${q.value}`).join('&') : ''),
        host: ['{{baseUrl}}'],
        path: def.path.split('/').filter(Boolean),
        ...(query.length ? { query } : {}),
      },
    },
    event: [testEvent(exec)],
  };
}
const folders = curated.folders.map(folder => ({
  name: folder.name,
  description: folder.description,
  ...(folder.auth ? { auth: folder.auth } : {}),
  ...(folder.prerequest ? { event: [{ listen: 'prerequest', script: { type: 'text/javascript', exec: folder.prerequest } }] } : {}),
  item: folder.items.map(buildItem),
}));
collection.item = [...folders, {
  name: `API reference (all ${operations.size} operations)`,
  description: 'Every operation in contracts/openapi.yaml, generated by openapi-to-postmanv2. Set `bearerToken` to a buyer, agent, operator or admin credential as each request needs (the quickstart fills it with its buyer token when empty). Tests accept any status the contract documents and check the matching shape. `__mock` routes exist only with the fake payment provider.',
  item: collection.item,
}];

delete collection.info._postman_id;
collection.info.name = `provable.bid API v${spec.info.version}`;
collection.info.description = { content: curated.description, type: 'text/markdown' };
collection.event = [
  { listen: 'prerequest', script: { type: 'text/javascript', exec: [
    '// API reference requests send {{idempotencyKey}}. Leave it empty for a fresh key per request; set it to retry one command.',
    "const fixedKey = pm.environment.get('idempotencyKey') || pm.collectionVariables.get('idempotencyKey');",
    "pm.variables.set('idempotencyKey', fixedKey || pm.variables.replaceIn('{{$guid}}'));",
  ] } },
  testEvent(["pm.test('Response has X-Request-Id', () => pm.expect(pm.response.headers.get('X-Request-Id')).to.be.a('string').and.not.empty);"]),
];
const fixed = { baseUrl: 'http://127.0.0.1:4010', terms_version: 'race-v1' };
const tokens = ['bearerToken', 'buyer_token', 'agent_token'];
collection.variable = [
  ...['baseUrl', ...tokens, 'idempotencyKey', 'terms_version'].map(key => ({ key, value: fixed[key] ?? '' })),
  ...[...ids].filter(key => !(key in fixed) && !tokens.includes(key)).sort().map(key => ({ key, value: '' })),
  { key: 'buyer_id', value: '' },
];
fs.writeFileSync(output, JSON.stringify(collection, null, 2) + '\n');
console.log(`Wrote ${seen.size} operations plus ${folders.length} curated folders to ${output}`);
