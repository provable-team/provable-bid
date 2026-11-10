import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

// The exact same JSON Schema 2020-12 schemas validate mock requests and test responses.
export const contract = parse(readFileSync(new URL('../contracts/openapi.yaml', import.meta.url), 'utf8'));
export function resolve(value: any): any {
  if (!value?.$ref) return value;
  return resolve(value.$ref.slice(2).split('/').reduce((a: any, p: string) => a[p.replace(/~1/g, '/').replace(/~0/g, '~')], contract));
}
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: true });
(addFormats as unknown as (a: Ajv2020) => void)(ajv);
const cache = new Map<string, ReturnType<Ajv2020['compile']>>();
export function validator(schema: any) {
  const key = JSON.stringify(schema);
  if (!cache.has(key)) {
    const root = JSON.parse(JSON.stringify({ ...schema, components: contract.components }));
    cache.set(key, ajv.compile(root));
  }
  return cache.get(key)!;
}
export const operations = Object.entries(contract.paths).flatMap(([path, entry]: [string, any]) =>
  ['get', 'post', 'put', 'patch', 'delete'].filter(method => entry[method]).map(method => ({
    path, method, ...entry[method], parameters: [...(entry.parameters ?? []), ...(entry[method].parameters ?? [])].map(resolve),
  })),
);
export function validateResponse(operation: any, status: number, contentType: string, body: unknown): void {
  const response = resolve(operation.responses[String(status)] ?? operation.responses.default);
  if (!response) throw new Error(`Undocumented status ${status}`);
  const media = response.content?.[contentType.split(';')[0]];
  if (!media) throw new Error(`Undocumented content type ${contentType}`);
  const check = validator(media.schema);
  // Binary HTTP bodies are represented by base64 strings only for schema validation;
  // the server still sends raw bytes with the declared image Content-Type.
  const value = Buffer.isBuffer(body) ? body.toString('base64') : body;
  if (!check(value)) throw new Error(`Invalid ${operation.operationId} response: ${JSON.stringify(check.errors)}`);
}
