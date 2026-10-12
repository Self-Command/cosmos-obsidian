import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {performanceIssues} from './behavior/metrics.mjs';

const requiredJobs=['build','foundation','native','publication','installation','behavior'];
export function validateRelease(reports,candidate,needs){
  assert.deepEqual(Object.keys(needs).sort(),[...requiredJobs].sort(),'Missing required job result');
  for(const job of requiredJobs)assert.equal(needs[job].result,'success',job+' did not pass');
  const validated=[];
  function get(name){const value=reports[name];assert.ok(value,'Missing report '+name);return value;}
  function identity(value,name){assert.equal(value.sourceSha,candidate.sourceSha,'Wrong SHA '+name);assert.equal(value.runId,candidate.runId,'Wrong run '+name);assert.deepEqual(value.candidate,candidate,'Candidate manifest mismatch '+name);}
  function anchor(folder){const value=get(folder+'/candidate-identity.json');identity(value,folder);assert.equal(value.attempt,candidate.attempt);assert.match(value.manifestHash,/^[a-f0-9]{64}$/);}
  function cases(name,minimum){const r=get(name);assert.equal(r.sourceSha,candidate.sourceSha);assert.ok(r.results?.length>=minimum,'Empty or incomplete '+name);assert.ok(r.results.every(c=>c.passed===true),'Failed case '+name);validated.push({name,cases:r.results.length});return r;}
  for(const os of ['ubuntu-latest','windows-latest']){
    const foundation='foundation-'+os;anchor(foundation);const r=get(foundation+'/tests.json');assert.equal(r.success,true);assert.ok(r.numTotalTests>=59);assert.equal(r.numPassedTests,r.numTotalTests);for(const key of ['numFailedTests','numPendingTests','numTodoTests'])assert.equal(r[key],0,'Failed/skipped tests '+foundation);validated.push({name:foundation,cases:r.numTotalTests});
    const installation='installation-'+os;anchor(installation);const installed=get(installation+'/installation.json');identity(installed,installation);assert.equal(installed.passed,true);assert.equal(installed.cases,10);assert.equal(installed.sourceCandidateHidden,true);assert.equal(installed.legacyDirectoriesPresent,false);assert.equal(installed.businessNotesChanged,false);validated.push({name:installation,cases:10});
  }
  anchor('native-environment');const capabilities=get('native-environment/native-capabilities.json');assert.equal(capabilities.sourceSha,candidate.sourceSha);assert.equal(capabilities.runId,candidate.runId);assert.equal(capabilities.capabilities.tasknotes.version,'4.13.8');assert.equal(capabilities.capabilities.tasknotes.apiVersion,1);
  cases('native-environment/native-tasks.json',8);cases('native-environment/native-entities.json',4);cases('native-environment/native-business.json',34);
  anchor('native-publication');const publication=cases('native-publication/native-publication.json',23);identity(publication,'publication');
  for(const host of ['codex','claude'])for(const kind of ['task','travel','workflows'])for(const activation of kind==='workflows'?['implicit']:['implicit','injected']){
    const folder='behavior-'+host+'-'+kind+'-'+activation;anchor(folder);const r=get(folder+'/'+folder+'.json');identity(r,folder);assert.equal(r.profile,'full','Smoke is not release evidence');assert.equal(r.host,host);assert.equal(r.case,kind);assert.equal(r.activation,activation);assert.equal(r.model,'gpt-6-luna');assert.equal(r.effort,'xhigh');assert.equal(r.passed,true);
    const required=kind==='workflows'?1:3;assert.equal(r.samples.length,required);
    for(const sample of r.samples){assert.equal(sample.passed,true);assert.deepEqual(sample.issues,[]);assert.ok(sample.turns.length>=2);for(const turn of sample.turns){assert.ok(turn.sessionId);assert.ok(turn.responses?.length,'Native response measurement absent');assert.ok(turn.milliseconds>0);}
      if(kind==='workflows'){assert.equal(sample.results?.length,4);assert.ok(sample.results.every(c=>c.passed));assert.ok(sample.results.some(c=>c.interruption?.executionId));}
      else {assert.deepEqual(sample.turns.map(t=>t.phase),['plan','commit']);for(const turn of sample.turns)assert.deepEqual(performanceIssues(turn,kind,activation==='injected',turn.phase),[]);assert.ok(sample.actualPath&&sample.actualHash&&sample.executionId&&sample.reviewId);}
    }
    validated.push({name:folder,cases:required});
  }
  return validated;
}

async function main(){const root=path.resolve(process.argv[2]??'evidence'),decision={sourceSha:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,releaseReady:false};try{
  const candidate=JSON.parse(await fs.readFile(path.join(root,'cosmos-candidate/manifest.json'),'utf8'));assert.equal(candidate.sourceSha,decision.sourceSha);assert.equal(candidate.runId,decision.runId);assert.equal(candidate.attempt,decision.attempt);decision.candidate=candidate;const reports={};
  for(const folder of await fs.readdir(root,{withFileTypes:true})){if(!folder.isDirectory()||folder.name==='cosmos-candidate')continue;for(const file of await fs.readdir(path.join(root,folder.name)))if(file.endsWith('.json'))reports[folder.name+'/'+file]=JSON.parse(await fs.readFile(path.join(root,folder.name,file),'utf8'));}
  const manifestHash=createHash('sha256').update(await fs.readFile(path.join(root,'cosmos-candidate/manifest.json'))).digest('hex');for(const [name,report]of Object.entries(reports))if(name.endsWith('/candidate-identity.json'))assert.equal(report.manifestHash,manifestHash,'Manifest bytes mismatch '+name);
  for(const [file,hash]of Object.entries(candidate.files))assert.equal(createHash('sha256').update(await fs.readFile(path.join(root,'cosmos-candidate',...file.split('/')))).digest('hex'),hash);
  decision.validated=validateRelease(reports,candidate,JSON.parse(process.env.REQUIRED_RESULTS));decision.releaseReady=true;
}catch(error){decision.error={message:error.message};process.exitCode=1;}finally{await fs.mkdir('artifacts',{recursive:true});await fs.writeFile('artifacts/release-decision.json',JSON.stringify(decision,null,2));console.log(JSON.stringify({releaseReady:decision.releaseReady,checks:decision.validated?.length,error:decision.error}));}}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
