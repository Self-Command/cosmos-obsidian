import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {loadConfig} from '../config.js';
import {within,fingerprint,bytesHash} from '../domain/identity.js';
import {CosmosError} from '../errors.js';
import {replaceFile} from '../state/atomic.js';
import {skillNames,verifyPackage} from './package.js';
type Snapshot={kind:'absent'}|{kind:'link';target:string}|{kind:'directory';hash:string}|{kind:'file';hash:string};
interface Entry {target:string;source:string;backup:string;snapshot:Snapshot;phase:'pending'|'backing-up'|'backed-up'|'linking'|'linked'|'restored'}
interface Installation {version:1;id:string;sourceSha:string;release:string;bindingId:string;configPath:string;configHash:string;entries:Entry[];state:'planned'|'switching'|'complete'|'rolled-back'|'partial';hash:string}
async function absolute(raw:string) {
  if(!path.isAbsolute(raw))throw new CosmosError('INVALID_INPUT','安装目标必须是绝对路径。');
  let ancestor=path.resolve(raw);const tail:string[]=[];
  for(;;)try{return path.join(await fs.realpath(ancestor),...tail);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;const parent=path.dirname(ancestor);if(parent===ancestor)throw error;tail.unshift(path.basename(ancestor));ancestor=parent;}
}
async function exists(target:string){try{await fs.lstat(target);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}}
export async function snapshot(target:string):Promise<Snapshot> {
  if(!await exists(target))return {kind:'absent'};
  const info=await fs.lstat(target);
  if(info.isSymbolicLink())return {kind:'link',target:await fs.readlink(target)};
  if(info.isFile())return {kind:'file',hash:bytesHash(await fs.readFile(target))};
  if(!info.isDirectory())throw new CosmosError('INSTALL_CONFLICT','技能入口不是普通目录或链接。',{target});
  const entries=await fs.readdir(target);const content=await Promise.all(entries.sort().map(async name=>[name,await snapshot(path.join(target,name))]));return {kind:'directory',hash:fingerprint(content)};
}
const fixed=(plan:Installation)=>({version:plan.version,id:plan.id,sourceSha:plan.sourceSha,release:plan.release,bindingId:plan.bindingId,configPath:plan.configPath,configHash:plan.configHash,entries:plan.entries.map(({phase,...entry})=>entry)});
async function save(target:string,value:unknown){await fs.mkdir(path.dirname(target),{recursive:true});const temporary=target+'.tmp';const file=await fs.open(temporary,'w',0o600);try{await file.writeFile(JSON.stringify(value,null,2)+'\n');await file.sync();}finally{await file.close();}await replaceFile(temporary,target);}
export class Installer {
  constructor(public packageRoot:string){}
  async stage(rawRoot:string,rawConfig:string) {
    const manifest=await verifyPackage(this.packageRoot),configPath=await fs.realpath(rawConfig),config=await loadConfig(configPath),root=await absolute(rawRoot);
    if(within(config.vaultPath,root)||within(root,config.vaultPath))throw new CosmosError('INVALID_INPUT','安装目录必须位于业务库之外。');
    await fs.mkdir(path.join(root,'releases'),{recursive:true});const release=path.join(root,'releases',manifest.sourceSha);
    if(await exists(release)){
      if(await fs.realpath(release)!==release)throw new CosmosError('INSTALL_CONFLICT','已有发行目录是外部链接。');
      await verifyPackage(release,manifest.sourceSha);const connection=JSON.parse(await fs.readFile(path.join(release,'connection.json'),'utf8'));
      if(connection.configPath!==configPath||connection.bindingId!==config.bindingId)throw new CosmosError('INSTALL_CONFLICT','相同候选已绑定另一个库。');
    }else {
      const temporary=path.join(root,'releases','.stage-'+randomUUID());await fs.mkdir(temporary);
      for(const name of ['manifest.json',...Object.keys(manifest.files)]){const target=path.join(temporary,...name.split('/'));await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(path.join(this.packageRoot,...name.split('/')),target);}
      await save(path.join(temporary,'connection.json'),{version:1,configPath,bindingId:config.bindingId});await verifyPackage(temporary,manifest.sourceSha);await fs.rename(temporary,release);
    }
    await save(path.join(root,'staged.json'),{version:1,release,sourceSha:manifest.sourceSha,configPath,bindingId:config.bindingId});
    return {ok:true,state:'staged',root,release,sourceSha:manifest.sourceSha,bindingId:config.bindingId,skills:[...skillNames]};
  }
  async plan(rawRoot:string,rawDestinations:string[]) {
    const root=await absolute(rawRoot),staged=JSON.parse(await fs.readFile(path.join(root,'staged.json'),'utf8')),release=await fs.realpath(staged.release);
    if(release!==path.join(root,'releases',staged.sourceSha))throw new CosmosError('INSTALL_CONFLICT','暂存目录超出本安装范围。');
    await verifyPackage(release,staged.sourceSha);const config=await loadConfig(staged.configPath);
    if(config.bindingId!==staged.bindingId)throw new CosmosError('WRONG_VAULT','安装绑定变化。');
    const destinations=await Promise.all(rawDestinations.map(absolute));
    if(!destinations.length||new Set(destinations).size!==destinations.length||destinations.some(d=>within(config.vaultPath,d)||within(d,config.vaultPath)||within(release,d)||within(d,release))||destinations.some((d,i)=>destinations.some((other,j)=>i!==j&&(within(d,other)||within(other,d)))))throw new CosmosError('INVALID_INPUT','发现目录重复或与业务库/发行包重叠。');
    const id='i-'+randomUUID(),entries:Entry[]=[];
    for(const destination of destinations)for(const name of skillNames){const target=path.join(destination,name);entries.push({target,source:path.join(release,'skills',name),backup:path.join(destination,'.cosmos-backup-'+id+'-'+name),snapshot:await snapshot(target),phase:'pending'});}
    const plan:Installation={version:1,id,sourceSha:staged.sourceSha,release,bindingId:config.bindingId,configPath:staged.configPath,configHash:bytesHash(await fs.readFile(staged.configPath)),entries,state:'planned',hash:''};plan.hash=fingerprint(fixed(plan));
    const target=path.join(root,'installation',id+'.json');await save(target,plan);
    const preview=path.join(root,'installation',id+'.md');await fs.writeFile(preview,'# Cosmos 安装切换预览\n\n候选：'+plan.sourceSha+'\n\n'+entries.map(e=>'- '+e.target+' → '+e.source+'（原入口：'+e.snapshot.kind+'；恢复位置：'+e.backup+'）').join('\n')+'\n');
    return {ok:true,state:'review-ready',installationId:id,sourceSha:plan.sourceSha,preview,entries:entries.map(({phase,...entry})=>entry)};
  }
  private async read(rawRoot:string,id:string){
    if(!/^i-[0-9a-f-]{36}$/.test(id))throw new CosmosError('INVALID_ID','安装方案 ID 无效。');
    const root=await absolute(rawRoot),file=path.join(root,'installation',id+'.json'),plan=JSON.parse(await fs.readFile(file,'utf8')) as Installation;
    if(plan.version!==1||plan.id!==id||fingerprint(fixed(plan))!==plan.hash||plan.release!==path.join(root,'releases',plan.sourceSha))throw new CosmosError('REVIEW_TAMPERED','安装方案被修改。');
    for(const entry of plan.entries){const name=path.basename(entry.source);if(!skillNames.includes(name as any)||entry.source!==path.join(plan.release,'skills',name)||path.basename(entry.target)!==name||entry.backup!==path.join(path.dirname(entry.target),'.cosmos-backup-'+id+'-'+name))throw new CosmosError('REVIEW_TAMPERED','安装目标不合法。');}
    return {root,file,plan};
  }
  async status(root:string,id:string){const {plan}=await this.read(root,id);return {ok:['complete','rolled-back'].includes(plan.state),state:plan.state,installationId:id,sourceSha:plan.sourceSha,backups:plan.entries.filter(e=>e.snapshot.kind!=='absent').map(e=>e.backup)};}
  private async acquire(root:string,id:string,recovery=false){
    const target=path.join(root,'installation','active.lock');
    try{const file=await fs.open(target,'wx',0o600);try{await file.writeFile(JSON.stringify({installationId:id}));await file.sync();}finally{await file.close();}}
    catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;const lock=JSON.parse(await fs.readFile(target,'utf8'));if(!recovery||lock.installationId!==id)throw new CosmosError('INSTALL_LOCKED','已有安装切换或未核清的中断；不能抢锁。',{installationId:lock.installationId});}
    return async()=>{const lock=JSON.parse(await fs.readFile(target,'utf8'));if(lock.installationId!==id)throw new CosmosError('INSTALL_CONFLICT','安装锁身份变化。');await fs.unlink(target);};
  }
  async switch(rawRoot:string,id:string,confirmed:boolean) {
    if(!confirmed)throw new CosmosError('CONFIRMATION_REQUIRED','安装切换需要当前完整方案的批准。');
    const {root,file,plan}=await this.read(rawRoot,id);
    if(plan.state==='complete'){await this.verifyLinks(plan);return this.status(rawRoot,id);}
    if(plan.state!=='planned')throw new CosmosError('INVALID_STATE','中断安装先按原方案恢复，不重复切换。');
    const releaseLock=await this.acquire(root,id);let retain=false;
    try {
    await verifyPackage(plan.release,plan.sourceSha);
    const connection=JSON.parse(await fs.readFile(path.join(plan.release,'connection.json'),'utf8'));if(connection.configPath!==plan.configPath||bytesHash(await fs.readFile(plan.configPath))!==plan.configHash)throw new CosmosError('REVIEW_STALE','安装连接或绑定配置变化。');const config=await loadConfig(connection.configPath);if(config.bindingId!==plan.bindingId)throw new CosmosError('WRONG_VAULT','安装绑定变化。');
    for(const entry of plan.entries)if(fingerprint(await snapshot(entry.target))!==fingerprint(entry.snapshot)||await exists(entry.backup))throw new CosmosError('REVIEW_STALE','原技能入口或恢复位置变化。',{target:entry.target});
    plan.state='switching';await save(file,plan);
    try{
      for(const entry of plan.entries){
        await fs.mkdir(path.dirname(entry.target),{recursive:true});
        if(entry.snapshot.kind!=='absent'){entry.phase='backing-up';await save(file,plan);await fs.rename(entry.target,entry.backup);}
        entry.phase='backed-up';await save(file,plan);entry.phase='linking';await save(file,plan);
        await fs.symlink(entry.source,entry.target,process.platform==='win32'?'junction':'dir');entry.phase='linked';await save(file,plan);
      }
      await this.verifyLinks(plan);plan.state='complete';await save(file,plan);return this.status(rawRoot,id);
    }catch(error){await this.rollback(plan,file);retain=plan.state==='partial';return {ok:false,state:plan.state,installationId:id,error:{code:'INSTALL_FAILED',message:error instanceof Error?error.message:String(error)}};}
    }finally{if(!retain)await releaseLock();}
  }
  private async verifyLinks(plan:Installation){for(const entry of plan.entries)if(await fs.realpath(entry.target)!==entry.source)throw new CosmosError('INSTALL_CONFLICT','宿主发现入口不指向当前候选。',{target:entry.target});}
  private async rollback(plan:Installation,file:string){
    let complete=true;
    for(const entry of [...plan.entries].reverse())try{
      if(await exists(entry.target)){
        const info=await fs.lstat(entry.target);let isNew=false;if(info.isSymbolicLink())isNew=await fs.realpath(entry.target).catch(()=>null)===entry.source;
        if(isNew){try{await fs.unlink(entry.target);}catch(error){if(process.platform!=='win32'||!['EPERM','EISDIR'].includes((error as NodeJS.ErrnoException).code??''))throw error;await fs.rmdir(entry.target);}}
        else if(fingerprint(await snapshot(entry.target))!==fingerprint(entry.snapshot))throw new CosmosError('INSTALL_CONFLICT','恢复入口出现并发修改，保留证据。');
      }
      if(await exists(entry.backup)){if(await exists(entry.target))throw new CosmosError('INSTALL_CONFLICT','原入口恢复位置冲突。');await fs.rename(entry.backup,entry.target);}
      if(fingerprint(await snapshot(entry.target))!==fingerprint(entry.snapshot))throw new CosmosError('INSTALL_CONFLICT','原入口未完整恢复。');entry.phase='restored';await save(file,plan);
    }catch{complete=false;}
    plan.state=complete?'rolled-back':'partial';await save(file,plan);
  }
  async recover(rawRoot:string,id:string,confirmed:boolean){if(!confirmed)throw new CosmosError('CONFIRMATION_REQUIRED','恢复安装需要批准原方案。');const {root,plan,file}=await this.read(rawRoot,id);if(!['switching','partial'].includes(plan.state))throw new CosmosError('INVALID_STATE','此方案不需要中断恢复。');const releaseLock=await this.acquire(root,id,true);let retain=true;try{await this.rollback(plan,file);retain=plan.state==='partial';return this.status(rawRoot,id);}finally{if(!retain)await releaseLock();}}
}
