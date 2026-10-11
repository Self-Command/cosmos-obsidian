import fs from 'node:fs/promises';
import path from 'node:path';
import {bytesHash} from '../domain/identity.js';
import {CosmosError} from '../errors.js';
export const skillNames=['cosmos-plan','cosmos-create','cosmos-project','cosmos-learn','cosmos-life','cosmos-tasks','cosmos-evolve','cosmos-amytis','cosmos-files','cosmos-check'] as const;
export interface PackageManifest {version:string;sourceSha:string;runId:string;attempt:string;protocol:number;node:string;files:Record<string,string>;skills:string[]}
export async function packageFiles(root:string):Promise<string[]> {
  const result:string[]=[];
  for(const entry of await fs.readdir(root,{withFileTypes:true})){
    if(entry.isSymbolicLink())throw new CosmosError('PACKAGE_INVALID','发行内容不能含外部链接。');
    if(entry.isDirectory())result.push(...(await packageFiles(path.join(root,entry.name))).map(name=>entry.name+'/'+name));
    else if(entry.isFile())result.push(entry.name);
    else throw new CosmosError('PACKAGE_INVALID','发行内容包含不支持的对象。');
  }
  return result.sort();
}
export async function verifyPackage(root:string,sourceSha?:string) {
  const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8')) as PackageManifest;
  if(!/^[a-f0-9]{40}$/.test(manifest.sourceSha)||sourceSha&&manifest.sourceSha!==sourceSha||manifest.protocol!==1||JSON.stringify([...(manifest.skills??[])].sort())!==JSON.stringify([...skillNames].sort()))throw new CosmosError('PACKAGE_INVALID','候选身份或十技能清单不一致。');
  const actual=await packageFiles(root),declared=Object.keys(manifest.files).sort();
  if(JSON.stringify(actual.filter(file=>!['manifest.json','connection.json'].includes(file)))!==JSON.stringify(declared))throw new CosmosError('PACKAGE_INVALID','发行文件缺失或包含未登记文件。');
  for(const [name,hash] of Object.entries(manifest.files)){
    if(!/^[a-zA-Z0-9_./-]+$/.test(name)||name.split('/').some(part=>!part||part==='.'||part==='..')||!/^([a-f0-9]{64})$/.test(hash))throw new CosmosError('PACKAGE_INVALID','候选清单路径或指纹无效。');
    if(bytesHash(await fs.readFile(path.join(root,...name.split('/'))))!==hash)throw new CosmosError('PACKAGE_INVALID','候选文件字节变化。',{file:name});
  }
  for(const name of skillNames)if(!manifest.files['skills/'+name+'/SKILL.md']||!manifest.files['skills/'+name+'/scripts/cosmos.mjs'])throw new CosmosError('PACKAGE_INVALID','技能正文或执行入口缺失。',{name});
  return manifest;
}
