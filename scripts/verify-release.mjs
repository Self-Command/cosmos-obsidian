import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function files(folder, prefix = '') {
  const names = [];
  for (const entry of await fs.readdir(folder, {withFileTypes: true})) {
    assert.ok(!entry.isSymbolicLink(), 'Distribution cannot contain a symbolic link: ' + prefix + entry.name);
    if (entry.isDirectory()) names.push(...await files(path.join(folder, entry.name), prefix + entry.name + '/'));
    else { assert.ok(entry.isFile(), 'Unsupported distribution object'); names.push(prefix + entry.name); }
  }
  return names.sort();
}
const metadata = JSON.parse(await fs.readFile(path.join(root, 'release.json'), 'utf8'));
const packageRoot = path.join(root, 'runtime');
const manifestBytes = await fs.readFile(path.join(packageRoot, 'manifest.json'));
const manifest = JSON.parse(manifestBytes);
assert.equal(metadata.format, 1);
assert.equal(metadata.license, 'MIT');
assert.equal(metadata.nodeMajor, 24);
assert.equal(manifest.version, metadata.version);
assert.equal(manifest.protocol, 1);
assert.equal(manifest.sourceSha, metadata.runtime.sourceSha);
assert.equal(manifest.runId, metadata.runtime.runId);
assert.equal(manifest.attempt, metadata.runtime.attempt);
assert.equal(digest(manifestBytes), metadata.runtime.manifestSha256, 'Accepted manifest bytes changed');
const expectedSkills = ['amytis','check','create','evolve','files','learn','life','plan','project','tasks'].map(x => 'cosmos-' + x);
assert.deepEqual([...manifest.skills].sort(), expectedSkills);
const actualFiles = await files(packageRoot);
assert.deepEqual(actualFiles, [...Object.keys(manifest.files), 'manifest.json'].sort(), 'Missing or extra runtime files');
for (const [name, expected] of Object.entries(manifest.files)) {
  assert.match(name, /^[a-zA-Z0-9_@./-]+$/);
  assert.ok(name.split('/').every(part => part && part !== '.' && part !== '..'));
  assert.match(expected, /^[a-f0-9]{64}$/);
  assert.equal(digest(await fs.readFile(path.join(packageRoot, ...name.split('/')))), expected, 'Runtime bytes changed: ' + name);
}
for (const skill of expectedSkills) {
  assert.ok(manifest.files['skills/' + skill + '/SKILL.md']);
  assert.ok(manifest.files['skills/' + skill + '/scripts/cosmos.mjs']);
}
for (const name of await files(path.join(root, 'examples'))) if (name.endsWith('.json')) JSON.parse(await fs.readFile(path.join(root, 'examples', name), 'utf8'));
const markdown = ['README.md','CHANGELOG.md',...(await files(path.join(root, 'docs'))).filter(x => x.endsWith('.md')).map(x => 'docs/' + x)];
for (const name of markdown) {
  const source = await fs.readFile(path.join(root, name), 'utf8');
  for (const match of source.matchAll(/\]\(([^\s)]+)\)/g)) {
    const link = match[1];
    if (/^(https?:|mailto:|#)/.test(link)) continue;
    const target = path.resolve(path.dirname(path.join(root, name)), link.split('#')[0]);
    assert.ok(target.startsWith(root + path.sep), 'Documentation link leaves distribution: ' + link);
    await fs.access(target);
  }
}
console.log(JSON.stringify({ok: true, version: metadata.version, sourceSha: manifest.sourceSha, verifiedRuntimeFiles: actualFiles.length, skills: expectedSkills.length}));
