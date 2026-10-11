import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const binding=JSON.parse(await readFile(process.env.COSMOS_CONFIG,'utf8')),schema=JSON.parse(await readFile('tests/fixtures/model-v3/schema.json','utf8')),results=[];
const cli=(args,input)=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,['dist/cosmos.mjs',...args],{shell:false,windowsHide:true});let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.on('error',reject);child.on('close',code=>{try{resolve({code,...JSON.parse(out)});}catch{reject(Error(out+err));}});child.stdin.end(input===undefined?'':JSON.stringify(input));});
const commit=async(review)=>{assert.equal(review.state,'review-ready',JSON.stringify(review));const result=await cli(['review','commit','--review',review.reviewId,'--confirm']);assert.equal(result.state,'succeeded',JSON.stringify(result));assert.equal(result.verified,true);return result;};
function fixtureContent(contract){return {fields:Object.fromEntries(contract.fields.map(field=>{
  const pieces=[];if(field.repeat)pieces.push('### 合成测试中的具体片段');
  for(const table of field.tables){const rows=table.labels.length?table.labels:['合成测试条件'];pieces.push('| '+table.header.join(' | ')+' |\n| '+table.header.map(()=> '---').join(' | ')+' |\n'+rows.map(label=>'| '+[label,...table.header.slice(1).map(()=> '用户指定的合成材料，未提供信息已明确标注为未知')].join(' | ')+' |').join('\n'));}
  for(const anchor of field.anchors)pieces.push('**'+anchor+'**\n\n合成测试材料说明了此项的具体背景、观察范围和未知原因，不代表真实用户经历。');
  pieces.push(...field.fixed);if(!field.anchors.length&&!field.tables.length)pieces.push('这份合成材料包含明确的背景、行动和判断边界；未给出的细节不补造。');return [field.id,pieces.join('\n\n')];}))};}
