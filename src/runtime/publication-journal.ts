import fs from 'node:fs';
import path from 'node:path';
import {CosmosError} from '../errors.js';
import type {Context} from './context.js';
import {replaceFileSync} from '../state/atomic.js';
export interface PublicationJournal {version:1;bindingId:string;executionId:string;events:{route:string;intent:Record<string,unknown>;result?:Record<string,unknown>}[]}
const file=(ctx:Context,id:string)=>{
  if(!ctx.stateRoot||!/^e-[0-9a-f-]{36}$/.test(id))throw new CosmosError('INVALID_ID','发布日志需要原执行身份。');
  return path.join(ctx.stateRoot,'publication',id+'.json');
};
export function readPublicationJournal(ctx:Context,id:string) {
  const journal=JSON.parse(fs.readFileSync(file(ctx,id),'utf8')) as PublicationJournal;
  if(journal.version!==1||journal.executionId!==id||journal.bindingId!==ctx.bindingId)throw new CosmosError('WRONG_VAULT','发布日志绑定不匹配。');return journal;
}
export async function journalPublication<T>(ctx:Context,callback:()=>Promise<T>) {
  if(!ctx.executionId)throw new CosmosError('INVALID_STATE','发布提交缺少执行身份。');
  const journal:PublicationJournal={version:1,bindingId:ctx.bindingId!,executionId:ctx.executionId,events:[]},target=file(ctx,ctx.executionId);
  const save=()=>{fs.mkdirSync(path.dirname(target),{recursive:true});const fd=fs.openSync(target+'.tmp','w',0o600);try{fs.writeFileSync(fd,JSON.stringify(journal));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}replaceFileSync(target+'.tmp',target);};
  save();
  const plugin=ctx.app.plugins.plugins['obsidian-mkdocs-publisher'],reload=plugin.reloadOctokit;
  plugin.reloadOctokit=async function(...args:any[]){
    const client=await reload.apply(this,args),request=client.__amytisOwnedRequest;
    client.__amytisOwnedRequest=async(route:string,params:any)=>{
      if(route.startsWith('GET '))return request(route,params);
      const keys=['owner','repo','ref','sha','head','base','pull_number','commit_sha'];
      const event:PublicationJournal['events'][number]={route,intent:Object.fromEntries(keys.filter(k=>params[k]!==undefined).map(k=>[k,params[k]]))};
      journal.events.push(event);save(); // Durable dispatch intent comes before every remote mutation.
      const response=await request(route,params),data=response.data;
      event.result=Object.fromEntries(['sha','number','html_url','merged','merge_commit_sha','message'].filter(k=>data[k]!==undefined).map(k=>[k,data[k]]));save();return response;
    };
    return client;
  };
  try{return await callback();}finally{plugin.reloadOctokit=reload;}
}
