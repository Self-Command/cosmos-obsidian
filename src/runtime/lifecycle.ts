import path from 'node:path';
import { Context } from './context.js';
import { CosmosError } from '../errors.js';
import { validate } from '../registry/schema.js';
import { evolveSchema } from '../domain/changes.js';
import { prepareEntity, type EntityPreparation } from './entities.js';
import { splitNote } from '../templates/markdown.js';
import { compileContent } from '../templates/content.js';
import { fingerprint } from '../domain/identity.js';
import { validDate } from '../domain/dates.js';
import type { Plan, Step } from '../workflows/types.js';
export async function prepareEvolution(ctx: Context, raw: unknown, bindingId: string): Promise<EntityPreparation> {
  const input = validate<any>(evolveSchema, raw), schema = await ctx.rules();
  await ctx.target(input.path, false); const original = splitNote(await ctx.read(input.path)), file = ctx.app.vault.getAbstractFileByPath(input.path);
  if (!file || file.extension !== 'md') throw new CosmosError('TARGET_MISSING', '生命周期来源不存在。');
  const system = await ctx.system(), action = system.availableActions(file, original.properties).find((a: any) => a.id === input.transition);
  if (!action) throw new CosmosError('INVALID_ACTION', '当前目录与类型不允许此生命周期。', { available: system.availableActions(file, original.properties).map((a: any) => a.id) });
  const now = new Date(), title = file.basename, folder = input.folder ?? action.folder ?? path.posix.dirname(input.path), target = action.updates?.type ?? original.properties.type;
  if (action.mode === 'create') {
    const entityInput = { entity: action.entity, name: input.name ?? title, folder: input.folder, category: input.category, attributes: input.attributes, relations: input.relations, tags: input.tags ?? original.properties.tags };
    const prepared = await prepareEntity(ctx, entityInput, bindingId), step = prepared.plan.steps[0]!;
    const values: any = { ...input.attributes, name: prepared.title, folder: path.posix.dirname(step.path), tags: step.expected.properties!.tags, source: original.properties.source, area: step.expected.properties!.area || original.properties.area, project: input.transition === 'output' ? ['[[' + input.path.replace(/\.md$/, '') + ']]'] : step.expected.properties!.project?.length ? step.expected.properties!.project : original.properties.project, source_url: original.properties.source_url };
    step.action = 'entity.evolve'; step.source = input.path; step.data = { transition: input.transition, values, now: now.toISOString(), sourceProperties: original.properties, originalBody: original.body, intermediateBody: '# ' + prepared.title + '\n\n' + system.templateFor(action.entity, values.folder).body + '\n## 来源链接\n\n- [[' + input.path.replace(/\.md$/, '') + ']]\n' };
    step.expected.properties = system.normalizeValues(action.entity, values, now);
    prepared.plan.dependencies = ctx.dependencies;
    const { hash, ...value } = prepared;
    const linked = { ...value, suffix: '## 来源链接\n\n- [[' + input.path.replace(/\.md$/, '') + ']]' };
    return { ...linked, hash: fingerprint(linked) };
  }
  if (input.name || input.relations || input.tags || input.evidence && input.transition !== 'published') throw new CosmosError('INVALID_INPUT', '同文件推进不接收改名或关系重写。');
  if (input.transition === 'published') {
    if (!input.evidence) throw new CosmosError('NEEDS_INPUT', '标记已发布需要实际发布网址、日期和证据说明。');
    validDate(input.evidence.publishedDate);
    if (!/^https?:\/\//.test(input.evidence.url) || input.evidence.description.length < 8) throw new CosmosError('INVALID_INPUT', '需要可检查的发布依据。');
  }
  if (input.attributes && Object.keys(input.attributes).some(k => k !== 'date') || input.attributes?.date && input.transition !== 'record') throw new CosmosError('INVALID_INPUT', '同文件推进仅在经历记录时接收实际事件日期。');
  if (input.transition === 'record' && !input.attributes?.date && !original.properties.date) throw new CosmosError('NEEDS_INPUT', '整理经历记录需要实际发生日期。');
  if (input.attributes?.date) validDate(input.attributes.date);
  let destination = folder + '/' + file.name;
  if (input.transition === 'archive') {
    if (input.folder || input.category || input.attributes || input.content) throw new CosmosError('INVALID_INPUT', '归档目录和七天资格由当前服务决定。');
    const eligibility = system.archiveEligibility(file, original.properties, now);
    if (!eligibility.eligible) throw new CosmosError('ARCHIVE_INELIGIBLE', eligibility.reason);
    destination = eligibility.destination;
  } else ctx.allowed(target, folder);
  if (destination !== input.path) await ctx.target(destination);
  const properties: Record<string,any> = { ...original.properties, ...(action.updates ?? {}), project: original.properties.project ?? [], updated: now.toISOString() };
  if (input.transition !== 'repair-body') { properties.tags = system.normalizeTags(original.properties.tags); properties.route = path.posix.dirname(destination); if (target === 'record' && !properties.date) properties.date = input.attributes.date; }
  if (input.transition === 'published') properties.publishedDate = input.evidence.publishedDate;
  if (input.transition === 'archive' && target === 'task') properties.tags.push('archived');
  let template: EntityPreparation['template'] = { version: 1, mapping: 'sections-v1', hash: fingerprint({ role: 'no-additional-body', revision: schema.templateRevision }), prefix: '', fields: [], sections: [] }, intermediateBody = original.body;
  const needsBody = input.transition === 'repair-body' || action.updates?.type && target !== original.properties.type;
  if (needsBody) {
    const targetTemplate = system.templateFor(target, folder);
    template = compileContent(await ctx.read(ctx.templateFolder + '/' + targetTemplate.template));
    const present = new Set(system.bodySections(original.body).map((s: any) => s.title));
    template = { ...template, prefix: '', sections: template.sections.filter(s => !present.has(s.title)) };
    const ids = template.sections.map(s => s.fieldId); template.fields = template.fields.filter(f => ids.includes(f.id));
    intermediateBody = system.supplementBody(original.body, target, title, folder).trim();
    if (input.transition === 'repair-body' && intermediateBody === original.body) properties.updated = original.properties.updated;
  } else template = { ...template, prefix: '', fields: [], sections: [] };
  const links = destination !== input.path ? await ctx.renameScope(input.path,destination) : [];
  const step: Step = { action: 'entity.evolve', path: destination, source: input.path, data: { transition: input.transition, values: { folder: path.posix.dirname(destination), date: input.attributes?.date }, now: now.toISOString(), sourceProperties: original.properties, originalBody: original.body, intermediateBody, evidence: input.evidence, links }, expected: { properties, sourceAbsent: destination !== input.path } };
  const plan: Plan = { version: 1, bindingId, steps: [step], dependencies: ctx.dependencies, environment: ctx.environment, warnings: input.transition === 'published' ? ['发布依据来自用户声明；Amytis 登记内容另由发布服务核验当前版本。'] : [] };
  const prepared = { version: 1 as const, bindingId, plan, template, title, facts: { path: input.path, transition: input.transition }, appendTo: original.body };
  return { ...prepared, hash: fingerprint(prepared) };
}
export async function executeEvolution(ctx: Context, step: Step) {
  const originalFile = ctx.app.vault.getAbstractFileByPath(step.source!);
  if (!originalFile) throw new CosmosError('TARGET_MISSING', '生命周期来源不存在。');
  if (step.path !== step.source) await ctx.target(step.path);
  await ctx.metadata(originalFile, step.data.sourceProperties);
  const system = await ctx.system(), file = await system.executeAction(originalFile, step.data.transition, step.data.values, new Date(step.data.now));
  if (file.path !== step.path) throw new CosmosError('EXECUTION_PARTIAL', '生命周期服务改变了目标；保留实际结果，不重发。', { actual: file.path, expected: step.path }, 4);
  if (step.data.transition === 'published' && step.data.evidence.publishedDate !== step.expected.properties!.publishedDate) throw new CosmosError('VERIFICATION_FAILED', '发布日期与方案不匹配。', {}, 4);
  // Native service supplies legal lifecycle mutation and supplementation. Replace only its expected intermediate body.
  const intermediate = splitNote(await ctx.app.vault.read(file));
  if (intermediate.body !== step.data.intermediateBody.trim()) throw new CosmosError('EXECUTION_PARTIAL', '生命周期中间正文发生变化，已停止内容补齐。', {}, 4);
  await ctx.app.vault.process(file, (bytes: string) => {
    const current = splitNote(bytes); if (current.body !== intermediate.body) throw new CosmosError('CONCURRENT_CHANGE', '正文在生命周期补齐期间变化。');
    const boundary = /^(?:\uFEFF)?---\s*\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(bytes);
    return (boundary?.[0] ?? '') + '\n' + step.expected.body + '\n';
  });
  if (step.data.transition === 'published') await ctx.app.fileManager.processFrontMatter(file, (fm: any) => { fm.publishedDate = step.expected.properties!.publishedDate; });
  return { path: file.path };
}
