import { build } from 'esbuild';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/cli/main.ts'], outfile: 'dist/cosmos.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node24', banner: { js: "import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);" } });
await build({ entryPoints: ['src/runtime/dispatcher.ts'], outfile: 'dist/cosmos-runtime.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'es2022', alias: { obsidian: './src/runtime/periodic-host.ts' } });
const files = {};
for (const name of (await readdir('dist')).filter(x => x !== 'manifest.json')) files[name] = createHash('sha256').update(await readFile('dist/' + name)).digest('hex');
await writeFile('dist/manifest.json', JSON.stringify({ version: '0.1.0', sourceSha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT, protocol: 1, node: process.version, files }, null, 2));
