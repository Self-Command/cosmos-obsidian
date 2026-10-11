import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
assert.match(manifest.sourceSha, /^[a-f0-9]{40}$/);
assert.equal(manifest.sourceSha, process.env.GITHUB_SHA);
for (const [name, hash] of Object.entries(manifest.files)) {
  const bytes = await readFile('dist/' + name);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
  const text = bytes.toString('utf8');
  assert.ok(!/obsidian-cosmos-skills|cosmos-skills[\\/]|37118c2365dcf353662509676736ebfe014e2986/.test(text), 'Legacy dependency in release');
}
console.log(JSON.stringify({ verified: true, sourceSha: manifest.sourceSha, files: Object.keys(manifest.files).length }));
