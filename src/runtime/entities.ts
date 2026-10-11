import { Context } from './context.js';
import { resolveEntity, entityAttributes } from '../domain/entities.js';
import { compileContent, renderContent, type ContentTemplate } from '../templates/content.js';
import { splitNote, noteBytes } from '../templates/markdown.js';
import { fingerprint } from '../domain/identity.js';
import { CosmosError } from '../errors.js';
import type { Plan, Step } from '../workflows/types.js';
export interface EntityPreparation { version: 1; bindingId: string; plan: Plan; template: ContentTemplate; title: string; facts: unknown; appendTo?: string; suffix?: string; hash: string }
export async function prepareEntity(ctx: Context, raw: unknown, bindingId: string): Promise<EntityPreparation> {
  const schema = await ctx.rules(), { input, entity, contract, folder, title, path } = resolveEntity(schema, raw);
  ctx.allowed(entity, folder); await ctx.target(path);
  const directoryTemplate = Object.entries(contract.directoryTemplates ?? {}).filter(([root]) => folder === root || folder.startsWith(root + '/')).sort((a,b) => b[0].length - a[0].length)[0]?.[1];
  const selection: any = input.variant ? schema.specialTemplates[input.variant] : directoryTemplate ?? contract;
  let templateRaw: string;
  if (selection.template) templateRaw = await ctx.read(ctx.templateFolder + '/' + selection.template);
  else if (selection.body) templateRaw = selection.body;
  else throw new CosmosError('CAPABILITY_MISSING', '没有已登记正文模板。', {}, 3);
  const template = compileContent(templateRaw), properties = entityAttributes(schema, contract, input, folder, new Date());
  if (input.relations?.project) properties.project = [await ctx.relation(input.relations.project, 'project')];
  if (input.relations?.area) properties.area = await ctx.relation(input.relations.area, 'area');
  const plan: Plan = { version: 1, bindingId, steps: [{ action: 'entity.create', path, data: { entity, title }, expected: { properties } }], dependencies: ctx.dependencies, environment: {}, warnings: [] };
  const preparation = { version: 1 as const, bindingId, plan, template, title, facts: { ...input, content: undefined } };
  return { ...preparation, hash: fingerprint(preparation) };
}
export async function fillEntity(ctx: Context, preparation: EntityPreparation, content: unknown, bindingId: string): Promise<Plan> {
  const { hash, ...value } = preparation;
  if (preparation.bindingId !== bindingId || fingerprint(value) !== hash || preparation.template.mapping !== 'sections-v1') throw new CosmosError('DRAFT_STALE', '草稿绑定或内容映射不兼容。');
  await ctx.assertFresh(preparation.plan);
  const body = renderContent(preparation.template, preparation.title, content);
  const finalBody = [preparation.appendTo === undefined ? body : [preparation.appendTo, body.replace(/^# [^\n]+\s*/, '')].filter(Boolean).join('\n\n'), preparation.suffix].filter(Boolean).join('\n\n');
  return { ...preparation.plan, steps: preparation.plan.steps.map(step => ({ ...step, expected: { ...step.expected, body: finalBody } })) };
}
export async function executeEntity(ctx: Context, step: Step) {
  if (step.action !== 'entity.create') throw new CosmosError('CAPABILITY_MISSING', '实体动作没有登记。', {}, 3);
  await ctx.target(step.path);
  const file = await ctx.app.vault.create(step.path, noteBytes(step.expected.properties ?? {}, step.expected.body!));
  return { path: file.path };
}
export async function verifyEntity(ctx: Context, step: Step) {
  const file = ctx.app.vault.getAbstractFileByPath(step.path);
  if (step.expected.absent) return { verified: !file, differences: file ? ['recycled source still exists'] : [], path: step.path };
  if (!file) return { verified: false, differences: ['file missing'] };
  const actual = splitNote(await ctx.app.vault.read(file));
  await ctx.metadata(file,actual.properties);
  const differences: string[] = [];
  if (actual.body !== step.expected.body?.trim()) differences.push('body differs');
  if (step.expected.sourceAbsent && step.source && ctx.app.vault.getAbstractFileByPath(step.source)) differences.push('source still exists');
  differences.push(...await ctx.verifyRenamedLinks(step));
  for (const [key, value] of Object.entries(step.expected.properties ?? {})) if (fingerprint(actual.properties[key] ?? null) !== fingerprint(value)) differences.push(key);
  return { verified: !differences.length, differences, path: file.path };
}
