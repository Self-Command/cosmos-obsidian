import assert from 'node:assert/strict';
import { readFile,readdir,mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import {parse} from 'yaml';
import { createHash } from 'node:crypto';
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
assert.match(manifest.sourceSha, /^[a-f0-9]{40}$/);
assert.equal(manifest.sourceSha, process.env.GITHUB_SHA);
assert.equal(manifest.runId,process.env.GITHUB_RUN_ID);
assert.equal(manifest.attempt,process.env.GITHUB_RUN_ATTEMPT);
assert.equal(manifest.skills.length,10);assert.equal(new Set(manifest.skills).size,10);
for(const name of manifest.skills){
  assert.match(name,/^cosmos-[a-z-]+$/);
  const source=await readFile('dist/skills/'+name+'/SKILL.md','utf8'),front=source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);assert.ok(front,'Missing skill frontmatter');const metadata=parse(front[1]);assert.equal(metadata.name,name);assert.ok(metadata.description.length>10&&metadata.description.length<=1024);assert.ok(!metadata['disable-model-invocation'],'Discovery must remain automatic');assert.ok(!/TODO|TBD|\[insert/.test(source),'Incomplete scaffold');
}
async function actual(folder,base=''){let names=[];for(const entry of await readdir(folder,{withFileTypes:true})){assert.ok(!entry.isSymbolicLink(),'Candidate must be self-contained');const name=base+entry.name;if(entry.isDirectory())names.push(...await actual(path.join(folder,entry.name),name+'/'));else names.push(name);}return names;}
assert.deepEqual((await actual('dist')).filter(x=>x!=='manifest.json').sort(),Object.keys(manifest.files).sort());
for (const [name, hash] of Object.entries(manifest.files)) {
  const bytes = await readFile('dist/' + name);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
  const text = bytes.toString('utf8');
  assert.ok(!/obsidian-cosmos-skills|cosmos-skills[\\/]|37118c2365dcf353662509676736ebfe014e2986/.test(text), 'Legacy dependency in release');
  assert.ok(!/C:[\\/]Users[\\/]by970|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|ghp_[A-Za-z0-9]{20}/.test(text),'Private local information in release');
}
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/candidate-identity.json',JSON.stringify({sourceSha:manifest.sourceSha,runId:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,candidate:manifest,manifestHash:createHash('sha256').update(await readFile('dist/manifest.json')).digest('hex')},null,2));
console.log(JSON.stringify({ verified: true, sourceSha: manifest.sourceSha, files: Object.keys(manifest.files).length }));
