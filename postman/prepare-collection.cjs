// Post-process the output of openapi-to-postmanv2; see README.md.
const fs = require('node:fs');
const YAML = require('yaml');
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node postman/prepare-collection.cjs <converted.json> <collection.json>');
const spec = YAML.parse(fs.readFileSync('contracts/openapi.yaml', 'utf8'));
const collection = JSON.parse(fs.readFileSync(input, 'utf8'));
const operations = new Map();
for (const [path, pathItem] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!operation || !operation.operationId) continue;
    operations.set(`${method.toUpperCase()} ${path.replace(/\{([^}]+)\}/g, ':$1')}`, { operation, pathItem });
  }
}
const seen = new Set();
const ids = new Set();
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
    const params = [...(pathItem.parameters || []), ...(operation.parameters || [])].map(p => {
      if (!p.$ref) return p;
      return p.$ref.split('/').slice(1).reduce((obj, key) => obj[key], spec);
    });
    for (const query of request.url.query || []) {
      const definition = params.find(p => p.in === 'query' && p.name === query.key);
      if (definition && !definition.required) query.disabled = true;
    }
    for (const header of request.header || []) {
      if (header.key.toLowerCase() === 'idempotency-key') header.value = '{{idempotencyKey}}';
    }
    if (request.body && request.body.mode === 'raw' && request.body.raw) {
      try {
        const body = JSON.parse(request.body.raw);
        const replaceIds = value => {
          if (!value || typeof value !== 'object') return;
          for (const key of Object.keys(value)) {
            if (['_id', '_token'].some(suffix => key.endsWith(suffix)) && typeof value[key] === 'string') {
              value[key] = `{{${key}}}`;
              ids.add(key);
            } else replaceIds(value[key]);
          }
        };
        replaceIds(body);
        request.body.raw = JSON.stringify(body, null, 2);
      } catch {} // Non-JSON bodies, if introduced later, are left untouched.
    }
  }
}
walk(collection.item);
if (seen.size !== operations.size) throw new Error(`Converted ${seen.size} of ${operations.size} operations`);
delete collection.info._postman_id;
collection.info.name = `provable.bid API v${spec.info.version}`;
collection.variable = [{key:'baseUrl', value:'http://127.0.0.1:4010'}, {key:'bearerToken', value:''}, {key:'idempotencyKey', value:''},
  ...[...ids].sort().map(key => ({key, value:''}))];
fs.writeFileSync(output, JSON.stringify(collection, null, 2) + '\n');
console.log(`Wrote ${seen.size} operations to ${output}`);
