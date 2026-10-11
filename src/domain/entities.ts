import { object, text, validate } from '../registry/schema.js';
import { name, notePath } from './identity.js';
import { validDate } from './dates.js';
import { tags } from './tasks.js';
import { CosmosError } from '../errors.js';
export const entitySchema = object({ entity: text, category: text, name: text, folder: text, variant: { enum: ['bookStudy'] }, attributes: { type: 'object', additionalProperties: { type: ['string','number','boolean','array','null'] } }, relations: object({ project: text, area: text }), tags: { type: 'array', items: text, uniqueItems: true }, content: { type: 'object' } }, ['name']);
export function resolveEntity(schema: any, raw: unknown) {
  const input = validate<any>(entitySchema, raw);
  if (!input.entity && !input.category) throw new CosmosError('NEEDS_INPUT', '需要实体或唯一已登记分类。', { field: 'entity' });
  let entity = input.entity, folder = input.folder;
  if (input.category) {
    const candidates: { entity: string; folder: string }[] = [];
    for (const [stage, categories] of Object.entries(schema.stageCategories ?? {}) as [string,string[]][]) {
      if (!categories.includes(input.category)) continue;
      const directory = stage + '/' + input.category;
      for (const [id, contract] of Object.entries(schema.entities) as [string,any][]) if (!entity || id === entity) {
        if ((contract.folders ?? [contract.folder]).some((root: string) => root === directory || contract.allowSubfolders !== false && directory.startsWith(root + '/'))) candidates.push({ entity: id, folder: directory });
      }
    }
    if (candidates.length !== 1) throw new CosmosError(candidates.length ? 'TARGET_AMBIGUOUS' : 'INVALID_DIRECTORY', '分类需要唯一符合实体的登记目录。', { candidates });
    entity = candidates[0]!.entity;
    if (folder && folder !== candidates[0]!.folder && !folder.startsWith(candidates[0]!.folder + '/')) throw new CosmosError('INVALID_DIRECTORY', '分类与目录不一致。');
    folder ??= candidates[0]!.folder;
  }
  const contract = schema.entities[entity];
  if (!contract) throw new CosmosError('INVALID_INPUT', '实体未登记。', { entity });
  if (entity === 'task' || entity === 'journal') throw new CosmosError('INVALID_INPUT', '任务和周期记录需要专用流程。');
  folder ??= contract.folder; notePath(folder);
  const title = name(input.name.trim().replace(/\.md$/i, ''));
  if (/[\[\]#]/.test(title)) throw new CosmosError('INVALID_NAME', '名称不能带链接或标签分隔符。');
  if (input.variant && entity !== 'study') throw new CosmosError('INVALID_INPUT', '书籍研读模板只适用于研读。');
  return { input, entity, contract, folder, title, path: folder + '/' + title + '.md' };
}
export function entityAttributes(schema: any, entity: any, input: any, folder: string, now: Date) {
  const properties: Record<string, any> = { type: entity.type, status: entity.defaultStatus, source: 'manual', format: 'note', publish: false, tags: tags(input.tags), project: [], area: '', route: folder, created: now.toISOString(), updated: now.toISOString() };
  for (const [key, raw] of Object.entries(input.attributes ?? {})) {
    const field = schema.common[key];
    if (!entity.fields.includes(key) || !field || ['folder','route','project','area','tags','publish'].includes(key) || field.type === 'readonly') throw new CosmosError('UNKNOWN_FIELD', '属性不属于当前实体，或需要专用关系/发布字段。', { field: 'attributes.' + key, allowed: entity.fields });
    if (key === 'status') { if (!entity.statuses.includes(raw)) throw new CosmosError('INVALID_INPUT', '状态不在当前实体目录中。', { field: key, allowed: entity.statuses }); }
    else if (field.options && !field.options.includes(raw)) throw new CosmosError('INVALID_INPUT', '属性值未登记。', { field: key, allowed: field.options });
    else if (typeof raw !== 'string') throw new CosmosError('INVALID_INPUT', '当前属性需要文本。', { field: key });
    if (key === 'date') validDate(raw as string);
    if (key === 'source_url' && raw) { try { if (!['https:','http:'].includes(new URL(raw as string).protocol)) throw Error(); } catch { throw new CosmosError('INVALID_INPUT', '来源网址需要真实 HTTP(S) 链接。'); } }
    properties[key] = raw;
  }
  for (const key of entity.fields) { const field = schema.common[key]; if (field?.optional === false && properties[key] === undefined) throw new CosmosError('NEEDS_INPUT', '此实体缺少必填属性。', { field: 'attributes.' + key }); }
  for (const key of Object.keys(input.relations ?? {})) if (!entity.fields.includes(key)) throw new CosmosError('UNKNOWN_FIELD', '此实体不接受该关系。', { field: 'relations.' + key });
  return properties;
}
