import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const base=await fs.mkdtemp(path.join(os.tmpdir(),'cosmos-independent-')),vault=path.join(base,'vault'),root=path.join(base,'install'),discovery=path.join(base,'host','skills'),config=path.join(base,'binding.json');
const manifest=JSON.parse(await fs.readFile('dist/manifest.json','utf8')),hidden=path.resolve('artifacts','temporarily-hidden-candidate');
const run=(script,args)=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[script,...args],{cwd:base,shell:false,windowsHide:true,env:{...process.env,COSMOS_CONFIG:''}});let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.on('error',reject);child.on('close',code=>{try{assert.equal(code,0,err+out);resolve(JSON.parse(out));}catch(error){reject(error);}});});
let concealed=false;const report={sourceSha:manifest.sourceSha,runId:process.env.GITHUB_RUN_ID,candidate:manifest,platform:process.platform,cases:0,passed:false,sourceCandidateHidden:false,legacyDirectoriesPresent:false,entry:'staged package and real filesystem discovery links',businessNotesChanged:false};
try{
  await fs.mkdir(vault);await fs.writeFile(path.join(vault,'keep.md'),'Protected business file');await fs.writeFile(config,JSON.stringify({version:1,vaultPath:vault,vaultName:'Isolated',cliPath:process.execPath,stateRoot:path.join(base,'state'),schemaPath:'rules/schema.json'}));
  const staged=await run(path.resolve('dist/install.mjs'),['stage','--root',root,'--config',config]);assert.equal(staged.sourceSha,manifest.sourceSha);
  const destinations=path.join(base,'destinations.json');await fs.writeFile(destinations,JSON.stringify([discovery]));const review=await run(path.join(staged.release,'install.mjs'),['plan','--root',root,'--destinations',destinations]);
  assert.equal((await run(path.join(staged.release,'install.mjs'),['switch','--root',root,'--installation',review.installationId,'--confirm'])).state,'complete');
  await fs.mkdir('artifacts',{recursive:true});await fs.rename(path.resolve('dist'),hidden);concealed=true;
  report.sourceCandidateHidden=true;
  for(const name of manifest.skills){const help=await run(path.join(discovery,name,'scripts','cosmos.mjs'),['help','task','preview']);assert.equal(help.commands.length,1);assert.equal(help.commands[0].id,'task.preview');report.cases++;}
  assert.equal(await fs.readFile(path.join(vault,'keep.md'),'utf8'),'Protected business file');
  report.passed=true;
}catch(error){report.error={message:error.message};throw error;}finally{await fs.mkdir('artifacts',{recursive:true});await fs.writeFile('artifacts/installation.json',JSON.stringify(report,null,2));if(concealed)await fs.rename(hidden,path.resolve('dist'));assert.ok(base.startsWith(path.join(os.tmpdir(),'cosmos-independent-')));await fs.rm(base,{recursive:true,force:true});}
