import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { CosmosError } from '../errors.js';
import { fingerprint } from '../domain/identity.js';

export type ReviewState = 'review-ready' | 'cancelled' | 'superseded' | 'stale' | 'executing' | 'succeeded' | 'partial' | 'failed' | 'uncertain';
export interface Review { id: string; bindingId: string; state: ReviewState; plan: unknown; planHash: string; preview: string; previewHash: string; executionId?: string; createdAt: string }
export const newId = (kind: 'r' | 'd' | 'e' | 'q') => kind + '-' + randomUUID();
export class Store {
  constructor(public root: string) {}
  file(kind: string, id: string) {
    if (!['reviews', 'drafts', 'executions', 'requests', 'receipts', 'previews'].includes(kind) || !/^[rdeq]-[0-9a-f-]{36}$/.test(id)) throw new CosmosError('INVALID_ID', '状态 ID 无效。');
    return path.join(this.root, kind, id + (kind === 'previews' ? '.md' : '.json'));
  }
  async write(kind: string, id: string, value: unknown) { await this.atomic(this.file(kind, id), JSON.stringify(value, null, 2) + '\n'); }
  async read<T>(kind: string, id: string): Promise<T> { try { return JSON.parse(await readFile(this.file(kind, id), 'utf8')); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') throw new CosmosError('STATE_NOT_FOUND', '未找到对应状态。', { id }); throw e; } }
  async atomic(file: string, bytes: string) {
    await mkdir(path.dirname(file), { recursive: true });
    const temp = file + '.' + randomUUID() + '.tmp';
    const handle = await open(temp, 'wx', 0o600);
    try { await handle.writeFile(bytes, 'utf8'); await handle.sync(); } finally { await handle.close(); }
    try { await rename(temp, file); } catch (e) { await unlink(temp).catch(() => {}); throw e; }
  }
  async lock(bindingId: string, executionId: string) {
    await mkdir(path.join(this.root, 'locks'), { recursive: true });
    const file = path.join(this.root, 'locks', bindingId + '.lock');
    let handle;
    try { handle = await open(file, 'wx', 0o600); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'EEXIST') throw new CosmosError('VAULT_LOCKED', '已有执行锁；查询原执行结果后恢复。', {}, 3); throw e; }
    try { await handle.writeFile(JSON.stringify({ executionId, createdAt: new Date().toISOString() })); await handle.sync(); } finally { await handle.close(); }
    return async () => {
      const saved = JSON.parse(await readFile(file, 'utf8'));
      if (saved.executionId !== executionId) throw new CosmosError('LOCK_CHANGED', '执行锁身份发生变化。', {}, 4);
      await unlink(file);
    };
  }
  assertReview(review: Review, bindingId: string) {
    if (review.bindingId !== bindingId) throw new CosmosError('WRONG_VAULT', '方案属于不同知识库。', {}, 3);
    if (fingerprint(review.plan) !== review.planHash || fingerprint(review.preview) !== review.previewHash) throw new CosmosError('REVIEW_TAMPERED', '方案或预览已被修改。');
  }
}
