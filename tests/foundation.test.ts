import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { canonical, fingerprint, name, notePath, safeTarget } from '../src/domain/identity.js';
import { Store, newId, type Review } from '../src/state/store.js';
import { object, text, validate } from '../src/registry/schema.js';
import { loadConfig } from '../src/config.js';
const cleanup: string[] = [];
async function temp() { const root = await mkdtemp(path.join(os.tmpdir(), 'cosmos-foundation-')); cleanup.push(root); return root; }
afterEach(async () => { for (const root of cleanup.splice(0)) await rm(root, { recursive: true, force: true }); });
describe('input and identity boundaries', () => {
  it('hashes equivalent normalized inputs consistently without dropping arrays', () => {
    expect(fingerprint({ b: 2, a: [1, 3] })).toBe(fingerprint({ a: [1, 3], b: 2 }));
    expect(fingerprint({ a: [1, 3] })).not.toBe(fingerprint({ a: [3, 1] }));
    expect(canonical({ a: undefined, b: '中文' })).toBe('{"b":"中文"}');
  });
  it.each(['../other.md', '/absolute.md', 'C:/other.md', 'a\\b.md', 'a//b.md', 'a/../b.md', 'a/NUL.md'])('rejects invalid vault target %s', input => { expect(() => notePath(input)).toThrow(); });
  it.each(['CON', 'aux.md', 'name.', 'name ', 'a:b', 'a\u0000b'])('rejects invalid filenames %s', input => { expect(() => name(input)).toThrow(); });
  it('accepts Chinese, multiline business content and rejects nested unknown keys', () => {
    const schema = object({ title: text, schedule: object({ date: text }, ['date']) }, ['title']);
    expect(validate(schema, { title: '中文\n$() ` &', schedule: { date: '2026-10-12' } })).toBeTruthy();
    expect(() => validate(schema, { title: 'title', schedule: { date: '2026-10-12', planHash: 'injected' } })).toThrow();
  });
  it('rejects a symlink target escaping the vault', async () => {
    const root = await temp(), vault = path.join(root, 'vault'), outside = path.join(root, 'outside');
    await mkdir(vault); await mkdir(outside); await symlink(outside, path.join(vault, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(safeTarget(vault, 'linked/new.md')).rejects.toThrow();
    expect(await safeTarget(vault, 'notes/new.md')).toBe(path.join(vault, 'notes/new.md'));
  });
});
describe('durable state and binding', () => {
  it('roundtrips atomic state, detects tampering and wrong-vault access', async () => {
    const store = new Store(await temp()), id = newId('r'), plan = { title: '原始内容' }, preview = '# 完整预览';
    const review: Review = { id, bindingId: 'bound', state: 'review-ready', plan, preview, planHash: fingerprint(plan), previewHash: fingerprint(preview), createdAt: '2026-10-11' };
    await store.write('reviews', id, review);
    const saved = await store.read<Review>('reviews', id);
    store.assertReview(saved, 'bound');
    expect(() => store.assertReview(saved, 'other')).toThrow();
    saved.preview += 'tampered'; expect(() => store.assertReview(saved, 'bound')).toThrow();
    expect(() => store.file('reviews', '../../secret')).toThrow();
  });
  it('allows one writer and never steals a lock because its process timed out', async () => {
    const store = new Store(await temp()), id = newId('e'), release = await store.lock('binding', id);
    await expect(store.lock('binding', newId('e'))).rejects.toThrow();
    expect(JSON.parse(await readFile(path.join(store.root, 'locks/binding.lock'), 'utf8')).executionId).toBe(id);
    await release(); const second = await store.lock('binding', newId('e')); await second();
  });
  it('rejects state inside the vault, including a linked directory', async () => {
    const root = await temp(), vault = path.join(root, 'vault'); await mkdir(vault);
    const file = path.join(root, 'binding.json');
    const input = { version: 1, vaultPath: vault, vaultName: 'vault', cliPath: process.execPath, stateRoot: path.join(vault, 'state'), schemaPath: 'rules/schema.json' };
    await writeFile(file, JSON.stringify(input)); await expect(loadConfig(file)).rejects.toThrow();
    await writeFile(file, JSON.stringify({ ...input, stateRoot: path.join(root, 'state') }));
    expect((await loadConfig(file)).bindingId).toBe(fingerprint({ vaultPath: await import('node:fs/promises').then(fs => fs.realpath(vault)), vaultName: 'vault' }));
  });
});
