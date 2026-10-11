import { build } from 'esbuild';
import { mkdir, readFile, writeFile, readdir,cp } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/cli/main.ts'], outfile: 'dist/cosmos.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node24', banner: { js: "import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);" } });
await build({ entryPoints: ['src/runtime/dispatcher.ts'], outfile: 'dist/cosmos-runtime.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'es2022', alias: { obsidian: './src/runtime/periodic-host.ts' } });
await build({entryPoints:['src/install/main.ts'],outfile:'dist/install.mjs',bundle:true,platform:'node',format:'esm',target:'node24',banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"}});
const skills=(await readdir('skills')).sort();
await cp('skills','dist/skills',{recursive:true});
for(const name of skills){await mkdir('dist/skills/'+name+'/scripts',{recursive:true});await cp('tools/skill-entry.mjs','dist/skills/'+name+'/scripts/cosmos.mjs');}
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
await writeFile('dist/dependencies.json',JSON.stringify({format:1,sourceSha:process.env.GITHUB_SHA,node:process.version,packages:Object.entries(lock.packages).filter(([name])=>name).map(([name,p])=>({name:name.replace(/^node_modules\//,''),version:p.version,license:p.license,resolved:p.resolved,integrity:p.integrity,development:!!p.dev,optional:!!p.optional}))},null,2));
await mkdir('dist/licenses',{recursive:true});
for(const [name,p] of Object.entries(lock.packages).filter(([name])=>name)){
  for(const filename of ['LICENSE','LICENSE.md','LICENSE.txt','license','license.md'])try{const content=await readFile(path.join(name,filename));await writeFile('dist/licenses/'+name.replace(/^node_modules\//,'').replaceAll('/','_')+'.txt',content);break;}catch(error){if(error.code!=='ENOENT')throw error;}
}
const files = {};
async function contents(folder,base=''){for(const entry of await readdir(folder,{withFileTypes:true})){const name=base+entry.name;if(entry.isDirectory())await contents(path.join(folder,entry.name),name+'/');else if(name!=='manifest.json')files[name]=createHash('sha256').update(await readFile(path.join(folder,entry.name))).digest('hex');}}
await contents('dist');
await writeFile('dist/manifest.json', JSON.stringify({ version: '0.1.0', sourceSha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT, protocol: 1, node: process.version,skills, files }, null, 2));
