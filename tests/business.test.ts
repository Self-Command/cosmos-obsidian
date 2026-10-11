import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import { mkdtemp, mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Context } from '../src/runtime/context.js';
import { prepareEvolution } from '../src/runtime/lifecycle.js';
import { prepareFileChange } from '../src/runtime/files.js';
import { prepareChanges } from '../src/runtime/business.js';
import { fillEntity } from '../src/runtime/entities.js';
import { noteBytes, splitNote } from '../src/templates/markdown.js';
const cleanup:string[]=[];
afterEach(async()=>{for(const root of cleanup.splice(0))await rm(root,{recursive:true,force:true});});
async function vault() {
  const root=await mkdtemp(path.join(os.tmpdir(),'cosmos-business-'));cleanup.push(root);const schema=JSON.parse(await readFile('tests/fixtures/model-v3/schema.json','utf8'));
  await mkdir(root+'/rules');await writeFile(root+'/rules/schema.json',JSON.stringify(schema));await cp('tests/fixtures/model-v3/templates',root+'/templates',{recursive:true});await mkdir(root+'/'+schema.scriptFolder+'/lib',{recursive:true});await cp('tests/fixtures/model-v3/services/system-engine.cjs',root+'/'+schema.scriptFolder+'/lib/system-engine.cjs');
  for(const entity of Object.values(schema.entities) as any[])for(const folder of entity.folders)await mkdir(root+'/'+folder,{recursive:true});
  for(const category of Object.values(schema.archiveCategories))await mkdir(root+'/'+schema.archiveFolder+'/'+category,{recursive:true});
  const files=new Map<string,any>();
  async function seed(relative:string,type:string,body='原文第一段。\n\n原文第二段。',extra:any={}) {
    const entity=schema.entities[type],properties={type,status:entity.defaultStatus,source:'manual',format:'note',publish:false,tags:[],project:[],area:'',route:path.posix.dirname(relative),created:'2026-10-01T00:00:00Z',updated:'2026-10-01T00:00:00Z',...extra};await mkdir(path.dirname(root+'/'+relative),{recursive:true});await writeFile(root+'/'+relative,noteBytes(properties,body));const file={path:relative,name:path.posix.basename(relative),basename:path.posix.basename(relative,'.md'),extension:'md',parent:{path:path.posix.dirname(relative)}};files.set(relative,file);return file;
  }
  const app:any={vault:{getAbstractFileByPath:(p:string)=>files.get(p)??(fs.existsSync(root+'/'+p)&&fs.statSync(root+'/'+p).isDirectory()?{path:p}:null),getMarkdownFiles:()=>[...files.values()]},metadataCache:{getFileCache:(f:any)=>({frontmatter:splitNote(fs.readFileSync(root+'/'+f.path,'utf8')).properties})}};
  return {root,schema,app,seed,ctx:()=>new Context(app,root,'rules/schema.json','templates')};
}
const description=(field:any)=>{
  if(field.tables.length)return field.skeleton; // A deliberately incomplete fixture, used only for refusal tests.
  return field.anchors.length?field.anchors.map((a:string)=>'**'+a+'**\n\n用户提供的合成测试事实解释了这项判断的条件和原因。').join('\n\n'):'用户提供的合成测试事实解释了这项判断的条件和原因。';
};
describe('native service lifecycle contract planning',()=>{
  it('keeps original paragraph order and appends only missing later-stage structures',async()=>{
    const v=await vault();await v.seed('星云/分子云/速记/原始想法.md','note','原文第一段。\n\n## 预期结果\n\n已有预期段落。\n\n原文最后一段。');
    const prepared=await prepareEvolution(v.ctx(),{action:'entity.evolve',path:'星云/分子云/速记/原始想法.md',transition:'idea'},'bound');
    expect(prepared.appendTo).toContain('原文最后一段');expect(prepared.template.fields.some(f=>f.label==='预期结果')).toBe(false);expect(prepared.plan.steps[0]!.path).toBe('太阳/原恒星/构想/原始想法.md');
    expect(prepared.plan.dependencies.some(d=>d.path.endsWith('system-engine.cjs'))).toBe(true);
    await expect(prepareEvolution(v.ctx(),{action:'entity.evolve',path:'星云/分子云/速记/原始想法.md',transition:'knowledge'},'bound')).rejects.toThrow();
  });
  it('creates a separate linked knowledge note and retains its study source',async()=>{
    const v=await vault();await v.seed('月亮/上弦/阅读/合成研读.md','study');
    const prepared=await prepareEvolution(v.ctx(),{action:'entity.evolve',path:'月亮/上弦/阅读/合成研读.md',transition:'knowledge',name:'合成认知'},'bound');
    expect(prepared.plan.steps[0]!.source).toBe('月亮/上弦/阅读/合成研读.md');expect(prepared.plan.steps[0]!.expected.sourceAbsent).not.toBe(true);expect(prepared.suffix).toContain('[[月亮/上弦/阅读/合成研读]]');expect(fs.existsSync(v.root+'/月亮/上弦/阅读/合成研读.md')).toBe(true);
  });
  it('uses explicit terminal dates and the seven-day window instead of updated timestamps',async()=>{
    const v=await vault(),past=new Date(Date.now()-8*86400000).toISOString(),recent=new Date(Date.now()-6*86400000).toISOString();
    await v.seed('太阳/光球/成果合成.md','output','交付内容',{status:'published',publish:true,publishedDate:past,updated:new Date().toISOString()});
    const prepared=await prepareEvolution(v.ctx(),{action:'entity.evolve',path:'太阳/光球/成果合成.md',transition:'archive'},'bound');expect(prepared.plan.steps[0]!.path).toBe('黑洞/事件视界/成果/成果合成.md');
    await v.seed('太阳/光球/近期成果.md','output','交付内容',{status:'published',publish:true,publishedDate:recent,updated:'2020-01-01T00:00:00Z'});await expect(prepareEvolution(v.ctx(),{action:'entity.evolve',path:'太阳/光球/近期成果.md',transition:'archive'},'bound')).rejects.toThrow();
    await v.seed('太阳/光球/缺少日期.md','output','交付内容',{status:'published',publish:true});await expect(prepareEvolution(v.ctx(),{action:'entity.evolve',path:'太阳/光球/缺少日期.md',transition:'archive'},'bound')).rejects.toThrow();
  });
  it('requires actual event dates and publication evidence before changing lifecycle state',async()=>{
    const v=await vault();await v.seed('星云/分子云/速记/事件.md','note');await expect(prepareEvolution(v.ctx(),{action:'entity.evolve',path:'星云/分子云/速记/事件.md',transition:'record'},'bound')).rejects.toThrow();await v.seed('太阳/光球/尚未发布.md','output');await expect(prepareEvolution(v.ctx(),{action:'entity.evolve',path:'太阳/光球/尚未发布.md',transition:'published'},'bound')).rejects.toThrow();
  });
});
describe('bounded file changes',()=>{
  it('requires unique body matches and preserves the actual property set',async()=>{
    const v=await vault();await v.seed('星云/分子云/速记/正文.md','note','第一段用户原文。\n\n第二段用户原文。');const step=await prepareFileChange(v.ctx(),{action:'content.patch',path:'星云/分子云/速记/正文.md',find:'第二段用户原文。',replace:'用户明确授权修改后的第二段。'});expect(step.expected.body).toBe('第一段用户原文。\n\n用户明确授权修改后的第二段。');expect(step.expected.properties!.type).toBe('note');
    await expect(prepareFileChange(v.ctx(),{action:'content.patch',path:'星云/分子云/速记/正文.md',find:'用户原文',replace:'replace'})).rejects.toThrow();
  });
  it('refuses cross-stage moves, overwrites and relationship fields owned by another entity',async()=>{
    const v=await vault();await v.seed('星云/分子云/速记/来源.md','note');await v.seed('星云/分子云/速记/冲突.md','note');await expect(prepareFileChange(v.ctx(),{action:'file.rename',path:'星云/分子云/速记/来源.md',name:'冲突'})).rejects.toThrow();await expect(prepareFileChange(v.ctx(),{action:'file.move',path:'星云/分子云/速记/来源.md',folder:'太阳/吸积'})).rejects.toThrow();await expect(prepareFileChange(v.ctx(),{action:'relations.patch',path:'星云/分子云/速记/来源.md',relations:{project:'不存在'}})).rejects.toThrow();
  });
});
