import {it,expect,afterEach,vi} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {Installer,snapshot} from '../src/install/manager.js';
import {verifyPackage,skillNames} from '../src/install/package.js';
const roots:string[]=[];
afterEach(async()=>{vi.restoreAllMocks();for(const root of roots.splice(0))await fs.rm(root,{recursive:true,force:true});});
async function fixture(){
  const base=await fs.mkdtemp(path.join(os.tmpdir(),'cosmos-install-'));roots.push(base);const vault=path.join(base,'vault'),configPath=path.join(base,'binding.json'),root=path.join(base,'independent'),destinations=[path.join(base,'codex','skills'),path.join(base,'claude','skills')];await fs.mkdir(vault);
  await fs.writeFile(configPath,JSON.stringify({version:1,vaultPath:vault,vaultName:'Synthetic',cliPath:process.execPath,stateRoot:path.join(base,'state'),schemaPath:'rules/schema.json'}));
  const installer=new Installer(path.resolve('dist'));return {base,vault,configPath,root,destinations,installer};
}
it('stages a self-contained candidate without touching host entries or vault bytes and atomically switches all ten skills',async()=>{
  const f=await fixture();await fs.writeFile(path.join(f.vault,'keep.md'),'Protected user material');for(const d of f.destinations){await fs.mkdir(path.join(d,'unrelated'),{recursive:true});await fs.writeFile(path.join(d,'unrelated','SKILL.md'),'Other skill');await fs.mkdir(path.join(d,'cosmos-life'));await fs.writeFile(path.join(d,'cosmos-life','SKILL.md'),'Prior life skill');}
  const before=await snapshot(f.vault),old=await snapshot(path.join(f.destinations[0]!,'cosmos-life')),staged=await f.installer.stage(f.root,f.configPath);expect(await snapshot(path.join(f.destinations[0]!,'cosmos-life'))).toEqual(old);expect(await snapshot(f.vault)).toEqual(before);
  const planned=await f.installer.plan(f.root,f.destinations);await expect(f.installer.switch(f.root,planned.installationId,false)).rejects.toThrow();expect((await f.installer.switch(f.root,planned.installationId,true)).state).toBe('complete');
  for(const d of f.destinations)for(const name of skillNames)expect(await fs.realpath(path.join(d,name))).toBe(path.join(staged.release,'skills',name));expect(await snapshot(f.vault)).toEqual(before);expect(await fs.readFile(path.join(f.destinations[0]!,'unrelated','SKILL.md'),'utf8')).toBe('Other skill');
  expect((await f.installer.switch(f.root,planned.installationId,true)).state).toBe('complete');expect((await verifyPackage(staged.release)).sourceSha).toBe(staged.sourceSha);
});
it('rejects candidate tampering, binding drift, target drift and overlapping or vault discovery roots before switching',async()=>{
  const f=await fixture(),staged=await f.installer.stage(f.root,f.configPath);await expect(f.installer.plan(f.root,[f.vault])).rejects.toThrow();await expect(f.installer.plan(f.root,[f.destinations[0]!,path.join(f.destinations[0]!,'child')])).rejects.toThrow();
  let plan=await f.installer.plan(f.root,[f.destinations[0]!]);await fs.mkdir(path.join(f.destinations[0]!,'cosmos-tasks'),{recursive:true});await fs.writeFile(path.join(f.destinations[0]!,'cosmos-tasks','unexpected'),'Concurrent edit');await expect(f.installer.switch(f.root,plan.installationId,true)).rejects.toThrow('原技能入口');
  plan=await f.installer.plan(f.root,[f.destinations[0]!]);await fs.appendFile(f.configPath,' ');await expect(f.installer.switch(f.root,plan.installationId,true)).rejects.toThrow('绑定配置');
  await fs.appendFile(path.join(staged.release,'cosmos.mjs'),'\n// tampered');await expect(verifyPackage(staged.release)).rejects.toThrow('字节变化');
});
it('restores precise original entries when a link fails midway and preserves unrelated directories',async()=>{
  const f=await fixture();for(const name of skillNames){await fs.mkdir(path.join(f.destinations[0]!,name),{recursive:true});await fs.writeFile(path.join(f.destinations[0]!,name,'SKILL.md'),'Original '+name);}
  const before=await snapshot(f.destinations[0]!);await f.installer.stage(f.root,f.configPath);const plan=await f.installer.plan(f.root,[f.destinations[0]!]);let calls=0;const original=fs.symlink.bind(fs);
  vi.spyOn(fs,'symlink').mockImplementation(async(...args:any[])=>{if(++calls===6)throw Error('Injected link failure');return (original as any)(...args);});
  const result=await f.installer.switch(f.root,plan.installationId,true);expect(result.state).toBe('rolled-back');expect(await snapshot(f.destinations[0]!)).toEqual(before);
});
it('recovers a durable interrupted rename/link transaction without stealing another installation lock',async()=>{
  const f=await fixture();await fs.mkdir(path.join(f.destinations[0]!,'cosmos-plan'),{recursive:true});await fs.writeFile(path.join(f.destinations[0]!,'cosmos-plan','SKILL.md'),'Original');const before=await snapshot(f.destinations[0]!);await f.installer.stage(f.root,f.configPath);
  const proposed=await f.installer.plan(f.root,[f.destinations[0]!]),file=path.join(f.root,'installation',proposed.installationId+'.json'),stored=JSON.parse(await fs.readFile(file,'utf8'));const first=stored.entries[0];await fs.rename(first.target,first.backup);await fs.symlink(first.source,first.target,process.platform==='win32'?'junction':'dir');first.phase='linking';stored.state='switching';await fs.writeFile(file,JSON.stringify(stored));await fs.writeFile(path.join(f.root,'installation','active.lock'),JSON.stringify({installationId:stored.id}));
  const second=await f.installer.plan(f.root,[f.destinations[1]!]);await expect(f.installer.switch(f.root,second.installationId,true)).rejects.toThrow('不能抢锁');expect((await f.installer.recover(f.root,stored.id,true)).state).toBe('rolled-back');expect(await snapshot(f.destinations[0]!)).toEqual(before);
});
