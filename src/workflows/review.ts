import fs from 'node:fs/promises';
import { Store, newId, type Review } from '../state/store.js';
import { fingerprint } from '../domain/identity.js';
import { CosmosError } from '../errors.js';
import { Obsidian, type Receipt } from '../adapters/obsidian.js';
import type { Plan, Execution } from './types.js';
import { noteBytes } from '../templates/markdown.js';
export function previewMarkdown(plan: Plan) {
  if(plan.steps.length===1&&plan.steps[0]!.action==='publish.upload') {
    const p=plan.steps[0]!.data.preview;
    return '# Cosmos 完整发布预览\n\n目标：Amytis（受控 Enveloppe 配置）\n\n'+p.artifacts.map((a:any)=>'## '+a.path+'\n\n身份：'+a.id+'\n\n网址：'+a.url+'\n\n语言：'+a.locale+'\n\n归属：'+(a.parent??'独立内容')+'\n\n'+(a.oldPath?'迁移来源：'+a.oldPath+'\n\n':'')+'完整远端正文：\n\n'+a.content).join('\n\n')+'\n\n附件：\n'+p.assets.map((a:any)=>'- '+a.source+' → '+a.path+'（SHA256 '+a.hash+'，'+a.bytes.length+' bytes）').join('\n')+'\n\n依赖：\n'+plan.dependencies.map(d=>'- '+d.path).join('\n')+'\n\n'+plan.warnings.join('\n');
  }
  return '# Cosmos 完整变更预览\n\n' + plan.steps.map((step, index) => `## ${index + 1}. ${step.action}\n\n目标：${step.path}\n\n` + (step.source ? '来源：' + step.source + '\n\n' : '') + (step.expected.absent ? '回收到系统废纸篓，实际回收后核对来源已移出。\n\n原文：\n\n' + noteBytes(step.data.originalProperties,step.data.originalBody) : step.expected.body !== undefined ? noteBytes(step.expected.properties ?? {}, step.expected.body) : '变更：\n\n' + JSON.stringify(step.data, null, 2)) + (step.data.links?.length ? '\n\n引用更新（Obsidian 原生改名服务）：\n' + step.data.links.map((link:any) => '- ' + link.path + '：' + link.originalLinks.join('、') + ' → ' + step.path.replace(/\.md$/,'') + '（' + link.count + '处）').join('\n') : '')).join('\n\n') + '\n\n依赖：\n' + plan.dependencies.map(x => '- ' + x.path + '（' + x.kind + '）').join('\n') + '\n' + plan.warnings.map(x => '- ' + x).join('\n');
}
export class Reviews {
  store: Store;
  constructor(public adapter: Obsidian) { this.store = adapter.store; }
  async preview(action: string, input: unknown) {
    const receipt = await this.adapter.request(action, input);
    if (receipt.state !== 'succeeded') throw new CosmosError(receipt.error?.code ?? 'PREVIEW_FAILED', receipt.error?.message ?? '无法生成实际预览。', receipt.error?.details);
    return this.savePlan(receipt.result as Plan);
  }
  async savePlan(plan: Plan) {
    const id = newId('r'), preview = previewMarkdown(plan);
    const review: Review = { id, bindingId: this.adapter.config.bindingId, state: 'review-ready', plan, planHash: fingerprint(plan), preview, previewHash: fingerprint(preview), createdAt: new Date().toISOString() };
    await this.store.write('reviews', id, review);
    await this.store.atomic(this.store.file('previews', id), preview);
    return { ok: true, state: 'review-ready', reviewId: id, summary: { changes: plan.steps.map(({ action, path, source }) => ({ action, path, source })), warnings: plan.warnings }, preview: { path: this.store.file('previews', id), format: 'markdown' }, next: { command: 'review commit', reviewId: id } };
  }
  async show(id: string) {
    const review = await this.store.read<Review>('reviews', id); this.store.assertReview(review, this.adapter.config.bindingId);
    return { ok: true, state: review.state, reviewId: id, preview: { path: this.store.file('previews', id), content: review.preview, format: 'markdown' }, executionId: review.executionId };
  }
  async cancel(id: string) {
    const release = await this.store.lock(this.adapter.config.bindingId, newId('e'));
    try {
      const review = await this.store.read<Review>('reviews', id); this.store.assertReview(review, this.adapter.config.bindingId);
      if (review.executionId) throw new CosmosError('EXECUTION_STARTED', '取消方案不能逆转已经派发的执行。');
      if (review.state !== 'review-ready' && review.state !== 'cancelled') throw new CosmosError('INVALID_STATE', '此方案已不可取消。');
      review.state = 'cancelled'; await this.store.write('reviews', id, review); return { ok: true, state: 'cancelled', reviewId: id };
    } finally { await release(); }
  }
  async commit(id: string, confirmed: boolean) {
    if (!confirmed) throw new CosmosError('CONFIRMATION_REQUIRED', '提交需要用户批准当前完整预览。');
    let review = await this.store.read<Review>('reviews', id); this.store.assertReview(review, this.adapter.config.bindingId);
    await this.store.assertPreviewFile(review);
    if (review.executionId) return this.status(review.executionId);
    if (review.state !== 'review-ready') throw new CosmosError('INVALID_STATE', '方案不可执行。', { state: review.state });
    const executionId = newId('e'), release = await this.store.lock(this.adapter.config.bindingId, executionId);
    let retain = false, dispatched = false;
    try {
      review = await this.store.read<Review>('reviews', id); this.store.assertReview(review, this.adapter.config.bindingId);
      await this.store.assertPreviewFile(review);
      if (review.executionId) return this.status(review.executionId);
      if (review.state !== 'review-ready') throw new CosmosError('INVALID_STATE', '方案状态已变化。');
      const execution: Execution = { id: executionId, reviewId: id, bindingId: review.bindingId, state: 'executing', verified: false, steps: [], startedAt: new Date().toISOString() };
      await this.store.write('executions', executionId, execution);
      review.state = 'executing'; review.executionId = executionId; await this.store.write('reviews', id, review);
      dispatched = true;
      const receipt = await this.adapter.request('review.execute', { reviewId: id }, executionId);
      const result = await this.record(execution, review, receipt);
      retain = result.state === 'uncertain';
      return result;
    } catch (error) {
      if (dispatched) {
        // Once dispatch could have occurred, persistence or transport failure must not invite a retry.
        retain = true;
        const execution = await this.store.read<Execution>('executions', executionId);
        execution.state = 'uncertain'; execution.error = error instanceof Error ? error.message : String(error);
        await this.store.write('executions', executionId, execution).catch(() => {});
        review.state = 'uncertain'; await this.store.write('reviews', id, review).catch(() => {});
        return { ok: false, state: 'uncertain', executionId, verified: false, error: { code: 'RESULT_UNCERTAIN', message: '提交结果需要原回执和读回核验；禁止重发。' } };
      }
      throw error;
    } finally { if (!retain) await release(); }
  }
  async record(execution: Execution, review: Review, receipt: Receipt) {
    if (receipt.state === 'started') return { ok: false, state: 'uncertain', executionId: execution.id, verified: false };
    const result = receipt.state === 'failed' ? { state: 'failed' as const, verified: false, steps: [], error: receipt.error } : receipt.result;
    Object.assign(execution, result, { completedAt: new Date().toISOString() });
    if (result.error?.code === 'REVIEW_STALE') review.state = 'stale'; else review.state = execution.state;
    await this.store.write('executions', execution.id, execution); await this.store.write('reviews', review.id, review);
    return { ok: execution.state === 'succeeded' && execution.verified, state: execution.state, executionId: execution.id, verified: execution.verified, steps: execution.steps, error: execution.error };
  }
  async status(id: string) {
    const execution = await this.store.read<Execution>('executions', id);
    if (execution.bindingId !== this.adapter.config.bindingId) throw new CosmosError('WRONG_VAULT', '执行属于不同知识库。', {}, 3);
    return { ok: execution.state === 'succeeded' && execution.verified, state: execution.state, executionId: id, verified: execution.verified, steps: execution.steps, error: execution.error, next: ['executing','uncertain'].includes(execution.state) ? { command: 'execution verify', executionId: id } : undefined };
  }
  async verify(id: string) {
    const execution = await this.store.read<Execution>('executions', id);
    if (execution.bindingId !== this.adapter.config.bindingId) throw new CosmosError('WRONG_VAULT', '执行属于不同知识库。', {}, 3);
    const receipt = await this.adapter.request('execution.verify', { executionId: id });
    if (receipt.state !== 'succeeded') throw new CosmosError(receipt.error?.code ?? 'VERIFICATION_FAILED', receipt.error?.message ?? '无法读取执行结果。', {}, 4);
    if (receipt.result.state === 'uncertain') return { ok: false, ...receipt.result, executionId: id };
    const review = await this.store.read<Review>('reviews', execution.reviewId); this.store.assertReview(review, execution.bindingId);
    const result = await this.record(execution, review, { ...receipt, result: receipt.result });
    const lockFile = this.store.root + '/locks/' + execution.bindingId + '.lock';
    try { const lock = JSON.parse(await fs.readFile(lockFile, 'utf8')); if (lock.executionId === id && result.state !== 'uncertain') await fs.unlink(lockFile); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    return result;
  }
}
