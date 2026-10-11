import { Context } from './context.js';
import { object, text, validate } from '../registry/schema.js';
import { splitNote } from '../templates/markdown.js';
import { CosmosError } from '../errors.js';
export const notesQuerySchema = object({ path: text, title: text, entity: text, folder: text, includeBody: { type: 'boolean' }, limit: { type: 'integer', minimum: 1, maximum: 100 } });
export const actionsQuerySchema = object({ path: text }, ['path']);
export const modelQuerySchema = object({entity:text,category:text});
export async function queryModel(ctx:Context,raw:unknown) {
  const input=validate<any>(modelQuerySchema,raw),schema=await ctx.rules();
  return {version:schema.version,entities:Object.entries(schema.entities).filter(([id])=>!input.entity||id===input.entity).map(([id,entity]:[string,any])=>({id,folder:entity.folder,folders:entity.folders,statuses:entity.statuses,defaultStatus:entity.defaultStatus,fields:Object.fromEntries(entity.fields.map((key:string)=>[key,schema.common[key]])),categories:Object.entries(schema.stageCategories??{}).flatMap(([stage,names]:[string,any])=>names.filter((name:string)=>!input.category||name===input.category).filter((name:string)=>(entity.folders??[entity.folder]).some((root:string)=>stage+'/'+name===root||entity.allowSubfolders!==false&&(stage+'/'+name).startsWith(root+'/'))).map((name:string)=>({name,folder:stage+'/'+name})))}))};
}
export async function queryNotes(ctx: Context, raw: unknown) {
  const input = validate<any>(notesQuerySchema, raw), schema = await ctx.rules();
  const files = input.path ? [ctx.app.vault.getAbstractFileByPath(input.path)].filter(Boolean) : ctx.app.vault.getMarkdownFiles().filter((file: any) => (!input.title || file.basename.includes(input.title)) && (!input.folder || file.path.startsWith(input.folder + '/')));
  const result = [];
  for (const file of files) {
    const note = splitNote(await ctx.read(file.path)); if (input.entity && note.properties.type !== input.entity) continue;
    const entity = schema.entities[note.properties.type], folder = file.path.split('/').slice(0,-1).join('/'), issues: string[] = [];
    if (!entity) issues.push('type 未登记');
    else { if (!entity.statuses.includes(note.properties.status)) issues.push('status 未登记'); try { ctx.allowed(note.properties.type,folder); } catch { if (!folder.startsWith(schema.archiveFolder + '/') && !folder.startsWith(schema.sealedFolder + '/')) issues.push('目录不符合实体'); } }
    if (note.properties.route !== folder) issues.push('route 与实际目录不同');
    if (!Array.isArray(note.properties.tags)) issues.push('tags 不是列表');
    if (note.properties.project && (!Array.isArray(note.properties.project) || note.properties.project.length > 1)) issues.push('project 需要零个或一个主项目');
    result.push({ path: file.path, title: file.basename, properties: note.properties, body: input.includeBody ? note.body : undefined, issues, issueScope: 'current-observation' });
    if (result.length >= (input.limit ?? 20)) break;
  }
  return result;
}
export async function queryActions(ctx: Context, raw: unknown) {
  const input = validate<any>(actionsQuerySchema, raw); await ctx.rules();
  const file = ctx.app.vault.getAbstractFileByPath(input.path); if (!file) throw new CosmosError('TARGET_MISSING', '指定笔记不存在。');
  const note = splitNote(await ctx.read(input.path)), system = await ctx.system(), actions = system.availableActions(file,note.properties);
  return { path: input.path, type: note.properties.type, actions: actions.map((a:any)=>({id:a.id,label:a.label,mode:a.mode,entity:a.entity,folder:a.folder})), archiveEligibility: actions.some((a:any)=>a.id==='archive') ? system.archiveEligibility(file,note.properties) : undefined };
}
