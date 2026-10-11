import path from 'node:path';
import { realpath, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CosmosError } from '../errors.js';

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en')).filter(([, v]) => v !== undefined).map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
  return JSON.stringify(value);
}
export function fingerprint(value: unknown) { return createHash('sha256').update(canonical(value)).digest('hex'); }
export function bytesHash(value: string | Buffer) { return createHash('sha256').update(value).digest('hex'); }
export function within(root: string, target: string) { const rel = path.relative(root, target); return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel)); }
export function notePath(value: string): string {
  if (!value || /[\\\x00-\x1f]/.test(value) || value.startsWith('/') || /^[a-z]:/i.test(value) || value.split('/').some(x => !x || x === '.' || x === '..')) throw new CosmosError('INVALID_PATH', '需要库内规范相对路径。');
  for (const part of value.split('/')) name(part);
  return value;
}
export function name(value: string) {
  if (!value.trim() || value.length > 180 || /[<>:"/\\|?*\x00-\x1f]/.test(value) || /[. ]$/.test(value) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)) throw new CosmosError('INVALID_NAME', '名称不适用于 Windows/Linux 文件路径。', { value });
  return value.normalize('NFC');
}
export async function safeTarget(root: string, relative: string) {
  notePath(relative);
  const actualRoot = await realpath(root), target = path.resolve(actualRoot, relative);
  let cursor = target;
  while (cursor !== actualRoot) {
    try {
      const stat = await lstat(cursor);
      if (stat.isSymbolicLink() || !within(actualRoot, await realpath(cursor))) throw new CosmosError('PATH_ESCAPE', '目标不能通过链接离开知识库。');
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    cursor = path.dirname(cursor);
  }
  return target;
}
