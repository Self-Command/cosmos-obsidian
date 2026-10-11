import path from 'node:path';
import { Context } from './context.js';
import { fileChangeSchema } from '../domain/changes.js';
import { validate } from '../registry/schema.js';
import { name, fingerprint } from '../domain/identity.js';
import { splitNote } from '../templates/markdown.js';
import { CosmosError } from '../errors.js';
import type { Step } from '../workflows/types.js';
export async function prepareFileChange(ctx: Context, raw: unknown): Promise<Step> {
  const input = validate<any>(fileChangeSchema, raw); if (!ctx.schema) await ctx.rules(); await ctx.target(input.path, false);
  const original = splitNote(await ctx.read(input.path)), entity = ctx.schema.entities[original.properties.type], currentFolder = path.posix.dirname(input.path);
  if (!input.path.endsWith('.md') || !entity || original.properties.type === 'task') throw new CosmosError('INVALID_TARGET', '只接受普通业务笔记；任务由 TaskNotes 管理。');
  ctx.allowed(original.properties.type, currentFolder);
  const properties: Record<string,any> = { ...original.properties, updated: new Date().toISOString() }; let body = original.body, destination = input.path;
  if (input.action === 'content.patch') {
    const count = body.split(input.find).length - 1;
    if (count !== 1) throw new CosmosError(count ? 'TARGET_AMBIGUOUS' : 'TARGET_MISSING', '指定正文片段需要唯一匹配。', { matches: count });
    if (/amytis:public|<%|\{\{/.test(input.find + input.replace)) throw new CosmosError('INVALID_INPUT', '普通正文修改不能改变公开区间或注入模板程序。');
    body = body.replace(input.find, () => input.replace);
  } else if (input.action === 'relations.patch') {
    if (!Object.keys(input.relations).length) throw new CosmosError('INVALID_INPUT', '关系修改不能为空。');
    for (const [key, value] of Object.entries(input.relations)) { if (!entity.fields.includes(key)) throw new CosmosError('UNKNOWN_FIELD', '此实体不接受该关系。', { field: key }); const resolved = value === null ? '' : await ctx.relation(value as string, key); properties[key] = key === 'project' ? resolved ? [resolved] : [] : resolved; }
  } else if (input.action === 'file.rename') {
    const title = name(input.name.trim().replace(/\.md$/i, '')); if (/[\[\]#]/.test(title)) throw new CosmosError('INVALID_NAME', '名称不能带链接/标签分隔符。'); destination = currentFolder + '/' + title + '.md';
  } else if (input.action === 'file.move') {
    ctx.allowed(original.properties.type, input.folder);
    if (input.folder.split('/').slice(0,2).join('/') !== currentFolder.split('/').slice(0,2).join('/')) throw new CosmosError('INVALID_ACTION', '跨阶段移动需要生命周期。');
    destination = input.folder + '/' + path.posix.basename(input.path); properties.route = input.folder;
  } else if (input.action === 'file.recycle') {
    return { action: input.action, path: input.path, data: { originalProperties: original.properties, originalBody: original.body, mode: 'system-trash' }, expected: { absent: true } };
  }
  if (destination !== input.path) await ctx.target(destination);
  const links = destination !== input.path ? await ctx.renameScope(input.path,destination) : [];
  return { action: input.action, path: destination, source: destination === input.path ? undefined : input.path, data: { originalProperties: original.properties, originalBody: original.body, links }, expected: { properties, body, sourceAbsent: destination !== input.path } };
}
export async function executeFileChange(ctx: Context, step: Step) {
  const source = step.source ?? step.path, file = ctx.app.vault.getAbstractFileByPath(source);
  if (!file) throw new CosmosError('TARGET_MISSING', '目标不存在。');
  if (step.source) await ctx.target(step.path);
  const live = splitNote(await ctx.app.vault.read(file));
  if (fingerprint(live.properties) !== fingerprint(step.data.originalProperties) || live.body !== step.data.originalBody) throw new CosmosError('CONCURRENT_CHANGE', '实际文件已变化，未执行修改。');
  if (step.action === 'file.recycle') { await ctx.app.vault.trash(file, true); return { path: source, mode: 'system-trash' }; }
  await ctx.app.fileManager.processFrontMatter(file, (fm: any) => {
    const current = { ...fm }; delete current.position;
    if (fingerprint(current) !== fingerprint(step.data.originalProperties)) throw new CosmosError('CONCURRENT_CHANGE', '属性在修改期间变化。');
    for (const [key,value] of Object.entries(step.expected.properties!)) fm[key] = value;
  });
  if (live.body !== step.expected.body) await ctx.app.vault.process(file, (bytes: string) => {
    const current = splitNote(bytes); if (current.body !== live.body) throw new CosmosError('CONCURRENT_CHANGE', '正文在修改期间变化。');
    const header = /^(?:\uFEFF)?---\s*\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(bytes);
    return (header?.[0] ?? '') + '\n' + step.expected.body + '\n';
  });
  if (step.source) await ctx.app.fileManager.renameFile(file, step.path);
  return { path: file.path };
}
