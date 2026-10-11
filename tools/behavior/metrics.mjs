import fs from 'node:fs/promises';
import path from 'node:path';
export async function codexResponses(configRoot,threadId,startedAt,endedAt){
  const events=[];
  async function visit(directory){for(const entry of await fs.readdir(directory,{withFileTypes:true}).catch(()=>[])){const target=path.join(directory,entry.name);if(entry.isDirectory())await visit(target);else if(entry.name.endsWith('.jsonl')&&entry.name.includes(threadId)){for(const line of (await fs.readFile(target,'utf8')).split('\n'))try{const event=JSON.parse(line);if(event.type==='token_usage_record'&&event.payload?.response_id&&Date.parse(event.timestamp)>=Date.parse(startedAt)&&Date.parse(event.timestamp)<=Date.parse(endedAt))events.push({id:event.payload.response_id,at:event.timestamp,usage:event.payload.usage});}catch{}}}}
  await visit(path.join(configRoot,'sessions'));return [...new Map(events.map(event=>[event.id,event])).values()];
}
export function activity(tools,injected){
  const skillReads=[],exploration=[];
  for(const tool of tools){const value=tool.input??{},command=tool.command??value.command??'',file=value.file_path??value.path??'';
    const reads=/\b(Get-Content|ReadAllText|cat|head|tail|type|readFile(?:Sync)?)\b/.test(command)||tool.name==='Read';
    if(tool.name==='Skill'||reads&&(command.includes('SKILL.md')||file.endsWith('SKILL.md')))skillReads.push(tool);
    if(reads&&/cosmos(?:-runtime)?\.(?:mjs|cjs)|connection\.json|schema\.json|[/\\]src[/\\]/.test(command+' '+file))exploration.push({kind:'implementation-or-config-read',tool});
    if(['Glob','Grep'].includes(tool.name)||/\b(Get-ChildItem|rg|find|ls|grep)\b/.test(command))exploration.push({kind:'directory-or-content-scan',tool});
  }
  if(skillReads.length>(injected?0:1))exploration.push({kind:'extra-skill-loading',count:skillReads.length-(injected?0:1)});
  return {hostCalls:tools.length,skillReads:skillReads.length,extraExploration:exploration};
}
export async function commandMetrics(stateRoot,startedAt,endedAt){
  return (await fs.readFile(path.join(stateRoot,'metrics.jsonl'),'utf8').catch(()=>'' )).split('\n').filter(Boolean).map(JSON.parse).filter(row=>Date.parse(row.startedAt)>=Date.parse(startedAt)&&Date.parse(row.startedAt)<=Date.parse(endedAt));
}
export function performanceIssues(row,kind,injected,phase){
  const issues=[],limit=phase==='plan'?(kind==='task'?90000:150000):60000;
  if(row.milliseconds>limit)issues.push('Wall time '+Math.round(row.milliseconds)+'ms exceeds '+limit+'ms');
  if(!row.responses?.length)issues.push('Native response IDs were not measured');
  if(row.responses?.length>(phase==='plan'?(injected?3:4):3))issues.push('Too many completed model responses');
  if(row.activity.extraExploration.length)issues.push('Unrelated exploration or repeated skill loading');
  const wanted=phase==='commit'?['review commit']:kind==='task'?['task preview']:['draft open','draft preview'];
  const actual=row.commands.map(c=>c.command);
  if(JSON.stringify(actual)!==JSON.stringify(wanted))issues.push('Expected business commands '+JSON.stringify(wanted)+'; received '+JSON.stringify(actual));
  return issues;
}
