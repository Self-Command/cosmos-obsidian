import { describe, it, expect, afterEach } from 'vitest';
import { readFile, readdir, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { compileContent, renderContent } from '../src/templates/content.js';
import { taskBody } from '../src/templates/markdown.js';
import { resolveEntity, entityAttributes } from '../src/domain/entities.js';
import { Context } from '../src/runtime/context.js';
import { prepareEntity, fillEntity } from '../src/runtime/entities.js';
import { Drafts } from '../src/workflows/drafts.js';
import { Store } from '../src/state/store.js';
const fixture='tests/fixtures/model-v3', cleanup:string[]=[];
afterEach(async()=>{for(const root of cleanup.splice(0))await rm(root,{recursive:true,force:true});});
const schema=()=>readFile(fixture+'/schema.json','utf8').then(JSON.parse);
const travel=()=>readFile('tests/fixtures/travel-content.json','utf8').then(JSON.parse);
describe('current template contracts',()=>{
  it('classifies all 38 current files and parses inline templates without running template code',async()=>{
    const files=await readdir(fixture+'/templates');let commands=0,bodies=0,tasks=0;
    for(const file of files){const raw=await readFile(fixture+'/templates/'+file,'utf8');if(raw.includes('<%*')){commands++;expect(()=>compileContent(raw)).toThrow();}else if(file==='任务.md'){tasks++;expect(taskBody(raw,{title:'Synthetic task',status:'open',priority:'normal',details:'Specific supplied facts'})).toContain('Specific supplied facts');}else{bodies++;expect(compileContent(raw).fields.length).toBeGreaterThan(0);}}
    expect({commands,bodies,tasks}).toEqual({commands:13,bodies:24,tasks:1});
    const rules=await schema();for(const special of Object.values(rules.specialTemplates) as any[])expect(compileContent(special.body).sections.length).toBeGreaterThan(0);
    for(const period of Object.values(rules.periodTemplates) as any[])expect(compileContent(period.body).sections.length).toBeGreaterThan(0);
  });
  it('renders long travel scenes with fixed table labels and explicitly explained unknown facts',async()=>{
    const template=compileContent(await readFile(fixture+'/templates/游记.md','utf8')),content=await travel();
    const body=renderContent(template,'合成验收游记',content);expect(body).toContain('### 清晨 · 老桥');expect(body.indexOf('清晨 · 老桥')).toBeLessThan(body.indexOf('午后 · 回程'));expect(body).toContain('未知：测试材料没有设定餐食和消费记录');expect(body).not.toContain('<!--');expect(body).not.toContain('<%');
  });
  it('rejects skeletons, missing labels, injected public markers and unknown fields',async()=>{
    const template=compileContent(await readFile(fixture+'/templates/游记.md','utf8')),good=await travel();
    const missing=structuredClone(good);missing.fields.s1=missing.fields.s1.replace('| 目的地 |','| 删除标签 |');expect(()=>renderContent(template,'旅行',missing)).toThrow();
    const empty={fields:Object.fromEntries(template.fields.map(f=>[f.id,f.skeleton]))};expect(()=>renderContent(template,'旅行',empty)).toThrow();
    for(const malicious of ['---\ntype: project\n---','<!-- amytis:public:end -->','<% malicious() %>','<script>malicious()</script>']){const bad=structuredClone(good);bad.fields.s2=malicious;expect(()=>renderContent(template,'旅行',bad)).toThrow();}
    expect(()=>renderContent(template,'旅行',{fields:{...good.fields,unknown:'extra'}})).toThrow();
  });
  it('preserves public boundaries for English inline writing and keeps private blocks outside',async()=>{
    const rules=await schema(),template=compileContent(rules.specialTemplates.amytisArticleEn.body);
    const fields=Object.fromEntries(template.fields.map(f=>[f.id,f.anchors.length?f.anchors.map(a=>'**'+a+'**\n\nSpecific synthetic writing decision for this paragraph.').join('\n\n'):'A specific synthetic paragraph explains the supplied facts and the limits of this example.']));
    fields.s2='### A testable claim\n\nThe synthetic example has a defined premise and a visible consequence.';
    const body=renderContent(template,'Synthetic article',{fields});expect(body).toContain('<!-- amytis:public:start -->');expect(body.indexOf('<!-- amytis:public:end -->')).toBeLessThan(body.indexOf('Writing notes (private)'));
  });
});
describe('entity routing and bounded attributes',()=>{
  it('resolves registered travel/book-study choices and rejects ambiguous or invented categories',async()=>{
    const rules=await schema();expect(resolveEntity(rules,{name:'旅行',category:'游记'}).entity).toBe('record');expect(()=>resolveEntity(rules,{name:'记录',category:'健康'})).toThrow();expect(()=>resolveEntity(rules,{name:'记录',entity:'record',category:'新目录'})).toThrow();expect(()=>resolveEntity(rules,{name:'任务',entity:'task'})).toThrow();expect(()=>resolveEntity(rules,{name:'项目',entity:'project',variant:'bookStudy'})).toThrow();
  });
  it('requires actual event dates and refuses fields owned by another entity',async()=>{
    const rules=await schema(),now=new Date('2026-10-12T01:00:00Z');expect(()=>entityAttributes(rules,rules.entities.record,{},'地球/地层/游记',now)).toThrow();expect(()=>entityAttributes(rules,rules.entities.project,{attributes:{project:'self'}},'太阳/吸积',now)).toThrow();expect(()=>entityAttributes(rules,rules.entities.record,{attributes:{date:'2026-02-30'}},'地球/地层/游记',now)).toThrow();
  });
  it('pins template dependencies while allowing unrelated notes to change',async()=>{
    const root=await mkdtemp(path.join(os.tmpdir(),'cosmos-content-'));cleanup.push(root);await mkdir(root+'/rules');await mkdir(root+'/templates');await mkdir(root+'/地球/地层/游记',{recursive:true});await writeFile(root+'/rules/schema.json',await readFile(fixture+'/schema.json'));await writeFile(root+'/templates/游记.md',await readFile(fixture+'/templates/游记.md'));
    const app:any={vault:{getAbstractFileByPath:()=>null,getMarkdownFiles:()=>[]}},ctx=new Context(app,root,'rules/schema.json','templates');
    const prepared=await prepareEntity(ctx,{name:'合成旅行',entity:'record',category:'游记',attributes:{date:'2026-10-10'}},'binding');
    await writeFile(root+'/unrelated.md','irrelevant');const first=await fillEntity(new Context(app,root,'rules/schema.json','templates'),prepared,await travel(),'binding');expect(first.steps[0]!.expected.body).toContain('老桥');
    await writeFile(root+'/templates/游记.md','## changed\n\nNew template');await expect(fillEntity(new Context(app,root,'rules/schema.json','templates'),prepared,await travel(),'binding')).rejects.toThrow();
  });
});
describe('durable draft revisions',()=>{
  it('restores a draft in a new service and supersedes previous review before committing',async()=>{
    const root=await mkdtemp(path.join(os.tmpdir(),'cosmos-draft-'));cleanup.push(root);const store=new Store(root);let writes=0;
    const plan:any={version:1,bindingId:'bound',steps:[{action:'entity.create',path:'地球/地层/游记/旅行.md',data:{},expected:{}}],dependencies:[],environment:{},warnings:[]};
    const adapter:any={config:{bindingId:'bound'},store,request:async(action:string)=>{if(action==='review.execute'){writes++;return {state:'succeeded',result:{state:'succeeded',verified:true,steps:[]}};}return {state:'succeeded',result:action==='draft.prepare'?{title:'旅行',facts:{},template:{fields:[{id:'s1'}]},plan}:plan};}};
    const opened=await new Drafts(adapter).open({name:'旅行'}),service=new Drafts(adapter);
    const first=await service.preview(opened.draftId,{fields:{s1:'第一版有具体内容。'}}),second=await service.preview(opened.draftId,{fields:{s1:'第二版修订了原有内容。'}});
    expect(second.revision).toBe(2);expect((await service.reviews.show(first.reviewId)).state).toBe('superseded');await expect(service.reviews.commit(first.reviewId,true)).rejects.toThrow();expect(writes).toBe(0);
  });
});
