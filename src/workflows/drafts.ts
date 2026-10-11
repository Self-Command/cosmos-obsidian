import { Store, newId, type Review } from '../state/store.js';
import { fingerprint } from '../domain/identity.js';
import { CosmosError } from '../errors.js';
import type { Obsidian } from '../adapters/obsidian.js';
import type { EntityPreparation } from '../runtime/entities.js';
import { Reviews } from './review.js';
import type { Plan } from './types.js';
interface Draft { id: string; bindingId: string; revision: number; preparation: EntityPreparation; preparationHash: string; reviewId?: string }
export class Drafts {
  store: Store;
  constructor(public adapter: Obsidian, public reviews = new Reviews(adapter)) { this.store = adapter.store; }
  async open(input: unknown) {
    const result = await this.adapter.request('draft.prepare', input);
    if (result.state !== 'succeeded') throw new CosmosError(result.error?.code ?? 'DRAFT_FAILED', result.error?.message ?? '无法准备草稿。', result.error?.details);
    const preparation = result.result as EntityPreparation, id = newId('d');
    const draft: Draft = { id, bindingId: this.adapter.config.bindingId, revision: 0, preparation, preparationHash: fingerprint(preparation) };
    await this.store.write('drafts', id, draft);
    return { ok: true, state: 'needs-content', draftId: id, contentContract: { title: preparation.title, fields: preparation.template.fields }, facts: preparation.facts, missing: [], next: { command: 'draft preview', draftId: id } };
  }
  async preview(id: string, content: unknown) {
    const release = await this.store.lock(this.adapter.config.bindingId, newId('e'));
    try {
      const draft = await this.store.read<Draft>('drafts', id);
      if (draft.bindingId !== this.adapter.config.bindingId || fingerprint(draft.preparation) !== draft.preparationHash) throw new CosmosError('DRAFT_STALE', '草稿绑定或内容已变化。');
      if (draft.reviewId) {
        const prior = await this.store.read<Review>('reviews', draft.reviewId); this.store.assertReview(prior, draft.bindingId);
        if (prior.executionId) throw new CosmosError('EXECUTION_STARTED', '已提交的草稿不能换成新方案。');
      }
      const receipt = await this.adapter.request('entity.fill', { preparation: draft.preparation, content });
      if (receipt.state !== 'succeeded') throw new CosmosError(receipt.error?.code ?? 'CONTENT_INVALID', receipt.error?.message ?? '不能生成正文预览。', receipt.error?.details);
      // Supersede first: a crash between durable saves cannot leave both revisions executable.
      if (draft.reviewId) { const prior = await this.store.read<Review>('reviews', draft.reviewId); prior.state = 'superseded'; await this.store.write('reviews', prior.id, prior); }
      const result = await this.reviews.savePlan(receipt.result as Plan);
      draft.revision++; draft.reviewId = result.reviewId; await this.store.write('drafts', id, draft);
      return { ...result, draftId: id, revision: draft.revision };
    } finally { await release(); }
  }
}
