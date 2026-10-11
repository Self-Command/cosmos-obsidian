import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const binding=JSON.parse(await readFile(process.env.COSMOS_CONFIG,'utf8')),results=[],suffix=process.env.GITHUB_RUN_ID+'-'+process.env.GITHUB_RUN_ATTEMPT;
function run(executable,args,input){return new Promise((resolve,reject)=>{const child=spawn(executable,args,{shell:false,windowsHide:true});let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.on('error',reject);child.on('close',code=>resolve({code,out,err}));child.stdin.end(input===undefined?'':JSON.stringify(input));});}
async function cli(args,input){const result=await run(process.execPath,['dist/cosmos.mjs',...args],input);try{return {code:result.code,...JSON.parse(result.out)};}catch{throw Error(result.out+result.err);}}
async function native(code){const r=await run(binding.cliPath,['vault='+binding.vaultName,'eval','code=(async()=>{'+code+'})()']);if(r.code||/^Error:/m.test(r.out))throw Error(r.out+r.err);return r;}
const preview=input=>cli(['publish','preview','--input','-'],input);
async function commit(review){assert.equal(review.state,'review-ready',JSON.stringify(review));const result=await cli(['publish','commit','--review',review.reviewId,'--confirm']);assert.equal(result.state,'succeeded',JSON.stringify(result));assert.equal(result.verified,true);return result;}
function content(contract){return {fields:Object.fromEntries(contract.fields.map(field=>{
  const parts=[];if(field.repeat)parts.push('### A concrete synthetic example');
  for(const anchor of field.anchors)parts.push('**'+anchor+'**\n\nSynthetic evidence explains this item and the exact limits of the example.');
  parts.push(...field.fixed);if(!field.anchors.length)parts.push('A synthetic source provides an explicit observation and supports this bounded conclusion.');
  return [field.id,parts.join('\n\n')];
}))};}
const baseValues=(language,slug,title,extra={})=>({language,kind:'post',slug,date:'2026-10-01',title,permission:true,scope:'marked',tags:['acceptance'],...extra});
try {
  console.log(JSON.stringify(await native("await app.plugins.loadManifests(); await app.plugins.enablePluginAndSave('obsidian-mkdocs-publisher'); 'enabled'")));
  let publisher;
  for(let i=0;i<25;i++){const probe=await cli(['inspect','capabilities']);publisher=probe.capabilities?.publication;if(publisher?.bridge===1)break;await new Promise(r=>setTimeout(r,300));}
  if(publisher?.bridge!==1){console.log(JSON.stringify(await run(binding.cliPath,['vault='+binding.vaultName,'dev:errors'])));throw Error('Real Enveloppe bridge did not load: '+JSON.stringify(publisher));}
  await writeFile(path.join(binding.vaultPath,'星云/星尘/附件/图片/pixel.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMkoAAAAASUVORK5CYII=','base64'));
  await new Promise(r=>setTimeout(r,500));
  const registered=[];
  for(const language of ['zh','en']){
    const name='合成写作-'+language+'-'+suffix,v=baseValues(language,'acceptance-'+suffix,'Synthetic '+language+' article');
    const opened=await cli(['draft','open','--input','-'],{action:'writing.create',name,values:v});assert.equal(opened.state,'needs-content',JSON.stringify(opened));
    const filled=content(opened.contentContract);const field=opened.contentContract.fields.find(f=>['展开','Main text'].includes(f.label));filled.fields[field.id]+='\n\n![Synthetic pixel](星云/星尘/附件/图片/pixel.png)';
    const reviewed=await cli(['draft','preview','--draft',opened.draftId,'--input','-'],filled);await commit(reviewed);
    const p='太阳/光球/文章/'+name+'.md';registered.push({language,path:p,name,values:v});
    results.push({case:'native-writing-'+language,passed:true});
  }
  let query=await cli(['query','publication','--input','-'],{});for(const r of registered)r.id=query.publication.candidates.find(c=>c.path===r.path).id;
  // Cancellation, identity uniqueness and language boundaries are enforced before any remote write.
  const cancelled=await preview({action:'upload',ids:[registered[1].id]});assert.equal(cancelled.state,'review-ready');await cli(['review','cancel','--review',cancelled.reviewId]);assert.equal((await cli(['publish','commit','--review',cancelled.reviewId,'--confirm'])).error.code,'INVALID_STATE');results.push({case:'cancel-publication/zero-dispatch',passed:true});
  const duplicate=await preview({action:'register',path:registered[0].path,values:{...registered[0].values,language:'en'}});assert.equal(duplicate.ok,false);results.push({case:'duplicate-language-slug',passed:true});
  const originalRaw=await readFile(path.join(binding.vaultPath,registered[0].path),'utf8');
  const stale=await preview({action:'upload',ids:[registered[0].id]});await writeFile(path.join(binding.vaultPath,registered[0].path),originalRaw+'\nConcurrent edit\n');const staleResult=await cli(['publish','commit','--review',stale.reviewId,'--confirm']);assert.equal(staleResult.ok,false);await writeFile(path.join(binding.vaultPath,registered[0].path),originalRaw);results.push({case:'publication-source-drift',passed:true});
  // A public copy gets a fresh identity, preserves source bytes, and excludes private sections.
  const copy=await preview({action:'copy',path:registered[0].path,name:'公开副本-'+suffix,values:baseValues('zh','copy-'+suffix,'Synthetic public copy')});await commit(copy);
  assert.equal(await readFile(path.join(binding.vaultPath,registered[0].path),'utf8'),originalRaw);const copied=await readFile(path.join(binding.vaultPath,copy.summary.changes[0].path),'utf8');assert.ok(!copied.includes('写作准备（内部）'));results.push({case:'public-copy/new-identity/source-retained',passed:true});
  // Series uses one ordered member list and requires separate public permission.
  const seriesName='合成系列-'+suffix,seriesValues=baseValues('zh','series-'+suffix,'Synthetic series',{kind:'series',role:'index',excerpt:'Synthetic ordered reading sequence',members:['[['+registered[0].path.replace(/\.md$/,'')+']]']});
  const seriesDraft=await cli(['draft','open','--input','-'],{action:'writing.create',name:seriesName,values:seriesValues});assert.equal(seriesDraft.state,'needs-content',JSON.stringify(seriesDraft));await commit(await cli(['draft','preview','--draft',seriesDraft.draftId,'--input','-'],content(seriesDraft.contentContract)));results.push({case:'native-series/order/permission',passed:true});
  query=await cli(['query','publication','--input','-'],{});const copyId=query.publication.candidates.find(c=>c.path===copy.summary.changes[0].path).id;
  const upload=await preview({action:'upload',ids:[registered[0].id,registered[1].id,copyId]});assert.equal(upload.state,'review-ready',JSON.stringify(upload));const full=await readFile(upload.preview.path,'utf8');assert.ok(full.includes('public/assets/'));assert.ok(!full.includes('## 写作准备（内部）'));assert.ok(!full.includes('## Writing notes (private)'));
  await native('app.__cosmosFixtureFailPR=true');
  const sent=await commit(upload);const pending=sent.steps[0].observed.batch;assert.equal(pending.state,'uploaded');assert.ok(sent.steps[0].observed.pending);results.push({case:'real-upload/failure-after-branch/persisted-batch',passed:true,batch:pending.id,commit:pending.commit});
  const repeated=await cli(['publish','commit','--review',upload.reviewId,'--confirm']);assert.equal(repeated.executionId,sent.executionId);assert.equal(repeated.steps[0].observed.batch.commit,pending.commit);results.push({case:'repeat-commit/no-new-upload',passed:true});
  const beforeManifest=await readFile(path.join(binding.vaultPath,'.obsidian/amytis/publication.json'),'utf8');await cli(['execution','verify','--execution',sent.executionId]);assert.equal(await readFile(path.join(binding.vaultPath,'.obsidian/amytis/publication.json'),'utf8'),beforeManifest);results.push({case:'execution-verification/read-only',passed:true});
  const resumed=await commit(await preview({action:'resume',batch:pending.id}));const batch=resumed.steps[0].observed.batch;assert.equal(batch.commit,pending.commit);assert.equal(batch.state,'merged');assert.ok(batch.prUrl);results.push({case:'real-pr/resume/merge-same-batch',passed:true,batch:batch.id,pr:batch.prUrl,merge:batch.mergedCommit});
  // Observe only the exact merged commit and rendered export stamps before local refresh is approved.
  let verified;
  for(let i=0;i<100;i++){
    verified=await cli(['execution','verify','--execution',resumed.executionId]);
    if(i%5===0)console.log(JSON.stringify({phase:'deployment-observation',publication:verified.steps?.[0]?.publication,state:verified.state}));
    if(verified.steps?.[0]?.publication?.state==='live')break;
    await new Promise(r=>setTimeout(r,7000));
  }
  assert.equal(verified.steps?.[0]?.publication?.state,'live',JSON.stringify(verified));
  const refreshed=await commit(await preview({action:'refresh',batch:batch.id}));results.push({case:'real-deploy/pages/export-stamps/assets/index',passed:true,publication:refreshed.steps[0].publication});
  const liveLanguage=await preview({action:'register',path:registered[0].path,values:{...registered[0].values,language:'en',slug:'distinct-'+suffix}});assert.equal(liveLanguage.ok,false);results.push({case:'uploaded-language-change-rejected',passed:true});
  // Rename locally after live verification: stable site_id and canonical URL remain unchanged.
  const renamed=await cli(['change','preview','--input','-'],{actions:[{action:'file.rename',path:registered[1].path,name:'本地改名-'+suffix}]});await commit(renamed);
  const reupload=await preview({action:'upload',ids:[registered[1].id]});assert.equal(reupload.state,'review-ready',JSON.stringify(reupload));const p=await readFile(reupload.preview.path,'utf8');assert.ok(p.includes('/en/posts/acceptance-'+suffix+'/'));await cli(['review','cancel','--review',reupload.reviewId]);results.push({case:'local-rename/stable-id-and-url',passed:true});
  const withdraw=await preview({action:'withdraw',id:copyId});assert.equal(withdraw.state,'review-ready',JSON.stringify(withdraw));const withdrawn=await commit(withdraw);results.push({case:'real-explicit-withdraw/managed-file',passed:true,batch:withdrawn.steps[0].observed.batch.id});
  const withdrawBatch=withdrawn.steps[0].observed.batch;
  let withdrawal;
  for(let i=0;i<100;i++){withdrawal=await cli(['execution','verify','--execution',withdrawn.executionId]);if(i%5===0)console.log(JSON.stringify({phase:'withdrawal-observation',publication:withdrawal.steps?.[0]?.publication,state:withdrawal.state}));if(withdrawal.steps?.[0]?.publication?.state==='withdrawn')break;await new Promise(r=>setTimeout(r,7000));}
  assert.equal(withdrawal.steps?.[0]?.publication?.state,'withdrawn',JSON.stringify(withdrawal));await commit(await preview({action:'refresh',batch:withdrawBatch.id}));results.push({case:'real-withdraw/deployment-and-page-404',passed:true});
} finally {
  await mkdir('artifacts',{recursive:true});await writeFile('artifacts/native-publication.json',JSON.stringify({sourceSha:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,candidate:JSON.parse(await readFile('dist/manifest.json','utf8')),mapping:{repository:'Self-Command/amytis → Self-Command/cosmos-obsidian-publication-fixture',urls:'https://self-command.github.io/amytis/* → https://self-command.github.io/cosmos-obsidian-publication-fixture/amytis/*',renderer:'d8099a39aa63f9dddace3fb2c32ce72daa6cae37',syntheticConfigBlob:'a047d5732bbe9c791626165d880d2b298474d56e',testOnly:true},results},null,2));
}
console.log(JSON.stringify({nativePublicationCases:results.length}));
