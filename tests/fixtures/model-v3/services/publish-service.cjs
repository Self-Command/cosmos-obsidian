/* Owned application layer. Invoked only by explicit commands, no startup scans or timers. */
module.exports = async function publishService(app,obsidian,system,modules,contract) {
  const root='.obsidian/amytis',filePath=root+'/publication.json';
  const {parseYaml,stringifyYaml}=obsidian;
  if(!parseYaml||!stringifyYaml)throw Error('发布入口未收到 Obsidian YAML API。');
  const hash=async value=>{const b=typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(value);return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join('');};
  const locks=app.__amytisLocks||(app.__amytisLocks=new Set());
  const encode=bytes=>{let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);};
  const decode=text=>new TextDecoder().decode(Uint8Array.from(atob(text.replace(/\s/g,'')),c=>c.charCodeAt(0)));
  const blobHash=async bytes=>{const prefix=new TextEncoder().encode('blob '+bytes.length+'\0'),b=new Uint8Array(prefix.length+bytes.length);b.set(prefix);b.set(bytes,prefix.length);return [...new Uint8Array(await crypto.subtle.digest('SHA-1',b))].map(n=>n.toString(16).padStart(2,'0')).join('');};
  function parse(text) {const m=/^\uFEFF?---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);return {fm:m?parseYaml(m[1])||{}:{},body:m?text.slice(m[0].length):text};}
  async function manifest() {
    if(!await app.vault.adapter.exists(filePath))return {version:1,target:'amytis',entries:{},transactions:[]};
    const m=JSON.parse(await app.vault.adapter.read(filePath));
    if(m.version!==1||m.target!=='amytis'||!m.entries||!Array.isArray(m.transactions))throw Error('发布清单无效，停止处理。');
    return m;
  }
  let manifestRaw=null;
  async function trackedManifest(){const m=await manifest();manifestRaw=await app.vault.adapter.exists(filePath)?await app.vault.adapter.read(filePath):null;return m;}
  async function saveManifest(m) {
    const exists=await app.vault.adapter.exists(filePath),current=exists?await app.vault.adapter.read(filePath):null;
    if(current!==manifestRaw)throw Error('发布清单发生并发变化，停止覆盖。');
    if(!await app.vault.adapter.exists(root))await app.vault.adapter.mkdir(root);
    const next=JSON.stringify(m,null,2)+'\n';if(next===current)return;
    if(current)await app.vault.adapter.write(filePath+'.prev',current);
    await app.vault.adapter.write(filePath,next);manifestRaw=next;
  }
  async function exclusive(key,callback) {if(locks.size)throw Error('Amytis 正在处理其他操作，请稍后重试。');locks.add(key);try{return await callback();}finally{locks.delete(key);}}
  async function records(){const result=[];for(const file of app.vault.getMarkdownFiles()) {
    if(!/^(太阳|月亮|地球|星云|黑洞)\//.test(file.path)||file.path.startsWith('星云/星尘/'))continue;
    const raw=await app.vault.read(file),{fm,body}=parse(raw);result.push({file,path:file.path,fm,body,raw});
  }return result;}
  const resolve=(target,source)=>app.metadataCache.getFirstLinkpathDest(target,source)?.path;
  function adapter(m){return modules.adapter({hash,resolve,resolveAsset:resolve,readBinary:async path=>app.vault.readBinary(app.vault.getAbstractFileByPath(path)),allowedFolder:system.allowedFolder,isKnown:id=>Boolean(m.entries[id])});}
  async function update(file,patch,expectedRaw) {
    await app.vault.process(file,current=>{
      if(expectedRaw!==undefined&&current!==expectedRaw)throw Error('笔记在面板打开后被修改，请重新打开，未覆盖你的修改。');
      const {fm,body}=parse(current);let changed=false;
      for(const [k,v] of Object.entries(patch)){if(JSON.stringify(fm[k])!==JSON.stringify(v)){fm[k]=v;changed=true;}}
      return changed?'---\n'+stringifyYaml(fm).trimEnd()+'\n---\n'+body:current;
    });
  }
  async function register(file,values,expectedRaw,{replacementRaw}={}) {return exclusive('register',async()=>{
    const m=await trackedManifest(),current=await app.vault.read(file),r={file,path:file.path,...parse(replacementRaw??current)};
    if(expectedRaw!==undefined&&current!==expectedRaw)throw Error('笔记已经变化，请重新打开面板。');
    const a=adapter(m);if(!a.eligible(r))throw Error('该实体或目录不能作为发布候选。');
    const kind=values.site_kind;if(!['post','note','flow','collection','series','book'].includes(kind))throw Error('网站形态无效。');
    if(['collection','series','book'].includes(kind)&&values.site_role==='index'&&r.fm.type!=='output')throw Error('组织目录页必须为原创成果。');
    if(r.fm.type==='knowledge'&&!['note','post'].includes(kind))throw Error('认知只能准备为认知笔记或文章。');
    if(r.fm.type==='note'&&kind!=='flow')throw Error('速记只能明确准备为随笔。');
    const s=a.slug(values.site_slug),language=a.locale(values.site_locale===undefined?r.fm.site_locale:values.site_locale);if(!a.dateValid(values.site_date))throw Error('日期无效。');
    const all=await records(),id=r.fm.site_id||crypto.randomUUID();
    if(all.some(c=>c.path!==file.path&&c.fm.site_id===id))throw Error('发布身份重复。');
    if(all.some(c=>c.path!==file.path&&c.fm.site_target==='amytis'&&c.fm.site_slug===s&&a.locale(c.fm.site_locale)===language))throw Error('同语言发布网址名称已被其他笔记使用。');
    if(m.entries[id]?.path && (m.entries[id].path.startsWith('content/en/')?'en':'zh')!==language)throw Error('已上传内容不能直接更改发布语言；请另建对应语言版本，保留原有网址。');
    if(m.entries[id]?.live&&r.fm.site_slug!==s)throw Error('已上线网址不能直接改名；请保持原名，或使用明确迁移流程。');
    const patch={site_target:'amytis',site_id:id,site_locale:language,site_kind:kind,site_role:values.site_role||'entry',site_slug:s,site_date:values.site_date,site_body:values.site_body,title:String(values.title||'').trim(),excerpt:String(values.excerpt||''),coverImage:String(values.coverImage||''),tags:system.normalizeTags(values.tags||[]),publish:values.publish===true};
    if(!patch.title)throw Error('标题不能为空。');
    a.publicBody({body:r.body,fm:{...r.fm,...patch}});
    if(patch.site_role==='index') {
      if(kind==='book'){a.outlineLinks(values.site_outline||[]);patch.site_outline=values.site_outline||[];}
      else patch.site_members=values.site_members||[];
    }
    const prospective=all.map(c=>c.path===file.path?{...c,fm:{...c.fm,...patch}}:c);
    const checked=await a.prepare(prospective,{selected:[],manifest:m});
    if(checked.errors.length)throw Error(checked.errors.map(e=>e.message).join('；'));
    if(replacementRaw!==undefined)await app.vault.process(file,raw=>{if(raw!==current)throw Error('正文已被修改，未写入。');return '---\n'+stringifyYaml({...r.fm,...patch}).trimEnd()+'\n---\n'+r.body;});
    else await update(file,patch,current);
    m.entries[id]={...m.entries[id],sourcePath:file.path};await saveManifest(m);return id;
  });}
  async function create(name,folder,values,{chapter=false}={}) {
    if(folder!=='太阳/光球/文章'&&!folder.startsWith('太阳/光球/文章/'))throw Error('原创文章必须在光球/文章内部。');
    if(!system.allowedFolder('output',folder))throw Error('目录不符合成果职责。');
    const a=adapter(await manifest());a.slug(values.site_slug);const language=a.locale(values.site_locale);if(!a.dateValid(values.site_date))throw Error('日期无效。');
    if(await app.vault.adapter.exists(folder+'/'+name+'.md'))throw Error('目录内存在同名笔记，请换一个名称。');
    if((await records()).some(r=>r.fm.site_target==='amytis'&&a.slug(r.fm.site_slug)===a.slug(values.site_slug)&&a.locale(r.fm.site_locale)===language))throw Error('同语言网址名称已经使用。');
    const file=await system.createEntity('output',name,{folder,status:'draft',publish:false,tags:values.tags||[],project:values.project||[]},{open:false});
    const r=parse(await app.vault.read(file));
    // A new chapter stays a draft post until its parent outline is explicitly saved.
    // Writing intent selects its body without prematurely assigning publication ownership.
    const body=system.writingBody(chapter?'book':values.site_kind,values.site_role,language,file.basename);
    await app.vault.modify(file,'---\n'+stringifyYaml(r.fm).trimEnd()+'\n---\n\n'+body);
    try{await register(file,{...values,title:values.title||name,site_body:'marked'},await app.vault.read(file));}
    catch(e){await app.fileManager.trashFile(file);throw e;}
    await app.workspace.getLeaf(false).openFile(file);return file;
  }
  async function preview(selected,{allowMigration=false}={}) {
    const m=await manifest(),rs=await records();
    const result=await adapter(m).prepare(rs,{selected,manifest:m,allowMigration});
    result.sourceHashes={};for(const r of rs.filter(r=>r.fm.site_target==='amytis'))result.sourceHashes[r.path]=await hash(r.raw);
    result.allowMigration=allowMigration;
    result.manifestHash=await hash(JSON.stringify(m));return result;
  }
  async function assertFresh(p,m) {
    if(!p?.valid)throw Error('请先取得无错误预览。');
    if(await hash(JSON.stringify(m))!==p.manifestHash)throw Error('发布清单已经变化，请重新预览。');
    for(const [path,digest]of Object.entries(p.sourceHashes)){const file=app.vault.getAbstractFileByPath(path);if(!file||await hash(await app.vault.read(file))!==digest)throw Error('预览后笔记发生变化，请重新预览：'+path);}
    const now=await adapter(m).prepare(await records(),{selected:p.selected,manifest:m,allowMigration:p.allowMigration});
    const comparable=x=>JSON.stringify({valid:x.valid,files:x.artifacts.map(a=>[a.id,a.path,a.hash]),assets:x.assets.map(a=>[a.path,a.hash])});
    if(comparable(now)!==comparable(p))throw Error('成员关系、引用或附件在预览后发生变化，请重新预览。');
  }
  async function transport() {
    const plugin=app.plugins.plugins['obsidian-mkdocs-publisher'];
    if(!plugin||plugin.manifest.version!=='7.8.2'||plugin.__amytisBridgeVersion!==1)throw Error('Enveloppe 版本补丁未加载，请重载插件后再试。');
    const patchMarker=JSON.parse(await app.vault.adapter.read('宇宙/演化/变更/amytis-implementation.json'));
    const loadedFingerprint=plugin.__amytisLoadedFingerprint;
    if(!loadedFingerprint||loadedFingerprint!==patchMarker.patchedFingerprint||await hash(await app.vault.adapter.read('.obsidian/plugins/obsidian-mkdocs-publisher/main.js'))!==patchMarker.patchedFingerprint)throw Error('插件补丁指纹与加载版本不一致，请检查并重载。');
    const config=plugin.settings;
    if(config.github.user!=='Self-Command'||config.github.repo!=='amytis'||config.github.branch!=='main')throw Error('Enveloppe 目标已变化，拒绝发送。');
    // Runtime and disk must both match the managed policy; credentials are intentionally excluded.
    const disk=JSON.parse(await app.vault.adapter.read('.obsidian/plugins/obsidian-mkdocs-publisher/data.json'));
    for(const rule of contract.settings){const get=o=>rule.pointer.slice(1).split('/').reduce((v,k)=>v?.[k],o);if(JSON.stringify(get(config))!==JSON.stringify(rule.value)||JSON.stringify(get(disk))!==JSON.stringify(rule.value))throw Error('Enveloppe 配置与发布基线不一致，请重载或核查：'+rule.pointer);}
    const client=await plugin.reloadOctokit();
    if(!client?.__amytisOwnedRequest)throw Error('Enveloppe 没有可用的受控 GitHub 客户端。');
    return {config,api:modules.transport({request:(route,p)=>client.__amytisOwnedRequest(route,p),save:saveManifest,encode,decode,blobHash,parseYaml,contract:contract.sourceBlobs,fetchPage:async url=>{try{const r=await obsidian.requestUrl({url:url+'?amytis_verify='+Date.now(),throw:false});return {status:r.status,text:r.text};}catch(e){throw Error('网站页面核验失败：'+e.message);}}})};
  }
  function applyTransaction(m,tx) {
    if(tx.withdraw)return;
    for(const a of tx.artifacts)m.entries[a.id]={...m.entries[a.id],...a,blobSha:tx.blobs[a.id],transaction:tx.id,state:tx.state};
  }
  async function syncDisplay(m,p) {
    const rs=await records();
    for(const r of rs.filter(r=>r.fm.site_target==='amytis'&&r.fm.site_id)) {
      const id=r.fm.site_id,e=m.entries[id],a=p?.artifacts.find(a=>a.id===id),errors=p?.errors.filter(x=>x.path===r.path)||[];
      const transaction=e?.transaction&&m.transactions.find(t=>t.id===e.transaction);if(transaction?.error)errors.push({message:transaction.error});
      let state=!e?.path?'待准备':e.state==='withdrawn'?'已撤稿':e.state==='merged'?'待上线确认':e.state==='uploaded'?'待合并':e.live?(a&&a.hash!==e.liveHash?'待更新':'已上线'):'待上传';
      if(a&&!e?.path)state='待上传';if(errors.length)state='异常';
      const patch={site_state:state,site_error:errors.map(x=>x.message).join('；'),site_url:a?.url||e?.url||'',site_group:a?.group||e?.group||'',site_path:a?.folder||e?.folder||''};
      if(!r.fm.publish&&e?.live&&!['merged','uploaded'].includes(e.state))patch.site_state='已上线（许可关闭）';
      await update(r.file,patch,r.raw);
      if(e)e.sourcePath=r.path;
    }
  }
  async function refreshLocal(){return exclusive('refresh-local',async()=>{const m=await trackedManifest(),p=await adapter(m).prepare(await records(),{manifest:m});await syncDisplay(m,p);await saveManifest(m);return p;});}
  async function publish(p){return exclusive('publish',async()=>{
    const m=await trackedManifest();await assertFresh(p,m);
    if(m.transactions.some(t=>['uploaded','merged'].includes(t.state)))throw Error('存在尚未确认的发布批次，请先刷新或恢复该批次。');
    const {api,config}=await transport();
    try {const tx=await api.publish(p,m,{autoMerge:config.github.automaticallyMergePR});applyTransaction(m,tx);await saveManifest(m);await syncDisplay(m,p);return tx;}
    catch(e){for(const tx of m.transactions.filter(t=>t.state==='uploaded'))applyTransaction(m,tx);await saveManifest(m);throw e;}
  });}
  async function refreshRemote(){return exclusive('refresh-remote',async()=>{
    const m=await trackedManifest(),{api}=await transport();const results=[];
    for(const tx of m.transactions.filter(t=>['uploaded','merged'].includes(t.state))) {
      try {const result=await api.refresh(tx,m);results.push({id:tx.id,...result});
        if(['live','withdrawn'].includes(result.state)){tx.state=result.state;tx.verified=new Date().toISOString();for(const a of tx.artifacts){const e=m.entries[a.id];if(e){e.live=true;e.liveHash=a.hash;e.state='live';e.verified=tx.verified;}}if(tx.withdraw)for(const e of Object.values(m.entries).filter(e=>tx.deletions.includes(e.path))){e.live=false;e.state='withdrawn';}}
        else {tx.state=result.state==='deploy-failed'?'merged':result.state;tx.error=result.state==='deploy-failed'?result.reason:'';}
        applyTransaction(m,tx);await saveManifest(m);
      }catch(e){tx.error=e.message;results.push({id:tx.id,state:'待确认',reason:e.message});await saveManifest(m);}
    }
    const p=await adapter(m).prepare(await records(),{manifest:m});await syncDisplay(m,p);await saveManifest(m);return results;
  });}
  async function resume(){return exclusive('resume',async()=>{const m=await trackedManifest(),{api,config}=await transport();for(const tx of m.transactions.filter(t=>t.state==='uploaded')){await api.resume(tx,m,{autoMerge:config.github.automaticallyMergePR});applyTransaction(m,tx);}await saveManifest(m);await syncDisplay(m);return m.transactions;});}
  async function withdrawPreview(id){
    const m=await trackedManifest(),e=m.entries[id];if(!e?.path)throw Error('没有本流程管理的远端文件。');
    if(m.transactions.some(t=>['uploaded','merged'].includes(t.state)))throw Error('请先确认已有发布批次。');
    const ids=new Set([id]);for(const [child,entry]of Object.entries(m.entries))if(entry.parent===id&&entry.state!=='withdrawn')ids.add(child);
    const deletions=[...ids].map(key=>m.entries[key]?.path).filter(Boolean);
    // Group membership and public incoming links must be removed in a validated update first.
    const rs=await records(),a=adapter(m);for(const r of rs.filter(r=>r.fm.site_target==='amytis'&&r.fm.publish)) {
      if(ids.has(r.fm.site_id))continue;const links=r.fm.site_kind==='book'?a.outlineLinks(r.fm.site_outline||[]):r.fm.site_members||[];
      if(links.some(l=>[...ids].some(key=>resolve(String(l).replace(/^\[\[/,'').replace(/\]\]$/,'').split('|')[0],r.path)===m.entries[key]?.sourcePath)))throw Error('该内容仍被公开目录引用，请先调整目录并发布。');
      const p=await a.prepare(rs,{selected:[r.fm.site_id],manifest:m});if(p.artifacts.filter(x=>x.id===r.fm.site_id).some(x=>[...ids].some(key=>x.content.includes(m.entries[key]?.url||'__missing_public_url__')||x.content.includes('[['+(rs.find(c=>c.fm.site_id===key)?.fm.site_slug||'__none__')+'|'))))throw Error('仍有公开内容引用此笔记，请先更新引用。');
    }
    // Last-published references still matter if a user removed links locally but did not publish that edit.
    const allTx=m.transactions.filter(t=>t.state==='live');for(const tx of allTx)for(const source of tx.artifacts.filter(a=>!ids.has(a.id)&&m.entries[a.id]?.transaction===tx.id))if((source.dependencies||[]).some(key=>ids.has(key)))throw Error('网站当前版本仍有引用，请先发布引用调整。');
    return {ids:[...ids],deletions,manifest:m,manifestHash:await hash(JSON.stringify(m))};
  }
  async function withdraw(id,expected){return exclusive('withdraw',async()=>{
    const p=await withdrawPreview(id),m=p.manifest;if(expected&&(expected.manifestHash!==p.manifestHash||JSON.stringify(expected.deletions)!==JSON.stringify(p.deletions)))throw Error('撤稿范围已变化，请重新确认。');
    const {api,config}=await transport();return api.publish({valid:true,errors:[],artifacts:[],assets:[],deletions:p.deletions},m,{autoMerge:config.github.automaticallyMergePR,withdraw:true});
  });}
  async function validatePublished(file){
    const m=await manifest(),r=parse(await app.vault.read(file)),entry=m.entries[r.fm.site_id];
    if(!entry?.live)throw Error('尚未验证对应页面上线，不能标记成果已发布。');
    const p=await adapter(m).prepare(await records(),{selected:[r.fm.site_id],manifest:m});
    if(!p.valid||p.artifacts.find(a=>a.id===r.fm.site_id)?.hash!==entry.liveHash)throw Error('当前版本尚未上线，请先发布更新。');
    if(r.fm.type!=='output')throw Error('其他实体保留原业务状态，无须标记成果已发布。');
    return true;
  }
  app.__amytisValidatePublished=validatePublished;
  async function confirmPublished(file){return exclusive('confirm-published',async()=>{await validatePublished(file);return system.executeAction(file,'published');});}
  return {records,parse,manifest,register,create,preview,publish,refreshLocal,refreshRemote,resume,withdrawPreview,withdraw,confirmPublished,adapter,hash,resolve};
};