const names={};
for(const [entity,definition] of Object.entries(schema.entities)){
  if(['task','journal'].includes(entity))continue;
  const title='实体覆盖-'+entity,notePath=definition.folder+'/'+title+'.md';names[entity]=notePath;
  const opened=await cli(['draft','open','--input','-'],{entity,name:title,...(entity==='record'?{attributes:{date:'2026-10-10'}}:{})});assert.equal(opened.state,'needs-content',JSON.stringify(opened));await commit(await cli(['draft','preview','--draft',opened.draftId,'--input','-'],fixtureContent(opened.contentContract)));
  const observed=await cli(['query','notes','--input','-'],{path:notePath});assert.equal(observed.notes[0].properties.type,entity);assert.deepEqual(observed.notes[0].issues,[]);results.push({case:'native-create-'+entity,passed:true});
}
// One immutable plan creates a project and a TaskNotes task referring to that planned project.
const projectDraft=await cli(['draft','open','--input','-'],{entity:'project',name:'统一方案项目'});assert.equal(projectDraft.state,'needs-content');
const combined=await cli(['change','preview','--input','-'],{actions:[{action:'entity.create',entity:'project',name:'统一方案项目',content:fixtureContent(projectDraft.contentContract)},{action:'task.create',title:'统一方案关联任务',relations:{project:'统一方案项目'},details:'只使用合成项目作为所属项目。'}]});assert.equal(combined.summary?.changes?.length,2,JSON.stringify(combined));await commit(combined);
const linkedTask=await cli(['query','tasks','--input','-'],{title:'统一方案关联任务'});assert.deepEqual(linkedTask.tasks[0].projects,['[[太阳/吸积/统一方案项目]]']);results.push({case:'native-multiple-files/project-task-relations',passed:true});
// Registered transitions use the actual preserved vault service.
for(const transition of ['idea','project','question','record']){
  const title='推进来源-'+transition,opened=await cli(['draft','open','--input','-'],{entity:'note',name:title});await commit(await cli(['draft','preview','--draft',opened.draftId,'--input','-'],fixtureContent(opened.contentContract)));
  const source='星云/分子云/速记/'+title+'.md',evolution=await cli(['draft','open','--input','-'],{action:'entity.evolve',path:source,transition,...(transition==='record'?{attributes:{date:'2026-10-09'}}:{})});assert.equal(evolution.state,'needs-content',JSON.stringify(evolution));
  const review=await cli(['draft','preview','--draft',evolution.draftId,'--input','-'],fixtureContent(evolution.contentContract));const target=review.summary.changes[0].path;await commit(review);await assert.rejects(readFile(path.join(binding.vaultPath,source)));const body=await readFile(path.join(binding.vaultPath,target),'utf8');assert.ok(body.indexOf('## 内容')<body.indexOf(transition==='idea'?'## 创造意图':transition==='project'?'## 目标':transition==='question'?'## 我真正想回答什么':'## 发生了什么'));results.push({case:'native-evolve-'+transition+'/original-order',passed:true});
}
for(const [transition,sourceType] of [['study','resource'],['knowledge','study'],['validation','knowledge'],['output','project']]){
  const source=names[sourceType],opened=await cli(['draft','open','--input','-'],{action:'entity.evolve',path:source,transition,name:'关联创建-'+transition});assert.equal(opened.state,'needs-content',JSON.stringify(opened));const review=await cli(['draft','preview','--draft',opened.draftId,'--input','-'],fixtureContent(opened.contentContract));await commit(review);assert.ok((await readFile(path.join(binding.vaultPath,review.summary.changes[0].path),'utf8')).includes('[['+source.replace(/\.md$/,'')+']]'));assert.ok(await readFile(path.join(binding.vaultPath,source)));results.push({case:'native-linked-'+transition+'/retained-source',passed:true});
}
await commit(await cli(['change','preview','--input','-'],{actions:[{action:'entity.evolve',path:names.note,transition:'repair-body'}]}));results.push({case:'native-repair-no-reordering',passed:true});
const past='2023-10-01';await commit(await cli(['change','preview','--input','-'],{actions:[{action:'entity.evolve',path:names.output,transition:'published',evidence:{url:'https://example.invalid/synthetic-published-result',publishedDate:past,description:'Explicitly synthetic external publication evidence for this isolated fixture.'}}]}));
await commit(await cli(['change','preview','--input','-'],{actions:[{action:'entity.evolve',path:names.output,transition:'archive'}]}));await assert.rejects(readFile(path.join(binding.vaultPath,names.output)));assert.ok(await readFile(path.join(binding.vaultPath,'黑洞/事件视界/成果/'+path.posix.basename(names.output))));results.push({case:'native-published/archive-seven-days',passed:true});
for(const period of ['day','week','month','quarter','year']){
  const opened=await cli(['draft','open','--input','-'],{action:'journal.create',period,date:'2023-12-27'});assert.equal(opened.state,'needs-content',JSON.stringify(opened));const review=await cli(['draft','preview','--draft',opened.draftId,'--input','-'],fixtureContent(opened.contentContract));await commit(review);const target=review.summary.changes[0].path,observed=await cli(['query','notes','--input','-'],{path:target});assert.equal(observed.notes[0].properties.type,'journal');assert.equal(observed.notes[0].properties.period,period);assert.ok(target.includes('2023'));results.push({case:'native-historical-period-'+period,path:target,passed:true});
}
const note=names.record,original=await readFile(path.join(binding.vaultPath,note),'utf8');const exact='不代表真实用户经历。';
// A unique phrase gives bounded body editing independent of template skeleton rendering.
const match='## 发生了什么';await commit(await cli(['change','preview','--input','-'],{actions:[{action:'content.patch',path:note,find:match,replace:'## 发生了什么（已授权补充）'}]}));
const relationPreview=await cli(['change','preview','--input','-'],{actions:[{action:'relations.patch',path:note,relations:{area:'实体覆盖-area',project:'统一方案项目'}}]});await commit(relationPreview);
const renamed=await cli(['change','preview','--input','-'],{actions:[{action:'file.rename',path:note,name:'已改名合成记录'}]});await commit(renamed);const renamedPath=renamed.summary.changes[0].path;
const moved=await cli(['change','preview','--input','-'],{actions:[{action:'file.move',path:renamedPath,folder:'地球/地层/交流'}]});await commit(moved);const movedPath=moved.summary.changes[0].path;assert.ok((await readFile(path.join(binding.vaultPath,movedPath),'utf8')).includes('## 发生了什么（已授权补充）'));
const invalid=await cli(['change','preview','--input','-'],{actions:[{action:'file.move',path:movedPath,folder:'月亮/满月'}]});assert.equal(invalid.error.code,'INVALID_DIRECTORY');
await commit(await cli(['change','preview','--input','-'],{actions:[{action:'file.recycle',path:movedPath}]}));await assert.rejects(readFile(path.join(binding.vaultPath,movedPath)));results.push({case:'native-body/relations/rename/move/recycle/boundaries',passed:true});
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/native-business.json',JSON.stringify({sourceSha:process.env.GITHUB_SHA,results},null,2));console.log(JSON.stringify({nativeBusinessCases:results.length}));
