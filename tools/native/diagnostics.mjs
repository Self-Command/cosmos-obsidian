import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const config=JSON.parse(await readFile(process.env.COSMOS_CONFIG,'utf8'));
const state={};
for(const kind of ['receipts','executions','reviews']){
  const directory=path.join(config.stateRoot,kind);const names=await readdir(directory).catch(()=>[]);
  state[kind]=await Promise.all(names.filter(n=>n.endsWith('.json')).map(async name=>{
    const value=JSON.parse(await readFile(path.join(directory,name),'utf8'));
    if(kind==='reviews')return {id:value.id,state:value.state,executionId:value.executionId};
    return value;
  }));
}
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/native-state-diagnostics.json',JSON.stringify({sourceSha:process.env.GITHUB_SHA,state},null,2));
