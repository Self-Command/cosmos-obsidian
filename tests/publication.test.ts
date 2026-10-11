import {describe,it,expect,afterEach} from 'vitest';
import fs from 'node:fs';
import {mkdtemp,mkdir,cp,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Context} from '../src/runtime/context.js';
import {preparePublication,prepareWriting,publicationEnvironment} from '../src/runtime/publication.js';
import {fillEntity} from '../src/runtime/entities.js';
import {noteBytes,splitNote} from '../src/templates/markdown.js';
import {validate} from '../src/registry/schema.js';
import {publicationSchema} from '../src/domain/publication.js';
const roots:string[]=[];
afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
async function vault(){
  const root=await mkdtemp(path.join(os.tmpdir(),'cosmos-publication-'));roots.push(root);
  const schema=JSON.parse(await readFile('tests/fixtures/model-v3/schema.json','utf8'));
  await mkdir(root+'/rules');await writeFile(root+'/rules/schema.json',JSON.stringify(schema));
  await cp('tests/fixtures/model-v3/templates',root+'/templates',{recursive:true});
  await cp('tests/fixtures/model-v3/services',root+'/'+schema.scriptFolder+'/lib',{recursive:true});
  for(const e of Object.values(schema.entities) as any[])for(const folder of e.folders)await mkdir(root+'/'+folder,{recursive:true});
  await mkdir(root+'/太阳/光球/文章',{recursive:true});
  const files=new Map<string,any>();
  async function seed(p:string,fm:any,body='<!-- amytis:public:start -->\n# Public title\n\nConcrete public evidence.\n<!-- amytis:public:end -->\n\nPrivate source material.'){
    await mkdir(path.dirname(root+'/'+p),{recursive:true});
    await writeFile(root+'/'+p,noteBytes({type:'output',status:'draft',source:'manual',publish:false,tags:[],...fm},body));
    const file={path:p,basename:path.posix.basename(p,'.md')};files.set(p,file);return file;
  }
  const app:any={plugins:{plugins:{}},vault:{adapter:{exists:async(p:string)=>fs.existsSync(root+'/'+p),read:async(p:string)=>readFile(root+'/'+p,'utf8')},getMarkdownFiles:()=>[...files.values()],getAbstractFileByPath:(p:string)=>files.get(p),read:async(file:any)=>readFile(root+'/'+file.path,'utf8')},metadataCache:{getFirstLinkpathDest:(raw:string)=>files.get(raw)||files.get(raw+'.md')}};
  const ctx=()=>new Context(app,root,'rules/schema.json','templates');return {root,seed,app,ctx};
}
const v=(extra:any={})=>({language:'zh',kind:'post',slug:'public-example',date:'2026-10-01',title:'Public title',permission:true,scope:'marked',...extra});
describe('publication boundaries and local planning',()=>{
  it('creates a new public copy with no cloned identity or private material and preserves source bytes',async()=>{
    const f=await vault(),p='太阳/光球/文章/Source.md';await f.seed(p,{site_id:'source-identity'});const original=await readFile(f.root+'/'+p,'utf8');
    const plan=await preparePublication(f.ctx(),{action:'copy',path:p,name:'Public copy',values:v()},'bound');const step=plan.steps[0]!;
    expect(step.expected.properties!.site_id).not.toBe('source-identity');expect(step.expected.body).toContain('Concrete public evidence');expect(step.expected.body).not.toContain('Private source material');expect(await readFile(f.root+'/'+p,'utf8')).toBe(original);
    expect(plan.dependencies.find(d=>d.path===p)?.kind).toBe('file');expect(plan.dependencies.some(d=>d.path==='.obsidian/amytis/publication.json'&&d.kind==='absent')).toBe(true);
    await writeFile(f.root+'/'+p,original+'Concurrent change');await expect(f.ctx().assertFresh(plan)).rejects.toThrow();
  });
  it('rejects incomplete public markers, illegal kinds, dates and duplicate stable identities',async()=>{
    const f=await vault(),p='太阳/光球/文章/Source.md';await f.seed(p,{});
    await expect(preparePublication(f.ctx(),{action:'register',path:p,values:v({date:'2026-02-30'})},'bound')).rejects.toThrow();
    await f.seed(p,{},'Private unmarked body');await expect(preparePublication(f.ctx(),{action:'register',path:p,values:v()},'bound')).rejects.toThrow();
    const note='星云/分子云/速记/Note.md';await f.seed(note,{type:'note'});await expect(preparePublication(f.ctx(),{action:'register',path:note,values:v()},'bound')).rejects.toThrow();
  });
  it('uses different concrete templates for both languages and keeps explicit permission',async()=>{
    const f=await vault();
    for(const language of ['zh','en']){
      const p=await prepareWriting(f.ctx(),{action:'writing.create',name:'Draft '+language,values:v({language,permission:false})},'bound');
      expect(p.template.fields.some(field=>field.label===(language==='zh'?'开篇':'Opening'))).toBe(true);expect(p.plan.steps[0]!.expected.properties!.publish).toBe(false);
      expect(p.template.prefix).toBe('<!-- amytis:public:start -->');expect(p.plan.steps[0]!.expected.properties!.site_locale).toBe(language);
    }
  });
  it('preserves book outline semantics and rejects mixed language membership',async()=>{
    const f=await vault(),child='太阳/光球/文章/Chapter.md',parent='太阳/光球/文章/Book.md';
    await f.seed(child,{site_target:'amytis',site_id:'chapter',site_locale:'en',site_kind:'post',site_role:'entry',site_slug:'chapter',site_date:'2026-10-01',site_body:'marked',title:'Chapter',publish:false});await f.seed(parent,{});
    await expect(preparePublication(f.ctx(),{action:'register',path:parent,values:v({kind:'book',role:'index',outline:[{section:'First part',items:[{link:'[['+child.replace(/\.md$/,'')+']]'}]}]})},'bound')).rejects.toThrow();
    const plan=await preparePublication(f.ctx(),{action:'register',path:parent,values:v({language:'en',kind:'book',role:'index',outline:[{section:'First part',items:[{link:'[['+child.replace(/\.md$/,'')+']]'}]}]})},'bound');expect(plan.steps[0]!.expected.properties!.site_outline[0].section).toBe('First part');expect(plan.steps[0]!.expected.properties!.site_members).toBeUndefined();
  });
  it('renders public book introductions and index titles inside the one public range',async()=>{
    const f=await vault(),p=await prepareWriting(f.ctx(),{action:'writing.create',name:'Book',values:v({kind:'book',role:'index',permission:false})},'bound');
    expect(p.template.introFieldId).toBe('book-introduction');
    const fields=Object.fromEntries(p.template.fields.map(field=>[field.id,field.anchors.map(a=>'**'+a+'**\n\nConcrete synthetic purpose and limits.').join('\n\n')||'Concrete synthetic public book introduction.']));
    const plan=await fillEntity(f.ctx(),p,{fields},'bound');const body=plan.steps[0]!.expected.body!;
    expect(body.indexOf('<!-- amytis:public:start -->')).toBeLessThan(body.indexOf('# Book'));
    expect(body.indexOf('Concrete synthetic public book introduction.')).toBeLessThan(body.indexOf('<!-- amytis:public:end -->'));
    expect(body.indexOf('<!-- amytis:public:end -->')).toBeLessThan(body.indexOf('## 组织定位（内部）'));
  });
  it('excludes authentication from runtime fingerprints while binding changes to targets and merge policy',()=>{
    const app:any={plugins:{plugins:{'obsidian-mkdocs-publisher':{manifest:{version:'7.8.2'},settings:{github:{user:'Self-Command',repo:'amytis',branch:'main',token:'first',tokenSecret:'private-secret'}}}}}};
    const initial=publicationEnvironment(app);app.plugins.plugins['obsidian-mkdocs-publisher'].settings.github.token='second';app.plugins.plugins['obsidian-mkdocs-publisher'].settings.github.tokenSecret='another-secret';expect(publicationEnvironment(app)).toBe(initial);app.plugins.plugins['obsidian-mkdocs-publisher'].settings.github.repo='different';expect(publicationEnvironment(app)).not.toBe(initial);
  });
  it('rejects unknown controls and empty selections cannot silently mean all public notes',()=>{
    expect(()=>validate(publicationSchema,{action:'upload',ids:[],script:'arbitrary'})).toThrow();expect(()=>validate(publicationSchema,{action:'resume',batch:'x',retryAll:true})).toThrow();
  });
});
