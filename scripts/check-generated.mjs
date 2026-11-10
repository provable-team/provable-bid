import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const dir = await mkdtemp(join(tmpdir(), 'provable-client-'));
try {
  const out = join(dir, 'schema.d.ts');
  execFileSync(process.execPath, ['node_modules/openapi-typescript/bin/cli.js', 'contracts/openapi.yaml', '-o', out], { stdio: 'pipe' });
  if (await readFile(out, 'utf8') !== await readFile('packages/api-client/src/schema.d.ts', 'utf8')) {
    throw new Error('Generated client is stale. Run npm run client:generate and include the output.');
  }
  console.log('Generated client matches contract.');
} finally { await rm(dir, { recursive: true, force: true }); }
