import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const exec=promisify(execFile),hash=value=>createHash('sha256').update(value).digest('hex');
export const evidenceDependencies=['src','tests/fixtures','tools/behavior','tools/native','tools/build.mjs','tools/verify-package.mjs','package.json','package-lock.json','tsconfig.json','AGENTS.md'];
export function scopedController(source){const match=source.match(/row\.controllerTimeoutMs=planningPhase\?(\d+):(\d+);/);assert.ok(match,'Missing bounded host controller');return {source:source.replace(match[0],'row.controllerTimeoutMs=planningPhase?PLANNING_WAIT:OTHER_WAIT;'),budgets:{planning:Number(match[1]),other:Number(match[2])}};}
export function scopedPreviewSelection(source){
  const before="    const fresh=(await states('reviews')).filter(r=>!old.includes(r.id)&&r.state==='review-ready');assert.equal(fresh.length,1,'One current immutable plan is required');\n    const review=fresh[0];assert.ok(row.answer.includes(review.id),'The user must receive the actual full preview link');";
  const after="    const fresh=(await states('reviews')).filter(r=>!old.includes(r.id)&&r.state==='review-ready'),presented=fresh.filter(r=>row.answer.includes(r.id));assert.equal(presented.length,1,'One user-presented immutable plan is required');\n    const review=presented[0];if(fresh.length>1)sample.diagnostics.push({phase,observation:'Preview revised before user approval',unpresentedReviewIds:fresh.filter(r=>r.id!==review.id).map(r=>r.id)});";
  if(source.includes(before))return {source:source.replace(before,'    const review=ONE_PRESENTED_IMMUTABLE_REVIEW;'),policy:'one-created'};
  if(source.includes(after))return {source:source.replace(after,'    const review=ONE_PRESENTED_IMMUTABLE_REVIEW;'),policy:'one-presented'};
  return {source,policy:'unchanged-source'};
}
export function scopedSkillSuite(source,skill){
  source=scopedPreviewSelection(source).source;
  const branches=[...source.matchAll(/^  (?:if|}else if)\(skill==='([^']+)'\)\{/gm)],selected=branches.findIndex(match=>match[1]===skill),sharedStart=source.indexOf('  // Selection is part of the skill contract.'),tail=sharedStart>=0?sharedStart:source.indexOf("  sample.results.push({case:scenario+'/skill-flow'");assert.ok(selected>=0&&tail>branches.at(-1).index,'Cannot isolate the exact skill scenario');
  return source.slice(0,branches[0].index)+source.slice(branches[selected].index,branches[selected+1]?.index??tail)+source.slice(tail);
}
export function assessSkillReuse(candidate,report,context){
  try{
    const previous=report.candidate,skill=report.case;
    assert.equal(report.sourceSha,previous.sourceSha);assert.equal(report.runId,previous.runId);assert.notEqual(previous.runId,candidate.runId);
    assert.equal(report.profile,'full');assert.equal(report.passed,true);assert.equal(report.model,'gpt-6-luna');assert.equal(report.effort,'xhigh');assert.equal(report.samples?.length,3);assert.ok(report.samples.every(s=>s.passed===true&&s.issues?.length===0));
    for(const key of ['version','protocol','node','skills'])assert.deepEqual(candidate[key],previous[key],'Package environment changed: '+key);
    assert.deepEqual(Object.keys(candidate.files).sort(),Object.keys(previous.files).sort(),'Package file set changed');
    if(candidate.files['dependencies.json']){
      const {before,after}=context.sbom;assert.equal(hash(JSON.stringify(before,null,2)),previous.files['dependencies.json']);assert.equal(hash(JSON.stringify(after,null,2)),candidate.files['dependencies.json']);assert.equal(before.sourceSha,previous.sourceSha);assert.equal(after.sourceSha,candidate.sourceSha);
      const {sourceSha:oldSha,...oldPackages}=before,{sourceSha:newSha,...newPackages}=after;assert.deepEqual(oldPackages,newPackages,'Dependency inventory changed');
    }
    const changed=[];
    for(const file of Object.keys(candidate.files))if(file!=='dependencies.json'&&candidate.files[file]!==previous.files[file]){assert.match(file,/^skills\/cosmos-[a-z]+\/SKILL\.md$/,'Runtime, entry or dependency bytes changed');changed.push(file.split('/')[1]);}
    assert.ok(!changed.includes(skill),'This skill changed');
    assert.deepEqual(Object.keys(context.trees).sort(),[...evidenceDependencies].sort(),'Missing scenario or native environment dependency');
    for(const [dependency,pair]of Object.entries(context.trees)){assert.match(pair.before,/^[a-f0-9]{40}$/);assert.equal(pair.before,pair.after,'Source or scenario changed: '+dependency);}
    if(context.hostWait){for(const phase of ['planning','other']){assert.ok(context.hostWait.before[phase]>0);assert.ok(context.hostWait.after[phase]>=context.hostWait.before[phase],'The host wait budget became shorter');}}
    if(context.previewSelection){const {before,after}=context.previewSelection;assert.ok(before===after||before==='one-created'&&after==='one-presented','Preview selection policy changed outside the exact compatible extension');}
    assert.deepEqual(Object.keys(context.discovery).sort(),[...candidate.skills].sort());
    for(const [name,pair]of Object.entries(context.discovery)){assert.match(pair.before,/^[a-f0-9]{64}$/);assert.equal(pair.before,pair.after,'Native discovery changed: '+name);}
    const turns=report.samples.flatMap(s=>s.turns),observed=JSON.stringify(turns.flatMap(t=>[(t.tools??[]).map(tool=>({name:tool.name,input:tool.input,command:tool.command})),t.nativeContextMessages??[]]));
    for(const name of changed){
      assert.ok(!observed.includes(name),'A changed skill was used in this scenario: '+name);
      // A help result may name a route without loading that skill. Discovery
      // metadata is already compared above; full skill text remains a dependency.
      const bodyHeader=new RegExp('(?:^|\\n)name: '+name+'(?:\\r?\\n)');
      assert.ok(!turns.some(t=>(t.tools??[]).some(tool=>bodyHeader.test(typeof tool.output==='string'?tool.output:''))),'Changed skill body appeared in a tool result: '+name);
    }
    return {eligible:true,reason:'Identical runtime, skill, discovery, scenarios and native environment; changed skills were not loaded',changedSkills:changed,sourceRunId:report.runId,sourceSha:report.sourceSha,reportHash:hash(JSON.stringify(report)),candidate,trees:context.trees,discovery:context.discovery,...(context.sbom?{sbom:context.sbom}:{}),...(context.hostWait?{hostWait:context.hostWait}:{}),...(context.previewSelection?{previewSelection:context.previewSelection}:{})};
  }catch(error){return {eligible:false,reason:error.message};}
}
export function validateSkillReuse(candidate,report,proof){
  assert.equal(proof.eligible,true);assert.deepEqual(proof.candidate,candidate);assert.equal(proof.reportHash,hash(JSON.stringify(report)),'Original behavior report changed');
  const assessed=assessSkillReuse(candidate,report,proof);assert.equal(assessed.eligible,true,assessed.reason);assert.deepEqual(proof.changedSkills,assessed.changedSkills);assert.equal(proof.sourceRunId,report.runId);assert.equal(proof.sourceSha,report.sourceSha);return assessed;
}
async function main(){
  const root=process.argv[2]??'.base-evidence',skill=process.env.BEHAVIOR_CASE,folder='behavior-mixed-'+skill+'-mixed',candidate=JSON.parse(await fs.readFile('dist/manifest.json','utf8'));let proof={eligible:false,reason:'No previous complete campaign selected'};
  for(const [evidenceRoot,evidenceRun]of [[root,process.env.BASE_EVIDENCE_RUN],[process.argv[3]??'.fallback-evidence',process.env.FALLBACK_EVIDENCE_RUN]]){
  if(!evidenceRun||proof.eligible)continue;
  try{
    const reportBytes=await fs.readFile(path.join(evidenceRoot,folder,folder+'.json')),report=JSON.parse(reportBytes),anchor=JSON.parse(await fs.readFile(path.join(evidenceRoot,'cosmos-candidate/manifest.json'),'utf8'));assert.equal(anchor.runId,evidenceRun);
    let base=anchor,oldSbom=JSON.parse(await fs.readFile(path.join(evidenceRoot,'cosmos-candidate/dependencies.json'),'utf8'));
    if(report.runId!==evidenceRun){const prior=JSON.parse(await fs.readFile(path.join(evidenceRoot,folder,'behavior-evidence-reuse.json'),'utf8'));validateSkillReuse(anchor,report,prior);base=report.candidate;oldSbom=prior.sbom.before;}else assert.deepEqual(report.candidate,anchor);
    const hostWait={},previewSelection={},tree=async(sha,entry)=>{
      if(entry!=='tools/behavior')return (await exec('git',['rev-parse',sha+':'+entry])).stdout.trim();
      const lines=(await exec('git',['ls-tree','-r',sha+':'+entry])).stdout.trim().split('\n'),scoped=[];
      for(const line of lines){if(line.endsWith('\tskill-suites.mjs')){const source=(await exec('git',['show',sha+':tools/behavior/skill-suites.mjs'])).stdout;previewSelection[sha===base.sourceSha?'before':'after']=scopedPreviewSelection(source).policy;scoped.push('selected-scenario '+hash(scopedSkillSuite(source,skill)));}else if(line.endsWith('\trun.mjs')){const source=(await exec('git',['show',sha+':tools/behavior/run.mjs'])).stdout,controller=scopedController(source);hostWait[sha===base.sourceSha?'before':'after']=controller.budgets;scoped.push('host-controller '+hash(controller.source));}else scoped.push(line);}
      return createHash('sha1').update(scoped.join('\n')).digest('hex');
    },trees={};
    for(const entry of evidenceDependencies)trees[entry]={before:await tree(base.sourceSha,entry),after:await tree(candidate.sourceSha,entry)};
    const discovery={};for(const name of candidate.skills){const old=(await exec('git',['show',base.sourceSha+':skills/'+name+'/SKILL.md'])).stdout,now=await fs.readFile('skills/'+name+'/SKILL.md','utf8'),front=s=>s.replace(/\r\n/g,'\n').match(/^---\n[\s\S]*?\n---/)[0];discovery[name]={before:hash(front(old)),after:hash(front(now))};}
    const sbom={before:oldSbom,after:JSON.parse(await fs.readFile('dist/dependencies.json','utf8'))};
    proof=assessSkillReuse(candidate,report,{trees,discovery,sbom,hostWait,previewSelection});
    if(proof.eligible){await fs.mkdir('artifacts',{recursive:true});await fs.writeFile(path.join('artifacts',folder+'.json'),reportBytes);await fs.writeFile('artifacts/behavior-evidence-reuse.json',JSON.stringify(proof,null,2));}
  }catch(error){proof={eligible:false,reason:'Fresh execution required: '+error.message};}
  }
  if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,'reused='+String(proof.eligible)+'\n');console.log(JSON.stringify({reused:proof.eligible,skill,sourceRunId:proof.sourceRunId,reason:proof.reason}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
