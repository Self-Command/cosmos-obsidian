/* GitHub transport using Enveloppe's authenticated Octokit; never reads or copies credentials. */
module.exports = function publishTransport(deps) {
  const {request,save,parseYaml,blobHash}=deps;
  const owner='Self-Command',repo='amytis',base='main';
  const api=async(method,params={})=>(await request(method,{owner,repo,...params})).data;
  const managedPath=p=>/^(content\/(?:en\/)?(posts|notes|flows|series|books)\/.*\.md|public\/assets\/[a-f0-9]{64}\.[a-z0-9]+)$/.test(p)&&!p.includes('\\')&&!p.split('/').some(x=>x==='..'||x==='.'||!x);
  const decode=deps.decode;
  async function repository() {
    const ref=await api('GET /repos/{owner}/{repo}/git/ref/{ref}',{ref:'heads/'+base});
    const commit=await api('GET /repos/{owner}/{repo}/git/commits/{commit_sha}',{commit_sha:ref.object.sha});
    const tree=await api('GET /repos/{owner}/{repo}/git/trees/{tree_sha}',{tree_sha:commit.tree.sha,recursive:'1'});
    if(tree.truncated)throw Error('远端目录清单不完整，拒绝发布。');
    const paths=new Map(tree.tree.filter(e=>e.type==='blob').map(e=>[e.path,e]));
    for(const [path,sha] of Object.entries(deps.contract||{}))if(paths.get(path)?.sha!==sha)throw Error('Amytis 源码契约已变化，请先重新核查：'+path);
    return {head:ref.object.sha,tree:commit.tree.sha,paths};
  }
  async function collisionCheck(snapshot,preview,manifest) {
    const wanted=new Map(preview.artifacts.map(a=>[a.path,a]));
    const ids=new Map(preview.artifacts.map(a=>[a.id,a]));
    const languageOf=path=>path.startsWith('content/en/')?'en':'zh';
    const qualified=(path,name)=>languageOf(path)+':'+name;
    const names=new Set(preview.artifacts.filter(a=>!a.book).map(a=>qualified(a.path,a.registryKey)));
    for(const a of preview.artifacts){const fm=/^---\n([\s\S]*?)\n---/.exec(a.content);for(const alias of fm?(parseYaml(fm[1])?.aliases||[]):[])names.add(qualified(a.path,alias));}
    for(const [path,e] of snapshot.paths) {
      if(!/^content\/(?:en\/)?(posts|notes|flows|series)\/.*\.mdx?$/.test(path))continue;
      const owned=Object.entries(manifest.entries||{}).find(([,m])=>m.path===path);
      if(wanted.has(path)) {
        if(!owned || owned[0]!==wanted.get(path).id)throw Error('远端已有非本流程管理的同名文件：'+path);
        if(owned[1].blobSha!==e.sha)throw Error('远端文件在发布后被修改，请先处理冲突：'+path);
        continue;
      }
      // Existing handwritten content participates in slug/alias uniqueness, without being adopted.
      if(owned&&ids.has(owned[0])&&ids.get(owned[0]).oldPath===path){if(owned[1].blobSha!==e.sha)throw Error('原发布文件已被远端修改：'+path);continue;}
      let name=path.split('/').pop().replace(/\.mdx?$/,'').replace(/^\d{4}-\d{2}-\d{2}-/,'');
      if(['index','README'].includes(name))name=path.split('/').at(-2);
      const treePath=path.replace(/^content\/(?:en\/)?/,'');
      if(treePath.startsWith('flows/'))name=treePath.slice('flows/'.length).replace(/\/index\.mdx?$|\.mdx?$/,'');
      if(names.has(qualified(path,name)))throw Error('与站点同语言既有名称冲突：'+name);
      if(treePath.startsWith('notes/')) {
        const blob=await api('GET /repos/{owner}/{repo}/git/blobs/{file_sha}',{file_sha:e.sha});
        const text=decode(blob.content),match=/^---\s*\n([\s\S]*?)\n---/.exec(text);
        const fm=match?parseYaml(match[1]):{};
        if((fm?.aliases||[]).some(a=>names.has(qualified(path,a))))throw Error('与站点同语言既有别名冲突：'+path);
      }
    }
    for(const a of preview.artifacts) {
      if(snapshot.paths.has(a.path)&&!Object.values(manifest.entries||{}).some(m=>m.path===a.path))throw Error('不得覆盖非本流程管理文件：'+a.path);
      if(snapshot.paths.has(a.path)&&manifest.entries[a.id]?.blobSha!==snapshot.paths.get(a.path).sha)throw Error('远端文件在发布后被修改，请先处理冲突：'+a.path);
      if(a.oldPath&&!snapshot.paths.has(a.oldPath))throw Error('原发布路径已在远端消失，请先处理冲突。');
    }
  }
  async function publish(preview,manifest,{autoMerge=true,withdraw=false}={}) {
    if(!preview.valid||preview.errors?.length)throw Error('预检未通过，未执行上传。');
    if(!preview.artifacts.length&&!preview.deletions?.length)throw Error('没有待提交内容。');
    const snapshot=await repository();
    if(!withdraw)await collisionCheck(snapshot,preview,manifest);
    const deletes=new Set(preview.deletions||preview.artifacts.map(a=>a.oldPath).filter(Boolean));
    for(const path of deletes) {
      const old=Object.values(manifest.entries||{}).find(m=>m.path===path);
      if(!managedPath(path)||!old||!snapshot.paths.has(path)||old.blobSha!==snapshot.paths.get(path).sha)throw Error('撤稿／迁移目标不属于当前发布清单或已被修改：'+path);
    }
    const content=[...preview.artifacts.map(a=>({path:a.path,bytes:new TextEncoder().encode(a.content),id:a.id})),...preview.assets.map(a=>({path:a.path,bytes:new Uint8Array(a.bytes)}))];
    const entries=[],blobs={};
    // All blobs finish before a branch exists. Main remains unchanged on every pre-commit failure.
    for(const item of content) {
      if(!managedPath(item.path))throw Error('远端路径不合法：'+item.path);
      const expected=await blobHash(item.bytes),existing=snapshot.paths.get(item.path);
      if(existing && !item.id && existing.sha!==expected)throw Error('附件指纹路径与远端内容不一致。');
      const sha=existing?.sha===expected?expected:(await api('POST /repos/{owner}/{repo}/git/blobs',{content:deps.encode(item.bytes),encoding:'base64'})).sha;
      entries.push({path:item.path,mode:'100644',type:'blob',sha});if(item.id)blobs[item.id]=sha;
    }
    for(const path of deletes)entries.push({path,mode:'100644',type:'blob',sha:null});
    const latest=await api('GET /repos/{owner}/{repo}/git/ref/{ref}',{ref:'heads/'+base});
    if(latest.object.sha!==snapshot.head)throw Error('远端 main 在预检后发生变化，请重新预览。');
    const tree=await api('POST /repos/{owner}/{repo}/git/trees',{base_tree:snapshot.tree,tree:entries});
    const commit=await api('POST /repos/{owner}/{repo}/git/commits',{message:withdraw?'Amytis: withdraw managed content':'Amytis: publish prepared content',tree:tree.sha,parents:[snapshot.head]});
    const branch='amytis-publish/'+Date.now()+'-'+commit.sha.slice(0,8);
    await api('POST /repos/{owner}/{repo}/git/refs',{ref:'refs/heads/'+branch,sha:commit.sha});
    const tx={id:branch,branch,commit:commit.sha,baseHead:snapshot.head,state:'uploaded',artifacts:preview.artifacts.map(({content,record,...a})=>a),blobs,deletions:[...deletes],withdraw,created:new Date().toISOString()};
    manifest.transactions.push(tx);await save(manifest);
    try {
      const pr=await api('POST /repos/{owner}/{repo}/pulls',{title:withdraw?'Amytis 撤稿':'Amytis 内容发布',head:branch,base,body:'Prepared and validated by the local Amytis publishing workflow.\n\n'+preview.artifacts.map(a=>'- '+a.path).join('\n')});
      tx.pr=pr.number;tx.prUrl=pr.html_url;await save(manifest);
      if(autoMerge) {
        const merged=await api('PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge',{pull_number:pr.number,sha:commit.sha,merge_method:'merge'});
        if(!merged.merged)throw Error('PR 未合并：'+(merged.message||''));
        tx.mergedCommit=merged.sha;tx.state='merged';
      }
      await save(manifest);return tx;
    }catch(e){tx.error=e.message;await save(manifest);throw Error('上传分支已保留，未确认合并；请刷新／重试该批次。'+e.message);}
  }
  async function resume(tx,manifest,{autoMerge=true}={}) {
    if(!['uploaded','merged'].includes(tx.state))throw Error('该批次不能恢复。');
    if(tx.state==='merged')return tx;
    if(!tx.pr) {
      const list=await api('GET /repos/{owner}/{repo}/pulls',{head:owner+':'+tx.branch,state:'all'});
      let pr=list.find(p=>p.head.sha===tx.commit);
      if(!pr)pr=await api('POST /repos/{owner}/{repo}/pulls',{title:'Amytis 内容发布（恢复）',head:tx.branch,base,body:'Resume a previously validated publishing batch.'});
      tx.pr=pr.number;tx.prUrl=pr.html_url;await save(manifest);
    }
    const pr=await api('GET /repos/{owner}/{repo}/pulls/{pull_number}',{pull_number:tx.pr});
    if(pr.head.sha!==tx.commit)throw Error('发布分支已变化，不能自动恢复合并。');
    if(pr.merged){tx.mergedCommit=pr.merge_commit_sha;tx.state='merged';}
    else if(autoMerge){if(pr.state!=='open')throw Error('PR 已关闭且未合并。');const m=await api('PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge',{pull_number:tx.pr,sha:tx.commit,merge_method:'merge'});if(!m.merged)throw Error('恢复合并未成功。');tx.mergedCommit=m.sha;tx.state='merged';}
    delete tx.error;await save(manifest);return tx;
  }
  async function refresh(tx,manifest) {
    if(tx.pr && !tx.mergedCommit)await resume(tx,manifest,{autoMerge:false});
    if(!tx.mergedCommit)return {state:'uploaded',reason:'等待 PR 合并'};
    const runs=await api('GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs',{workflow_id:'deploy.yml',head_sha:tx.mergedCommit,per_page:20});
    const run=runs.workflow_runs?.find(r=>r.head_sha===tx.mergedCommit);
    if(!run || run.status!=='completed')return {state:'merged',reason:'等待对应提交的部署完成'};
    if(run.conclusion!=='success')return {state:'deploy-failed',reason:'对应提交部署失败：'+run.conclusion};
    // A successful Action alone does not prove the new page version is live.
    if(tx.withdraw){const tree=await repository();if(tx.deletions.some(p=>tree.paths.has(p)))return {state:'merged',reason:'撤稿路径仍存在'};for(const path of tx.deletions){const entry=Object.values(manifest.entries).find(e=>e.path===path);if(entry?.url){const response=await deps.fetchPage(entry.url);if(response.status!==404)return {state:'merged',reason:'等待网站撤稿生效'};}}return {state:'withdrawn',run:run.html_url};}
    for(const a of tx.artifacts){
      const response=await deps.fetchPage(a.url);let verified=response.status===200&&response.text.includes('data-amytis-export="'+a.stamp+'"');
      if(a.verification&&response.status===200){
        const receipt=await deps.fetchPage(a.verification.url);let data;try{data=JSON.parse(receipt.text);}catch{}
        const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
        verified=receipt.status===200&&data?.exportStamp===a.stamp&&data?.url===a.url&&response.text.includes(escape(a.verification.title))&&(!a.verification.excerpt||response.text.includes(escape(a.verification.excerpt)))&&a.verification.members.every(url=>{const path=new URL(url).pathname.replace(/\/$/,'');return response.text.includes(path)||response.text.includes(decodeURIComponent(path));});
      }
      if(!verified)return {state:'merged',reason:'部署已完成，页面版本尚未验证：'+a.url};
    }
    return {state:'live',run:run.html_url};
  }
  return {publish,resume,refresh,repository,managedPath};
};
