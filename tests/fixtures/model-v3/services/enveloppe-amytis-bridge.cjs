/* Appended to the pinned Enveloppe bundle by apply-amytis.mjs. No publishing on load. */
/* AMYTIS_OWNED_BRIDGE_V1 */
{
  const api=require('obsidian');
  const bridgeOpen=async plugin=>{
    if(!plugin?.app)throw Error('无法解析 Enveloppe 发布上下文。');
    const mod={exports:{}};
    new Function('module','exports',await plugin.app.vault.adapter.read('宇宙/演化/脚本/amytis-quickadd.js'))(mod,mod.exports);
    return mod.exports({app:plugin.app,obsidian:api});
  };
  const findPlugin=args=>args.find(a=>a?.manifest?.id==='obsidian-mkdocs-publisher')||args.find(a=>a?.plugin?.manifest?.id==='obsidian-mkdocs-publisher')?.plugin;
  // Command/menu callbacks close over these functions; replace them before onload registers any command.
  shareOneNote=async(...args)=>bridgeOpen(findPlugin(args));
  shareAllMarkedNotes=async(...args)=>bridgeOpen(findPlugin(args));
  shareAllEditedNotes=async(...args)=>bridgeOpen(findPlugin(args));
  shareEditedOnly=async(...args)=>bridgeOpen(findPlugin(args));
  shareOnlyEdited=async(...args)=>bridgeOpen(findPlugin(args));
  shareNewNote=async(...args)=>bridgeOpen(findPlugin(args));
  shareActiveFile=async(...args)=>bridgeOpen(findPlugin(args));
  shareFolderRepo=async(...args)=>bridgeOpen(findPlugin(args));
  purge=async(...args)=>bridgeOpen(findPlugin(args));
  const stop=async()=>{throw Error('此 Enveloppe 写入入口由 Amytis 发布预检接管，请使用「Amytis：写作与发布」。');};
  for(const name of ['newBranch','newBranchOnRepo','updateRepository','updateRepositoryOnOne'])GithubBranch.prototype[name]=stop;
  for(const name of ['publish','uploadText','uploadBinary','uploadOnMultipleRepo'])Publisher.prototype[name]=stop;
  const originalLoad=Enveloppe.prototype.onload,originalReload=Enveloppe.prototype.reloadOctokit;
  Enveloppe.prototype.reloadOctokit=async function(...args){
    const publisher=await originalReload.apply(this,args),request=publisher.octokit.request.bind(publisher.octokit);
    // Only the owned transport receives the unrestricted request closure; native requests stay read-only.
    publisher.__amytisOwnedRequest=request;
    const guarded=async(route,params)=>{
      const method=typeof route==='string'?route.split(' ')[0]:route?.method||'GET';
      if(!['GET','HEAD','OPTIONS'].includes(method.toUpperCase()))throw Error('原生 Enveloppe 写入已禁用，请先执行 Amytis 预检。');
      return request(route,params);
    };
    Object.assign(guarded,publisher.octokit.request);publisher.octokit.request=guarded;return publisher;
  };
  Enveloppe.prototype.onload=async function(...args){
    this.__amytisBridgeVersion=1;
    const bytes=new TextEncoder().encode(await this.app.vault.adapter.read('.obsidian/plugins/obsidian-mkdocs-publisher/main.js'));
    this.__amytisLoadedFingerprint=[...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
    await originalLoad.apply(this,args);
    this.addCommand({id:'amytis-writing-publishing',name:'Amytis：写作与发布',callback:()=>bridgeOpen(this)});
  };
}
