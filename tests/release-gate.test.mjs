import {it,expect} from 'vitest';
import {validateRelease} from '../tools/release-gate.mjs';
import {skillScenarios,scenarioHost,scenarioActivation} from '../tools/behavior/skill-suites.mjs';
import {assessSkillReuse,evidenceDependencies} from '../tools/reuse-skill-evidence.mjs';

function completeEvidence(){
  const candidate={sourceSha:'a'.repeat(40),runId:'123',attempt:'1',files:{}},reports={},needs=Object.fromEntries(['build','foundation','native','publication','installation','behavior'].map(name=>[name,{result:'success'}]));
  const identity={...candidate,candidate,manifestHash:'b'.repeat(64)},anchor=folder=>reports[folder+'/candidate-identity.json']=structuredClone(identity);
  for(const os of ['ubuntu-latest','windows-latest']){const foundation='foundation-'+os;anchor(foundation);reports[foundation+'/tests.json']={success:true,numTotalTests:59,numPassedTests:59,numFailedTests:0,numPendingTests:0,numTodoTests:0};const installation='installation-'+os;anchor(installation);reports[installation+'/installation.json']={...identity,passed:true,cases:10,sourceCandidateHidden:true,legacyDirectoriesPresent:false,businessNotesChanged:false};}
  anchor('native-environment');reports['native-environment/native-capabilities.json']={...identity,capabilities:{tasknotes:{version:'4.13.8',apiVersion:1}}};
  for(const [name,count]of [['tasks',8],['entities',4],['business',34]])reports['native-environment/native-'+name+'.json']={sourceSha:candidate.sourceSha,results:Array.from({length:count},()=>({passed:true}))};
  anchor('native-publication');reports['native-publication/native-publication.json']={...identity,results:Array.from({length:23},()=>({passed:true}))};
  for(const [skill,scenarios]of Object.entries(skillScenarios)){
    const folder='behavior-mixed-'+skill+'-mixed';anchor(folder);
    reports[folder+'/'+folder+'.json']={...identity,host:'mixed',case:skill,activation:'mixed',profile:'full',model:'gpt-6-luna',effort:'xhigh',passed:true,samples:scenarios.map((scenario,i)=>({index:i+1,skill,scenario,host:scenarioHost(i+1),activation:scenarioActivation(i+1),passed:true,issues:[],turns:[{phase:'plan',milliseconds:1000,responses:[{id:'native-1'}],sessionId:'persisted-1',activity:{extraExploration:[]}}],results:[{case:scenario+'/skill-flow',passed:true}]}))};
  }
  return {candidate,reports,needs};
}

it('requires complete, matching evidence for three distinct scenarios of every skill',()=>{const {reports,candidate,needs}=completeEvidence();expect(validateRelease(reports,candidate,needs)).toHaveLength(18);});
it('records response count, latency and additional reads without rejecting a correct architecture flow',()=>{const {reports,candidate,needs}=completeEvidence(),turn=reports['behavior-mixed-cosmos-tasks-mixed/behavior-mixed-cosmos-tasks-mixed.json'].samples[0].turns[0];turn.milliseconds=180001;turn.responses=Array.from({length:8},(_,i)=>({id:'native-'+i}));turn.activity.extraExploration=[{kind:'extra-skill-loading'}];expect(validateRelease(reports,candidate,needs)).toHaveLength(18);});
it('accepts retained reports only with unchanged dependency proof and preserves their original identity',()=>{
  const {reports,candidate,needs}=completeEvidence(),folder='behavior-mixed-cosmos-tasks-mixed',report=reports[folder+'/'+folder+'.json'];candidate.skills=Object.keys(skillScenarios);for(const value of Object.values(reports))if(value.candidate)value.candidate.skills=[...candidate.skills];report.candidate=structuredClone(candidate);report.candidate.sourceSha='c'.repeat(40);report.candidate.runId='122';report.sourceSha=report.candidate.sourceSha;report.runId=report.candidate.runId;
  const context={trees:Object.fromEntries(evidenceDependencies.map(name=>[name,{before:'d'.repeat(40),after:'d'.repeat(40)}])),discovery:Object.fromEntries(candidate.skills.map(name=>[name,{before:'e'.repeat(64),after:'e'.repeat(64)}]))},proof=assessSkillReuse(candidate,report,context);expect(proof.eligible).toBe(true);reports[folder+'/behavior-evidence-reuse.json']=proof;
  expect(validateRelease(reports,candidate,needs).find(v=>v.skill==='cosmos-tasks').sourceRunId).toBe('122');expect(report.sourceSha).toBe('c'.repeat(40));proof.trees['tools/behavior'].after='f'.repeat(40);expect(()=>validateRelease(reports,candidate,needs)).toThrow();
});
it.each(['missing-job','skipped-job','wrong-candidate','missing-report','empty-native','smoke','missing-sample','repeated-scenario','failed-case','failed-turn','unmeasured','skipped-test'])('blocks release when %s is present',problem=>{
  const {reports,candidate,needs}=completeEvidence(),name='behavior-mixed-cosmos-tasks-mixed/behavior-mixed-cosmos-tasks-mixed.json',behavior=reports[name];
  if(problem==='missing-job')delete needs.behavior;
  if(problem==='skipped-job')needs.behavior.result='skipped';
  if(problem==='wrong-candidate')reports['installation-windows-latest/installation.json'].candidate.sourceSha='d'.repeat(40);
  if(problem==='missing-report')delete reports[name];
  if(problem==='empty-native')reports['native-environment/native-business.json'].results=[];
  if(problem==='smoke')behavior.profile='smoke';
  if(problem==='missing-sample')behavior.samples.pop();
  if(problem==='repeated-scenario')behavior.samples[2].scenario=behavior.samples[0].scenario;
  if(problem==='failed-case')behavior.samples[1].results[0].passed=false;
  if(problem==='failed-turn')behavior.samples[2].turns[0].error='Native host could not complete';
  if(problem==='unmeasured')behavior.samples[1].turns[0].responses=[];
  if(problem==='skipped-test')reports['foundation-windows-latest/tests.json'].numPendingTests=1;
  expect(()=>validateRelease(reports,candidate,needs)).toThrow();
});
