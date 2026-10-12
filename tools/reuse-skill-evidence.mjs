import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const exec=promisify(execFile),hash=value=>createHash('sha256').update(value).digest('hex');
export const evidenceDependencies=['src','tests/fixtures','tools/behavior','tools/native','tools/build.mjs','tools/verify-package.mjs','package.json','package-lock.json','tsconfig.json','AGENTS.md'];
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
    assert.deepEqual(Object.keys(context.discovery).sort(),[...candidate.skills].sort());
    for(const [name,pair]of Object.entries(context.discovery)){assert.match(pair.before,/^[a-f0-9]{64}$/);assert.equal(pair.before,pair.after,'Native discovery changed: '+name);}
    const observed=JSON.stringify(report.samples.flatMap(s=>s.turns.flatMap(t=>[t.tools??[],t.nativeContextMessages??[]])));
    for(const name of changed)assert.ok(!observed.includes(name),'A changed skill was used in this scenario: '+name);
    return {eligible:true,reason:'Identical runtime, skill, discovery, scenarios and native environment; changed skills were not loaded',changedSkills:changed,sourceRunId:report.runId,sourceSha:report.sourceSha,reportHash:hash(JSON.stringify(report)),candidate,trees:context.trees,discovery:context.discovery,...(context.sbom?{sbom:context.sbom}:{})};
  }catch(error){return {eligible:false,reason:error.message};}
}
export function validateSkillReuse(candidate,report,proof){
  assert.equal(proof.eligible,true);assert.deepEqual(proof.candidate,candidate);assert.equal(proof.reportHash,hash(JSON.stringify(report)),'Original behavior report changed');
  const assessed=assessSkillReuse(candidate,report,proof);assert.equal(assessed.eligible,true,assessed.reason);assert.deepEqual(proof.changedSkills,assessed.changedSkills);assert.equal(proof.sourceRunId,report.runId);assert.equal(proof.sourceSha,report.sourceSha);return assessed;
}
async function main(){
  const root=process.argv[2]??'.base-evidence',skill=process.env.BEHAVIOR_CASE,folder='behavior-mixed-'+skill+'-mixed',candidate=JSON.parse(await fs.readFile('dist/manifest.json','utf8'));let proof={eligible:false,reason:'No previous complete campaign selected'};
  if(process.env.BASE_EVIDENCE_RUN)try{
    const reportBytes=await fs.readFile(path.join(root,folder,folder+'.json')),report=JSON.parse(reportBytes),base=JSON.parse(await fs.readFile(path.join(root,'cosmos-candidate/manifest.json'),'utf8'));assert.deepEqual(report.candidate,base);assert.equal(report.runId,process.env.BASE_EVIDENCE_RUN);
    const tree=async(sha,entry)=>(await exec('git',['rev-parse',sha+':'+entry])).stdout.trim(),trees={};
    for(const entry of evidenceDependencies)trees[entry]={before:await tree(base.sourceSha,entry),after:await tree(candidate.sourceSha,entry)};
    const discovery={};for(const name of candidate.skills){const old=(await exec('git',['show',base.sourceSha+':skills/'+name+'/SKILL.md'])).stdout,now=await fs.readFile('skills/'+name+'/SKILL.md','utf8'),front=s=>s.replace(/\r\n/g,'\n').match(/^---\n[\s\S]*?\n---/)[0];discovery[name]={before:hash(front(old)),after:hash(front(now))};}
    const sbom={before:JSON.parse(await fs.readFile(path.join(root,'cosmos-candidate/dependencies.json'),'utf8')),after:JSON.parse(await fs.readFile('dist/dependencies.json','utf8'))};
    proof=assessSkillReuse(candidate,report,{trees,discovery,sbom});
    if(proof.eligible){await fs.mkdir('artifacts',{recursive:true});await fs.writeFile(path.join('artifacts',folder+'.json'),reportBytes);await fs.writeFile('artifacts/behavior-evidence-reuse.json',JSON.stringify(proof,null,2));}
  }catch(error){proof={eligible:false,reason:'Fresh execution required: '+error.message};}
  if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,'reused='+String(proof.eligible)+'\n');console.log(JSON.stringify({reused:proof.eligible,skill,sourceRunId:proof.sourceRunId,reason:proof.reason}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
