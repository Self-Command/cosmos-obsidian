// Real, isolated Obsidian + TaskNotes. Official persisted Claude/Codex sessions;
// the test controller supplies synthetic user requests and later approval turns.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {parse} from 'yaml';
import {taskPrompt,travelPrompt,qualityIssues} from './cases.mjs';
import {activity,codexResponses,commandMetrics,performanceIssues} from './metrics.mjs';
import {workflowCases} from './workflows.mjs';
import {codexTurn} from './codex-host.mjs';
import {skillSuite,skillScenarios,scenarioHost,scenarioActivation,setupSkillPublication} from './skill-suites.mjs';
const host=process.env.BEHAVIOR_HOST,kind=process.env.BEHAVIOR_CASE??'task',activation=process.env.BEHAVIOR_ACTIVATION??'implicit',profile=process.env.BEHAVIOR_PROFILE??'full',count=Number(process.env.BEHAVIOR_SAMPLES??3);
const isSkillSuite=Object.hasOwn(skillScenarios,kind);
const manifest=JSON.parse(await fs.readFile('dist/manifest.json','utf8')),binding=JSON.parse(await fs.readFile(process.env.COSMOS_CONFIG,'utf8')),reportFile='artifacts/behavior-'+host+'-'+kind+'-'+activation+'.json';
const report={sourceSha:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,candidate:manifest,profile,host,case:kind,activation,model:'gpt-6-luna',effort:'xhigh',gateway:'existing configured evaluation gateway',nativeBackend:'official Obsidian 1.14.4 / TaskNotes 4.13.8; no simulated native services',node:process.version,platform:process.platform,sdk:host==='codex'?'official app-server 0.162.1':'0.3.295',permissions:'isolated synthetic CI only; caller approval declaration remains the CLI trust boundary',samples:[],passed:false};
const redacted=value=>JSON.stringify(value,null,2).replaceAll(process.env.EVALUATION_TOKEN||'a-value-that-is-not-a-secret','[REDACTED]');
const save=async()=>{await fs.mkdir('artifacts',{recursive:true});await fs.writeFile(reportFile,redacted(report));};
await save();
function processRun(executable,args,options={}){return new Promise((resolve,reject)=>{const {input,...spawnOptions}=options,child=spawn(executable,args,{shell:false,windowsHide:true,...spawnOptions});let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.on('error',reject);child.on('close',code=>resolve({code,out,err}));child.stdin?.end(input);});}
async function installer(args){const result=await processRun(process.execPath,[path.resolve('dist/install.mjs'),...args]);assert.equal(result.code,0,result.out+result.err);return JSON.parse(result.out);}
async function markdownFiles(directory,base=''){const result=[];for(const entry of await fs.readdir(directory,{withFileTypes:true})){if(entry.name.startsWith('.'))continue;const full=path.join(directory,entry.name),relative=base+entry.name;if(entry.isDirectory())result.push(...await markdownFiles(full,relative+'/'));else if(entry.name.endsWith('.md'))result.push({path:relative,hash:createHash('sha256').update(await fs.readFile(full)).digest('hex')});}return result.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);}
const snapshot=async()=>JSON.stringify(await markdownFiles(binding.vaultPath));
const day=offset=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+offset*86400000));
const currentDate=day(0),taskDate=day(1),context='当前日期 '+currentDate+'，时区 Asia/Shanghai。当前工作区用于隔离的宇宙知识库合成验收；业务连接已安装。禁止使用子代理。';
async function prepareSample(index){
  const actualHost=isSkillSuite?scenarioHost(index):host,actualActivation=isSkillSuite?scenarioActivation(index):activation;
  const directory=path.join(process.env.COSMOS_NATIVE_ROOT,'behavior-'+actualHost+'-'+kind+'-'+actualActivation+'-'+index),workspace=path.join(directory,'workspace'),evaluationHome=path.join(directory,'home'),stateRoot=path.join(directory,'state'),config=path.join(directory,'binding.json'),installRoot=path.join(directory,'install');
  await fs.mkdir(workspace,{recursive:true});await fs.mkdir(evaluationHome,{recursive:true});await fs.mkdir(stateRoot,{recursive:true});await fs.writeFile(config,JSON.stringify({...binding,stateRoot}));await fs.writeFile(path.join(workspace,'AGENTS.md'),'Do not use subagents or delegate work. This workspace contains only synthetic evaluation inputs.\n');
  const staged=await installer(['stage','--root',installRoot,'--config',config]),discovery=actualHost==='codex'?path.join(workspace,'.agents','skills'):path.join(evaluationHome,'.claude','skills'),destinations=path.join(directory,'destinations.json');await fs.writeFile(destinations,JSON.stringify([discovery]));const proposed=await installer(['plan','--root',installRoot,'--destinations',destinations]);assert.equal((await installer(['switch','--root',installRoot,'--installation',proposed.installationId,'--confirm'])).state,'complete');
  const selected=isSkillSuite?kind:kind==='travel'?'cosmos-life':'cosmos-tasks',skillPath=path.join(discovery,selected,'SKILL.md'),configRoot=path.join(evaluationHome,actualHost==='codex'?'.codex':'.claude');await fs.mkdir(configRoot,{recursive:true});
  const env={...process.env,HOME:evaluationHome,USERPROFILE:evaluationHome,CODEX_HOME:configRoot,CLAUDE_CONFIG_DIR:configRoot,COSMOS_CONFIG:config,COSMOS_TRACE:'1',COSMOS_EVAL_KEY:process.env.EVALUATION_TOKEN,ANTHROPIC_AUTH_TOKEN:process.env.EVALUATION_TOKEN,ANTHROPIC_BASE_URL:'https://4router.net',CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1',CLAUDE_CODE_EFFORT_LEVEL:'xhigh'};
  // Scope credentials to the native host environment, never to the report or installed package.
  delete env.PUBLICATION_TOKEN;delete env.CHATGPT_API_KEY;delete env.OPENAI_API_KEY;
  let session;
  if(actualHost==='codex')await fs.writeFile(path.join(configRoot,'config.toml'),'model = "gpt-6-luna"\nmodel_provider = "evaluation"\nmodel_reasoning_effort = "xhigh"\nweb_search = "disabled"\n[features]\nmulti_agent = false\n[model_providers.evaluation]\nname = "Configured evaluation gateway"\nbase_url = "https://4router.net/v1"\nenv_key = "COSMOS_EVAL_KEY"\nwire_api = "responses"\nrequest_max_retries = 1\nstream_max_retries = 1\nstream_idle_timeout_ms = 90000\n');
  // Keep host labels in metrics rather than user-supplied business titles.
  // Each job has its own real vault; run/sample IDs provide sufficient uniqueness.
  const sample={index,name:(isSkillSuite?kind:kind==='task'?'补交驾校费用':kind==='travel'?'雨后山城一日游记':'业务流程')+'-'+process.env.GITHUB_RUN_ID+'-'+index,host:actualHost,activation:actualActivation,...(isSkillSuite?{skill:kind}:{}),turns:[],issues:[],diagnostics:[],passed:false};report.samples.push(sample);await save();
  async function turn(prompt,phase,fault={}){
    const injected=phase==='plan'&&actualActivation==='injected',row={phase,prompt,startedAt:new Date().toISOString(),tools:[],responses:[],injected,host:actualHost};sample.turns.push(row);await save();console.log(JSON.stringify({host:actualHost,kind,activation:actualActivation,index,phase,state:'started'}));
    const planningPhase=phase==='plan'||phase.endsWith('-plan');
    row.controllerTimeoutMs=planningPhase?240000:180000;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),row.controllerTimeoutMs),started=performance.now();
    let receiptWatcher,watching=false;
    if(fault.interruptReviewId)receiptWatcher=setInterval(async()=>{if(watching||controller.signal.aborted)return;watching=true;try{const review=JSON.parse(await fs.readFile(path.join(stateRoot,'reviews',fault.interruptReviewId+'.json'),'utf8'));if(review.executionId){const receipt=JSON.parse(await fs.readFile(path.join(stateRoot,'receipts',review.executionId+'.json'),'utf8'));if(receipt.state==='succeeded'&&receipt.result?.state==='succeeded'){row.interruption={kind:'controller aborted official host after actual terminal native receipt',executionId:review.executionId};controller.abort();}}}catch{}finally{watching=false;}},25);
    const input=injected&&actualHost==='claude'?'/'+selected+' '+prompt:prompt;
    try{
      if(actualHost==='codex'){
        session=await codexTurn({env,workspace,context,session,prompt:input,skill:injected?{name:selected,path:skillPath}:undefined,signal:controller.signal,row,onSession:id=>session=id});
      }else {
        const {query}=await import('./node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs');
        const stream=query({prompt:input,options:{cwd:workspace,resume:session,model:'gpt-6-luna',effort:'xhigh',maxTurns:20,persistSession:true,settingSources:['user'],env,abortController:controller,tools:['Read','Glob','Grep','Skill','Write','Bash'],permissionMode:'bypassPermissions',allowDangerouslySkipPermissions:true,systemPrompt:{type:'preset',preset:'claude_code',append:context},mcpServers:{}}});
        for await(const message of stream){if(message.session_id)session=message.session_id;if(message.type==='system'&&message.subtype==='init'){row.discoveredSkills=(message.slash_commands??[]).filter(name=>manifest.skills.includes(name));row.observedModel=message.model;}
          if(message.type==='assistant'){if(message.message?.id&&!row.responses.some(r=>r.id===message.message.id))row.responses.push({id:message.message.id,usage:message.message.usage,model:message.message.model});for(const block of message.message?.content??[]){if(block.type==='tool_use')row.tools.push({name:block.name,input:block.input});if(block.type==='text')row.answer=(row.answer??'')+block.text;}}
          if(message.type==='user')for(const block of message.message?.content??[]){if(block.type==='tool_result')row.toolResults=[...(row.toolResults??[]),{id:block.tool_use_id,isError:block.is_error,content:block.content}];if(block.type==='text')row.nativeContextMessages=[...(row.nativeContextMessages??[]),{uuid:message.uuid,text:block.text}];}
          if(message.type==='result'){row.usage=message.usage;if(message.is_error)throw Error(JSON.stringify({subtype:message.subtype,errors:message.errors}));}
        }
      }
    }catch(error){row.error=error.message;if(!row.interruption)throw error;}
    finally{clearTimeout(timeout);clearInterval(receiptWatcher);row.completedAt=new Date().toISOString();row.milliseconds=performance.now()-started;row.sessionId=session;if(actualHost==='codex'&&session)row.responses=await codexResponses(configRoot,session,row.startedAt,row.completedAt);row.commands=await commandMetrics(stateRoot,row.startedAt,row.completedAt);row.activity=activity(row.tools,injected);await save();console.log(JSON.stringify({host:actualHost,kind,activation:actualActivation,index,phase,milliseconds:Math.round(row.milliseconds),responses:row.responses.length,commands:row.commands.map(c=>c.command),state:row.interruption?'interrupted':row.error?'failed':'completed'}));}
    assert.ok(session,'Native persisted session ID missing');if(!row.interruption)assert.ok(row.answer?.trim(),'No user-facing result');if(phase==='plan')assert.deepEqual([...new Set(row.discoveredSkills??[])].sort(),[...manifest.skills].sort(),'Official host did not discover all ten skills');if(fault.interruptReviewId)assert.ok(row.interruption,'Official host was not interrupted after the native receipt');
    if(!row.responses.length)sample.issues.push('Native response IDs were not measured');
    if(isSkillSuite||kind==='workflows'){if(row.activity.extraExploration.length)sample.diagnostics.push({phase,observation:'Additional exploration or skill loading',activity:row.activity});}
    else sample.diagnostics.push(...performanceIssues(row,kind,injected,phase).map(observation=>({phase,observation})));
    return row;
  }
  return {sample,turn,stateRoot,staged,binding:{...binding,stateRoot},configPath:config,processRun};
}
try{
  assert.ok(['codex','claude','mixed'].includes(host));assert.ok(isSkillSuite||['task','travel','workflows'].includes(kind));assert.ok(['implicit','injected','mixed'].includes(activation));assert.ok(process.env.EVALUATION_TOKEN,'Required evaluation credential missing');assert.equal(manifest.sourceSha,process.env.GITHUB_SHA);assert.equal(manifest.runId,process.env.GITHUB_RUN_ID);
  if(kind==='cosmos-amytis')await setupSkillPublication(binding,processRun);
  for(let index=1;index<=count;index++){
    const c=await prepareSample(index),before=await snapshot();
    try{
      if(isSkillSuite){await skillSuite(c,{snapshot,markdownFiles,save});c.sample.passed=c.sample.issues.length===0;await save();continue;}
      if(kind==='workflows'){await workflowCases(c,{snapshot,markdownFiles,save});c.sample.passed=c.sample.issues.length===0;await save();continue;}
      const planned=await c.turn(kind==='task'?taskPrompt(c.sample.name):travelPrompt(c.sample.name),'plan');assert.equal(await snapshot(),before,'Business Markdown changed before approval');
      const reviews=(await fs.readdir(path.join(c.stateRoot,'reviews'))).filter(name=>name.endsWith('.json'));assert.equal(reviews.length,1,'Expected one actual immutable review');const review=JSON.parse(await fs.readFile(path.join(c.stateRoot,'reviews',reviews[0]),'utf8'));assert.equal(review.state,'review-ready');assert.equal(review.plan.steps.length,1);const step=review.plan.steps[0];assert.equal(step.action,kind==='task'?'task.create':'entity.create');
      assert.ok(planned.answer.includes(review.id)||planned.answer.includes(path.join(c.stateRoot,'previews',review.id+'.md')),'User was not given the actual full preview');
      c.sample.reviewId=review.id;c.sample.preview=review.preview;c.sample.plannedBody=step.expected.body;c.sample.plannedProperties=step.expected.properties;c.sample.issues.push(...qualityIssues(kind,step.expected.body));
      if(kind==='task'){assert.ok(step.expected.properties.scheduled.startsWith(taskDate+'T10:30'));assert.equal(step.expected.properties.timeEstimate,60);assert.equal(step.expected.properties.priority,'high');assert.ok(!step.expected.properties.due,'Duration became an invented deadline');}else{assert.equal(step.expected.properties.date,'2026-10-10');assert.ok(step.path.startsWith('地球/地层/游记/'));}
      await c.turn('确认创建。','commit');
      const executionFiles=(await fs.readdir(path.join(c.stateRoot,'executions'))).filter(name=>name.endsWith('.json'));assert.equal(executionFiles.length,1);const execution=JSON.parse(await fs.readFile(path.join(c.stateRoot,'executions',executionFiles[0]),'utf8'));assert.equal(execution.reviewId,review.id);assert.equal(execution.state,'succeeded');assert.equal(execution.verified,true);c.sample.executionId=execution.id;c.sample.runtimeTimings=execution.steps[0].timings;
      const actual=await fs.readFile(path.join(binding.vaultPath,...step.path.split('/')),'utf8'),front=actual.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);assert.ok(front);const properties=parse(front[1]),body=front[2].trim();assert.equal(body,step.expected.body.trim(),'Approved content was replaced during execution');assert.equal(properties.type,kind==='task'?'task':'record');
      const expected=(JSON.parse(before)).filter(file=>file.path!==step.path),after=await markdownFiles(binding.vaultPath);assert.deepEqual(after.filter(file=>file.path!==step.path),expected,'Other business Markdown changed');assert.equal(after.filter(file=>file.path===step.path).length,1);c.sample.actualPath=step.path;c.sample.actualHash=createHash('sha256').update(actual).digest('hex');c.sample.actualBody=body;c.sample.passed=c.sample.issues.length===0;
    }catch(error){c.sample.issues.push(error.message);c.sample.passed=false;}
    await save();
  }
  const required=isSkillSuite?3:kind==='workflows'||profile==='smoke'?1:3;report.passed=count===required&&report.samples.length===required&&report.samples.every(sample=>sample.passed);report.summary={samples:report.samples.length,passed:report.samples.filter(sample=>sample.passed).length,phaseMaximumMs:Object.fromEntries(['plan','commit'].map(phase=>[phase,Math.max(0,...report.samples.flatMap(sample=>sample.turns.filter(turn=>turn.phase===phase).map(turn=>turn.milliseconds)))]))};
}catch(error){report.error={message:error.message};}
await save();if(!report.passed)process.exitCode=1;console.log(redacted({passed:report.passed,summary:report.summary,error:report.error,issues:report.samples.flatMap(sample=>sample.issues)}));
