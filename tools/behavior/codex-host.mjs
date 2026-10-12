import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

async function executable(){
  const root=path.resolve('tools/behavior/node_modules/@openai/codex-win32-x64/vendor');
  const found=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const target=path.join(dir,e.name);if(e.isDirectory())await walk(target);else if(e.name==='codex.exe')found.push(target);}}await walk(root);if(found.length!==1)throw Error('Pinned official Codex executable missing or ambiguous');return found[0];
}

// JSON-RPC only controls the official harness. There is no custom model loop,
// substitute tool executor, or prompt teaching which business command to call.
export async function codexTurn({env,workspace,context,session,prompt,skill,signal,row,onSession}){
  const child=spawn(await executable(),['app-server'],{env,shell:false,windowsHide:true,cwd:workspace,stdio:['pipe','pipe','pipe']});
  const pending=new Map(),notifications=[],waiters=[];let next=0,stderr='',closed=false,turnId;
  child.stderr.on('data',b=>stderr=(stderr+b).slice(-12000));
  function dispatch(message){if(message.id!==undefined&&!message.method){const waiter=pending.get(message.id);if(waiter){pending.delete(message.id);message.error?waiter.reject(Error(JSON.stringify(message.error))):waiter.resolve(message.result);}return;}if(message.id!==undefined&&message.method){child.stdin.write(JSON.stringify({id:message.id,error:{code:-32601,message:'Interactive approval/tool request unavailable in isolated unattended evaluation'}})+'\n');return;}const waiter=waiters.shift();if(waiter)waiter.resolve(message);else notifications.push(message);}
  readline.createInterface({input:child.stdout}).on('line',line=>{try{dispatch(JSON.parse(line));}catch{row.protocolDiagnostics=(row.protocolDiagnostics??'')+line.slice(0,1000);}});
  const fail=error=>{closed=true;for(const p of pending.values())p.reject(error);for(const w of waiters.splice(0))w.reject(error);};child.on('error',fail);child.on('close',code=>fail(Error('Official app-server exited '+code)));
  function rpc(method,params){if(closed)return Promise.reject(Error('Official app-server closed'));const id=next++;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('Official RPC timed out: '+method));},45000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});child.stdin.write(JSON.stringify({id,method,params})+'\n');});}
  const event=()=>notifications.length?Promise.resolve(notifications.shift()):new Promise((resolve,reject)=>waiters.push({resolve,reject}));
  const abort=()=>{row.abortRequested=true;if(turnId)rpc('turn/interrupt',{threadId:session,turnId}).catch(()=>child.kill());else child.kill();};signal.addEventListener('abort',abort,{once:true});
  try{
    await rpc('initialize',{clientInfo:{name:'cosmos_acceptance',title:'Independent synthetic acceptance',version:'0.1.0'}});child.stdin.write(JSON.stringify({method:'initialized',params:{}})+'\n');
    const list=await rpc('skills/list',{cwds:[workspace],forceReload:true});row.discoveredSkills=(list.data??[]).flatMap(d=>d.skills??[]).map(s=>s.name).filter(s=>s.startsWith('cosmos-'));
    const params={model:'gpt-6-luna',modelProvider:'evaluation',cwd:workspace,approvalPolicy:'never',sandbox:'dangerFullAccess',config:{model_reasoning_effort:'xhigh',web_search:'disabled',features:{multi_agent:false}},developerInstructions:context};
    const started=await rpc(session?'thread/resume':'thread/start',session?{...params,threadId:session}:params);session=started.thread.id;onSession(session);row.observedModel=started.model??started.thread.model;row.instructionSources=started.instructionSources;
    const input=[{type:'text',text:skill?'$'+skill.name+' '+prompt:prompt}];if(skill)input.push({type:'skill',name:skill.name,path:skill.path});
    const turn=await rpc('turn/start',{threadId:session,input,model:'gpt-6-luna',effort:'xhigh'});turnId=turn.turn.id;if(signal.aborted)abort();
    for(;;){const message=await event(),p=message.params??{};if(p.threadId&&p.threadId!==session)continue;
      if(message.method==='item/completed'){const item=p.item;if(item.type==='commandExecution')row.tools.push({name:'command_execution',command:item.command,exitCode:item.exitCode,output:item.aggregatedOutput});else if(item.type==='agentMessage')row.answer=(row.answer??'')+item.text;else if(item.type==='fileChange')row.tools.push({name:'file_change',changes:item.changes});}
      if(message.method==='error')row.nativeErrors=[...(row.nativeErrors??[]),p];
      if(message.method==='thread/tokenUsage/updated')row.usage=p.tokenUsage;
      if(message.method==='turn/completed'){if(p.turn.status==='failed')throw Error(JSON.stringify(p.turn.error));if(p.turn.status==='interrupted'&&!row.interruption)throw Error('Official turn interrupted before completion');break;}
    }
    return session;
  }finally{signal.removeEventListener('abort',abort);row.hostStderr=stderr;child.stdin.end();child.kill();}
}
