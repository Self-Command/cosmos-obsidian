import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parse, stringify } from 'yaml';
import { Context } from './context.js';
import { safeTarget, fingerprint, notePath, name as title } from '../domain/identity.js';
import { noteBytes, splitNote } from '../templates/markdown.js';
import { publicationSchema, writingSchema } from '../domain/publication.js';
import { validate } from '../registry/schema.js';
import { compileContent } from '../templates/content.js';
import { entityAttributes } from '../domain/entities.js';
import type { EntityPreparation } from './entities.js';
import type { Plan, Step } from '../workflows/types.js';
import { CosmosError } from '../errors.js';
const manifestPath = '.obsidian/amytis/publication.json';
const pluginRoot = '.obsidian/plugins/obsidian-mkdocs-publisher';
function policy(settings:any) {
  const get=(pointer:string)=>pointer.split('/').reduce((v,k)=>v?.[k],settings);
  const pointers=['upload/behavior','upload/rootFolder','upload/yamlFolderKey','upload/frontmatterTitle/enable','upload/frontmatterTitle/key','upload/replacePath','upload/autoclean/enable','embed/useObsidianFolder','embed/folder','embed/sendSimpleLinks','embed/notes','embed/attachments','conversion/links/internal','conversion/links/wiki','conversion/tags/inline','plugin/shareKey','plugin/shareAll/enable'];
  const github=settings?.github;
  return {github:github&&{user:github.user,repo:github.repo,branch:github.branch,automaticallyMergePR:github.automaticallyMergePR},rules:Object.fromEntries(pointers.map(p=>[p,get(p)]))};
}

