import {it,expect} from 'vitest';
import {assessSkillReuse,validateSkillReuse,evidenceDependencies} from '../tools/reuse-skill-evidence.mjs';
import {createHash} from 'node:crypto';
const hash='a'.repeat(64),tree='b'.repeat(40);
function fixture(){
  const previous={version:'0.1.0',protocol:1,node:'v24.21.0',sourceSha:'c'.repeat(40),runId:'100',attempt:'1',skills:['cosmos-tasks','cosmos-project'],files:{'cosmos.mjs':hash,'cosmos-runtime.cjs':hash,'skills/cosmos-tasks/SKILL.md':hash,'skills/cosmos-project/SKILL.md':hash}},candidate=structuredClone(previous);candidate.runId='101';candidate.sourceSha='d'.repeat(40);candidate.files['skills/cosmos-project/SKILL.md']='e'.repeat(64);
  const report={candidate:previous,sourceSha:previous.sourceSha,runId:previous.runId,case:'cosmos-tasks',profile:'full',passed:true,model:'gpt-6-luna',effort:'xhigh',samples:Array.from({length:3},()=>({passed:true,issues:[],turns:[{tools:[{name:'command_execution',command:'node /skills/cosmos-tasks/scripts/cosmos.mjs task preview'}]}]}))},context={trees:Object.fromEntries(evidenceDependencies.map(name=>[name,{before:tree,after:tree}])),discovery:Object.fromEntries(candidate.skills.map(name=>[name,{before:hash,after:hash}]))};return {candidate,report,context};
}
it('retains original real-host report only when its executed dependency bytes are unchanged',()=>{const {candidate,report,context}=fixture(),proof=assessSkillReuse(candidate,report,context);expect(proof.eligible).toBe(true);expect(validateSkillReuse(candidate,report,proof).sourceRunId).toBe('100');expect(report.candidate.runId).toBe('100');});
it.each(['runtime','own-skill','discovery','scenarios','native-environment','changed-skill-loaded','failed-sample','missing-dependency','file-set','model'])('requires fresh execution for %s',problem=>{
  const {candidate,report,context}=fixture();
  if(problem==='runtime')candidate.files['cosmos-runtime.cjs']='f'.repeat(64);
  if(problem==='own-skill')candidate.files['skills/cosmos-tasks/SKILL.md']='f'.repeat(64);
  if(problem==='discovery')context.discovery['cosmos-project'].after='f'.repeat(64);
  if(problem==='scenarios')context.trees['tools/behavior'].after='f'.repeat(40);
  if(problem==='native-environment')context.trees['tools/native'].after='f'.repeat(40);
  if(problem==='changed-skill-loaded')report.samples[1].turns[0].tools.push({name:'Read',input:{path:'/skills/cosmos-project/SKILL.md'}});
  if(problem==='failed-sample')report.samples[2].passed=false;
  if(problem==='missing-dependency')delete context.trees.src;
  if(problem==='file-set')candidate.files['unknown.mjs']=hash;
  if(problem==='model')report.model='unapproved-model';
  expect(assessSkillReuse(candidate,report,context).eligible).toBe(false);
});
it('rejects changed original reports and forged eligibility proofs',()=>{const {candidate,report,context}=fixture(),proof=assessSkillReuse(candidate,report,context);report.samples[1].turns.push({answer:'Different evidence'});expect(()=>validateSkillReuse(candidate,report,proof)).toThrow();const second=fixture(),forged=assessSkillReuse(second.candidate,second.report,second.context);forged.trees.src.after='f'.repeat(40);expect(()=>validateSkillReuse(second.candidate,second.report,forged)).toThrow();});
it('permits only the source identity metadata to differ in the dependency inventory',()=>{
  const {candidate,report,context}=fixture(),digest=object=>createHash('sha256').update(JSON.stringify(object,null,2)).digest('hex');context.sbom={before:{sourceSha:report.sourceSha,packages:[{name:'library',version:'1.0.0'}]},after:{sourceSha:candidate.sourceSha,packages:[{name:'library',version:'1.0.0'}]}};report.candidate.files['dependencies.json']=digest(context.sbom.before);candidate.files['dependencies.json']=digest(context.sbom.after);
  expect(assessSkillReuse(candidate,report,context).eligible).toBe(true);context.sbom.after.packages[0].version='2.0.0';candidate.files['dependencies.json']=digest(context.sbom.after);expect(assessSkillReuse(candidate,report,context).eligible).toBe(false);
});
