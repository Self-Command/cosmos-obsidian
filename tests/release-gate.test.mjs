import {it,expect} from 'vitest';
import {validateRelease} from '../tools/release-gate.mjs';

function completeEvidence(){
  const candidate={sourceSha:'a'.repeat(40),runId:'123',attempt:'1',files:{}},reports={},needs=Object.fromEntries(['build','foundation','native','publication','installation','behavior'].map(name=>[name,{result:'success'}]));
  const identity={...candidate,candidate,manifestHash:'b'.repeat(64)},anchor=folder=>reports[folder+'/candidate-identity.json']=structuredClone(identity);
  for(const os of ['ubuntu-latest','windows-latest']){const foundation='foundation-'+os;anchor(foundation);reports[foundation+'/tests.json']={success:true,numTotalTests:59,numPassedTests:59,numFailedTests:0,numPendingTests:0,numTodoTests:0};const installation='installation-'+os;anchor(installation);reports[installation+'/installation.json']={...identity,passed:true,cases:10,sourceCandidateHidden:true,legacyDirectoriesPresent:false,businessNotesChanged:false};}
  anchor('native-environment');reports['native-environment/native-capabilities.json']={...identity,capabilities:{tasknotes:{version:'4.13.8',apiVersion:1}}};
  for(const [name,count]of [['tasks',8],['entities',4],['business',34]])reports['native-environment/native-'+name+'.json']={sourceSha:candidate.sourceSha,results:Array.from({length:count},()=>({passed:true}))};
  anchor('native-publication');reports['native-publication/native-publication.json']={...identity,results:Array.from({length:23},()=>({passed:true}))};
  for(const host of ['codex','claude'])for(const kind of ['task','travel','workflows'])for(const activation of kind==='workflows'?['implicit']:['implicit','injected']){
    const folder='behavior-'+host+'-'+kind+'-'+activation;anchor(folder);const turn=phase=>({phase,milliseconds:1000,responses:[{id:'native-1'}],sessionId:'persisted-1',activity:{extraExploration:[]},commands:(phase==='commit'?['review commit']:kind==='task'?['task preview']:['draft open','draft preview']).map(command=>({command}))});
    reports[folder+'/'+folder+'.json']={...identity,host,case:kind,activation,profile:'full',model:'gpt-6-luna',effort:'xhigh',passed:true,samples:Array.from({length:kind==='workflows'?1:3},()=>({passed:true,issues:[],reviewId:'r-1',executionId:'e-1',actualPath:'note.md',actualHash:'c'.repeat(64),turns:[turn('plan'),turn('commit')],results:Array.from({length:4},()=>({passed:true,interruption:{executionId:'e-1'}}))}))};
  }
  return {candidate,reports,needs};
}

it('requires complete, matching, successful evidence and all individual latency samples',()=>{const {reports,candidate,needs}=completeEvidence();expect(validateRelease(reports,candidate,needs)).toHaveLength(18);});
it.each(['missing-job','skipped-job','wrong-candidate','missing-report','empty-native','smoke','missing-sample','slow-sample','unmeasured','exploration','skipped-test'])('blocks release when %s is present',problem=>{
  const {reports,candidate,needs}=completeEvidence(),name='behavior-codex-task-implicit/behavior-codex-task-implicit.json',behavior=reports[name];
  if(problem==='missing-job')delete needs.behavior;
  if(problem==='skipped-job')needs.behavior.result='skipped';
  if(problem==='wrong-candidate')reports['installation-windows-latest/installation.json'].candidate.sourceSha='d'.repeat(40);
  if(problem==='missing-report')delete reports[name];
  if(problem==='empty-native')reports['native-environment/native-business.json'].results=[];
  if(problem==='smoke')behavior.profile='smoke';
  if(problem==='missing-sample')behavior.samples.pop();
  if(problem==='slow-sample')behavior.samples[2].turns[0].milliseconds=90001;
  if(problem==='unmeasured')behavior.samples[1].turns[1].responses=[];
  if(problem==='exploration')behavior.samples[0].turns[0].activity.extraExploration.push({kind:'directory-or-content-scan'});
  if(problem==='skipped-test')reports['foundation-windows-latest/tests.json'].numPendingTests=1;
  expect(()=>validateRelease(reports,candidate,needs)).toThrow();
});