export function publicationEnvironment(app: any) {
  const p=app.plugins.plugins['obsidian-mkdocs-publisher'];
  // Credentials never enter a plan, preview, fingerprint input or result.
  return fingerprint({version:p?.manifest?.version,bridge:p?.__amytisBridgeVersion,loaded:p?.__amytisLoadedFingerprint,policy:policy(p?.settings)});
}
async function load(ctx: Context) {
  const system=await ctx.system(), modules:any={};
  for(const name of ['adapter','transport','service']) {
    const relative=ctx.schema.scriptFolder+'/lib/publish-'+name+'.cjs';await ctx.read(relative);
    const absolute=await safeTarget(ctx.vaultPath,relative);delete require.cache[require.resolve(absolute)];modules[name]=require(absolute);
    if(typeof modules[name]!=='function')throw new CosmosError('CAPABILITY_MISSING','发布服务入口不兼容。',{},3);
  }
  const contract=JSON.parse(await ctx.read(ctx.schema.scriptFolder+'/lib/publish-contract.json'));
  if(contract.version!==1||contract.pluginVersion!=='7.8.2')throw new CosmosError('CAPABILITY_MISSING','发布契约不兼容。',{},3);
  const api={parseYaml:parse,stringifyYaml:stringify,requestUrl:async ({url}:any)=>{const response=await fetch(url,{signal:AbortSignal.timeout(20000)});return {status:response.status,text:await response.text()};}};
  const service=await modules.service(ctx.app,api,system,modules,contract);
  return {service,modules,contract,system,api};
}
async function track(ctx:Context, service:any, remote=false) {
  const absolute=await safeTarget(ctx.vaultPath,manifestPath);
  if(fs.existsSync(absolute))await ctx.read(manifestPath);else ctx.depend({path:manifestPath,kind:'absent',hash:null});
  const records=await service.records();
  for(const r of records.filter((x:any)=>x.fm.site_target==='amytis'))await ctx.read(r.path);
  if(remote){
    for(const relative of [pluginRoot+'/main.js','宇宙/演化/变更/amytis-implementation.json'])await ctx.read(relative);
    // data.json contains authentication; track only the policy fields in memory and on disk.
    ctx.environment.publication=publicationEnvironment(ctx.app);
    ctx.environment.publicationDisk=await policyDisk(ctx);
    await requirePublication(ctx);
  }
  return records;
}
async function requirePublication(ctx:Context) {
  const p=ctx.app.plugins.plugins['obsidian-mkdocs-publisher'];
  if(p?.manifest?.version!=='7.8.2'||p.__amytisBridgeVersion!==1||!p.__amytisLoadedFingerprint)throw new CosmosError('CAPABILITY_MISSING','需要已加载的 Enveloppe 7.8.2 受控 bridge v1。',{},3);
  const marker=JSON.parse(await ctx.read('宇宙/演化/变更/amytis-implementation.json'));
  if(p.__amytisLoadedFingerprint!==marker.patchedFingerprint||(await import('../domain/identity.js')).bytesHash(fs.readFileSync(await safeTarget(ctx.vaultPath,pluginRoot+'/main.js')))!==marker.patchedFingerprint)throw new CosmosError('CAPABILITY_MISSING','发布插件加载指纹不一致。',{},3);
  const contract=JSON.parse(await ctx.read(ctx.schema.scriptFolder+'/lib/publish-contract.json'));
  const disk=JSON.parse(fs.readFileSync(await safeTarget(ctx.vaultPath,pluginRoot+'/data.json'),'utf8'));
  for(const settings of [p.settings,disk]){
    if(settings?.github?.user!=='Self-Command'||settings.github.repo!=='amytis'||settings.github.branch!=='main')throw new CosmosError('CAPABILITY_MISSING','发布目标政策不匹配。',{},3);
    for(const rule of contract.settings){const value=rule.pointer.slice(1).split('/').reduce((v:any,k:string)=>v?.[k],settings);if(fingerprint(value??null)!==fingerprint(rule.value))throw new CosmosError('CAPABILITY_MISSING','发布配置政策不匹配。',{pointer:rule.pointer},3);}
  }
}
export async function policyDisk(ctx:Context) {
  const data=JSON.parse(fs.readFileSync(await safeTarget(ctx.vaultPath,pluginRoot+'/data.json'),'utf8'));
  return fingerprint(policy(data));
}
function values(raw:any, id:string) {
  if(raw.members&&((raw.role??'entry')!=='index'||!['collection','series'].includes(raw.kind))||raw.outline&&((raw.role??'entry')!=='index'||raw.kind!=='book'))throw new CosmosError('INVALID_INPUT','成员仅属于专题/系列目录；大纲仅属于书籍目录。');
  if(raw.kind==='book'&&raw.role==='index'&&raw.members||['collection','series'].includes(raw.kind)&&raw.outline)throw new CosmosError('INVALID_INPUT','不能创建重复的组织清单。');
  return {site_target:'amytis',site_id:id,site_locale:raw.language,site_kind:raw.kind,site_role:raw.role??'entry',site_slug:raw.slug,site_date:raw.date,title:raw.title,excerpt:raw.excerpt??'',coverImage:raw.coverImage??'',tags:raw.tags??[],publish:raw.permission,site_body:raw.scope,...(raw.members?{site_members:raw.members}:{}),...(raw.outline?{site_outline:raw.outline}:{})};
}
async function prospective(ctx:Context, service:any, records:any[], notePath:string, properties:any, body:string) {
  const record={path:notePath,fm:properties,body,raw:noteBytes(properties,body)};
  const adapter=service.adapter(await service.manifest());
  if(!adapter.eligible(record))throw new CosmosError('INVALID_INPUT','实体或目录不具备发布登记资格。');
  if(properties.type==='note'&&properties.site_kind!=='flow'||properties.type==='knowledge'&&!['note','post'].includes(properties.site_kind)||properties.site_role==='index'&&properties.type!=='output')throw new CosmosError('INVALID_INPUT','网站形态与实体职责不兼容。');
  adapter.slug(properties.site_slug);adapter.locale(properties.site_locale);
  if(!adapter.dateValid(properties.site_date)||!properties.title.trim())throw new CosmosError('INVALID_INPUT','标题或展示日期无效。');
  adapter.publicBody(record);
  const prepared=await adapter.prepare([...records.filter(r=>r.path!==notePath),record],{selected:[],manifest:await service.manifest()});
  if(!prepared.valid)throw new CosmosError('INVALID_INPUT','发布身份、语言或成员关系无效。',{errors:prepared.errors});
  return record;
}
export async function prepareWriting(ctx:Context,raw:unknown,bindingId:string):Promise<EntityPreparation> {
  const input=validate<any>(writingSchema,raw);await ctx.rules();const {service}=await load(ctx);await track(ctx,service);
  const folder=input.folder??'太阳/光球/文章';ctx.allowed('output',folder);
  if(folder!=='太阳/光球/文章'&&!folder.startsWith('太阳/光球/文章/'))throw new CosmosError('INVALID_DIRECTORY','原创写作须在光球文章目录。');
  const name=title(input.name),target=notePath(folder+'/'+name+'.md');await ctx.target(target);
  const v=input.values,variant=(v.role==='index'?'amytisIndex':v.kind==='book'?'amytisChapter':'amytisArticle')+(v.language==='en'?'En':'');
  const template=compileContent(ctx.schema.specialTemplates?.[variant]?.body??'');
  const properties:Record<string,any>={...entityAttributes(ctx.schema,ctx.schema.entities.output,{tags:v.tags},folder,new Date()),...values(v,randomUUID())};
  if(v.kind==='book'&&(v.role??'entry')==='entry')properties.site_kind='post';
  if(input.relations?.project)properties.project=[await ctx.relation(input.relations.project,'project')];
  if(input.relations?.area)properties.area=await ctx.relation(input.relations.area,'area');
  const plan:Plan={version:1,bindingId,steps:[{action:'writing.create',path:target,data:{values:v},expected:{properties}}],dependencies:ctx.dependencies,environment:ctx.environment,warnings:['本方案创建本地写作并登记身份；上传需要另行审阅发布方案。',...(v.scope==='whole'?['选择整篇会包含模板中的内部写作段落，需要逐字审阅公开范围。']:[]),...(v.kind==='book'&&(v.role??'entry')==='entry'?['章节先登记为独立文章；保存书籍大纲后由目录确定章节归属。']:[])]};
  const p={version:1 as const,bindingId,plan,template,title:name,facts:input};return {...p,hash:fingerprint(p)};
}
export async function validateWriting(ctx:Context,plan:Plan) {
  if(!plan.steps.some(x=>x.action==='writing.create'))return plan;
  const {service}=await load(ctx),records=await service.records();
  for(const step of plan.steps.filter(x=>x.action==='writing.create'))await prospective(ctx,service,records,step.path,step.expected.properties,step.expected.body!);
  return plan;
}
export async function preparePublication(ctx:Context,raw:unknown,bindingId:string):Promise<Plan> {
  const input=validate<any>(publicationSchema,raw),{service}=await load(ctx);
  const remote=!['register','copy'].includes(input.action),records=await track(ctx,service,remote);let step:Step;
  if(input.action==='register'||input.action==='copy') {
    const source=notePath(input.path),original=splitNote(await ctx.read(source));
    const copy=input.action==='copy',target=copy?notePath((input.folder??'太阳/光球/文章')+'/'+title(input.name)+'.md'):source;
    if(copy){ctx.allowed('output',path.posix.dirname(target));await ctx.target(target);}
    const id=copy?randomUUID():original.properties.site_id??randomUUID();
    const publicText=copy?service.adapter(await service.manifest()).publicBody({body:original.body,fm:{...original.properties,site_body:input.values.scope}}):'';
    const body=copy?(input.values.scope==='marked'?'<!-- amytis:public:start -->\n'+publicText+'\n<!-- amytis:public:end -->':publicText):original.body;
    const properties={...(copy?entityAttributes(ctx.schema,ctx.schema.entities.output,{},path.posix.dirname(target),new Date()):original.properties),...values(input.values,id)};
    await prospective(ctx,service,records,target,properties,body);
    const previous=(await service.manifest()).entries[id];
    if(previous?.path&&(previous.path.startsWith('content/en/')?'en':'zh')!==properties.site_locale||previous?.live&&original.properties.site_slug!==properties.site_slug)throw new CosmosError('INVALID_INPUT','已上传语言或已上线网址须保留，另建公开副本。');
    step={action:'publish.'+input.action,path:target,source:copy?source:undefined,data:{values:input.values,originalBody:original.body,originalProperties:original.properties},expected:{properties,body}};
  } else if(input.action==='upload') {
    if(!input.ids.length)throw new CosmosError('INVALID_INPUT','上传需要明确选择发布身份。');
    const preview=await service.preview(input.ids,{allowMigration:input.allowMigration??false});
    if(!preview.valid)throw new CosmosError('INVALID_INPUT','发布预检失败。',{errors:preview.errors});
    // ArrayBuffer is normalized to byte arrays so persisted reviews retain exact attachment bytes.
    preview.assets=preview.assets.map((a:any)=>({...a,bytes:Array.from(new Uint8Array(a.bytes))}));
    for(const asset of preview.assets)if(asset.source&&ctx.app.vault.getAbstractFileByPath(asset.source))ctx.depend({path:asset.source,kind:'file',hash:(await import('../domain/identity.js')).bytesHash(fs.readFileSync(await safeTarget(ctx.vaultPath,asset.source)))});
    step={action:'publish.upload',path:manifestPath,data:{preview},expected:{}};
  } else if(input.action==='withdraw') {
    const p=await service.withdrawPreview(input.id);delete p.manifest;
    step={action:'publish.withdraw',path:manifestPath,data:{id:input.id,preview:p},expected:{}};
  } else {
    const m=await service.manifest(),batch=m.transactions.find((t:any)=>t.id===input.batch);
    if(!batch||!['uploaded','merged'].includes(batch.state))throw new CosmosError('INVALID_STATE','批次不存在或不需要恢复/刷新。');
    if(m.transactions.filter((t:any)=>['uploaded','merged'].includes(t.state)).length!==1)throw new CosmosError('INVALID_STATE','存在多个未闭合批次，不能隐式处理其他批次。');
    step={action:'publish.'+input.action,path:manifestPath,data:{batch:input.batch,snapshot:batch},expected:{}};
  }
  return {version:1,bindingId,steps:[step],dependencies:ctx.dependencies,environment:ctx.environment,warnings:remote?['上传、PR 合并、部署与页面版本分别核验；网络未知状态保留批次，不重新上传。']:['本方案只登记本地公开许可与范围；远端状态不随本地改名或移动而改变。']};
}
export async function executePublication(ctx:Context,step:Step) {
  const {service}=await load(ctx);
  if(['writing.create','publish.copy','publish.register'].includes(step.action)) {
    let file=ctx.app.vault.getAbstractFileByPath(step.path);
    if(step.action!=='publish.register'){await ctx.target(step.path);file=await ctx.app.vault.create(step.path,noteBytes(step.expected.properties!,step.expected.body!));}
    else await ctx.app.vault.process(file,(current:string)=>{
      const original=splitNote(current);
      if(fingerprint(original)!==fingerprint({properties:step.data.originalProperties,body:step.data.originalBody}))throw new CosmosError('REVIEW_STALE','登记来源变化。');
      return noteBytes(step.expected.properties!,step.expected.body!);
    });
    const id=await service.register(file,step.expected.properties,await ctx.app.vault.read(file));return {id,path:file.path};
  }
  if(step.action==='publish.upload') {
    const before=(await service.manifest()).transactions.map((t:any)=>t.id);
    try{return {batch:await service.publish(step.data.preview)};}
    catch(error){const batches=(await service.manifest()).transactions.filter((t:any)=>!before.includes(t.id));if(batches.length===1)return {batch:batches[0],pending:true,error:error instanceof Error?error.message:String(error)};throw error;}
  }
  if(step.action==='publish.resume') {await service.resume();return {batch:(await service.manifest()).transactions.find((t:any)=>t.id===step.data.batch)};}
  if(step.action==='publish.refresh') {const results=await service.refreshRemote();return {batch:(await service.manifest()).transactions.find((t:any)=>t.id===step.data.batch),results};}
  if(step.action==='publish.withdraw')return {batch:await service.withdraw(step.data.id,step.data.preview)};
  throw new CosmosError('CAPABILITY_MISSING','发布动作未登记。');
}
async function reader(ctx:Context) {
  const {modules,contract}=await load(ctx),plugin=ctx.app.plugins.plugins['obsidian-mkdocs-publisher'];
  if(plugin?.manifest?.version!=='7.8.2'||plugin.__amytisBridgeVersion!==1)throw new CosmosError('CAPABILITY_MISSING','需要受控 Enveloppe 客户端。',{},3);
  const client=await plugin.reloadOctokit();
  const request=async(route:string,params:any)=>{if(!route.startsWith('GET '))throw new CosmosError('CAPABILITY_MISSING','复检仅允许远端读取。');return client.__amytisOwnedRequest(route,params);};
  const api=modules.transport({request,save:async()=>{},contract:contract.sourceBlobs,parseYaml:parse,decode:(v:string)=>Buffer.from(v,'base64').toString('utf8'),fetchPage:async(url:string)=>{const r=await fetch(url+'?amytis_verify='+Date.now(),{signal:AbortSignal.timeout(20000)});return {status:r.status,text:await r.text()};}});
  return {api,request};
}
export async function verifyPublication(ctx:Context,step:Step,observed?:any) {
  const {service}=await load(ctx),manifest=await service.manifest();
  if(['writing.create','publish.register','publish.copy'].includes(step.action)) {
    const {verifyEntity}=await import('./entities.js');const local=await verifyEntity(ctx,step);
    const id=step.expected.properties!.site_id;return {...local,verified:local.verified&&manifest.entries[id]?.sourcePath===step.path};
  }
  const batch=observed?.batch??manifest.transactions.find((t:any)=>t.id===step.data.batch);
  if(!batch)return {verified:false,differences:['没有持久化批次，远端结果不确定。']};
  const stored=manifest.transactions.find((t:any)=>t.id===batch.id);
  if(!stored||stored.commit!==batch.commit)return {verified:false,differences:['批次身份不匹配。']};
  const {api,request}=await reader(ctx);
  const ref=(await request('GET /repos/{owner}/{repo}/git/ref/{ref}',{owner:'Self-Command',repo:'amytis',ref:'heads/'+batch.branch})).data;
  if(ref.object.sha!==batch.commit)return {verified:false,differences:['远端发布分支版本变化。']};
  const remote=await api.refresh(structuredClone(stored),structuredClone(manifest));
  const accepted=step.action==='publish.refresh'?['live','withdrawn'].includes(remote.state):true;
  return {verified:accepted,differences:accepted?[]:[remote.reason??remote.state],publication:{batch:batch.id,commit:batch.commit,prUrl:stored.prUrl,state:remote.state,deployment:remote.run,reason:remote.reason,urls:stored.artifacts.map((a:any)=>a.url)}};
}
export async function queryPublication(ctx:Context) {
  const {service}=await load(ctx);return {manifest:await service.manifest(),candidates:(await service.records()).filter((r:any)=>r.fm.site_target==='amytis').map((r:any)=>({path:r.path,id:r.fm.site_id,language:r.fm.site_locale??'zh',title:r.fm.title,permission:r.fm.publish,kind:r.fm.site_kind,scope:r.fm.site_body}))};
}
