/* Amytis contract adapter. Pure, no vault/network writes; API dependencies are injected. */
module.exports = function publishAdapter(deps = {}) {
  const TARGET = 'amytis', BEGIN = '<!-- amytis:public:start -->', END = '<!-- amytis:public:end -->';
  const kinds = ['post','note','flow','collection','series','book'];
  const baseUrl = 'https://self-command.github.io/amytis';
  const reserved = new Set(['index','README','posts','series','books','flows','tags','authors','archive','notes','graph','search','page','api','en','zh']);
  const mdLabel=s=>String(s).replace(/[\\[\]]/g,'\\$&');
  const hash = deps.hash || (async value => {
    const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
    return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  });
  const dateValid = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(new Date(s+'T12:00:00Z').getTime()) && new Date(s+'T12:00:00Z').toISOString().slice(0,10) === s;
  // Existing registrations predate language selection and belong to the default tree.
  function locale(value) {
    const language = value === undefined ? 'zh' : value;
    if(!['zh','en'].includes(language))throw Error('发布语言无效，只支持中文（zh）和英文（en）。');
    return language;
  }
  function slug(value) {
    if(typeof value !== 'string' || !value.trim() || value !== value.trim() || /[\\/:*?"<>|\[\]#%\u0000-\u0020]/.test(value) || /[. ]$/.test(value) || ['.','..'].includes(value) || /^\d{4}-\d{2}-\d{2}-/.test(value)) throw Error('网址名称无效；不允许路径、空白、日期文件名前缀或保留字符。');
    if(reserved.has(value) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)) throw Error('网址名称与网站入口或保留名冲突。');
    return value.normalize('NFC');
  }
  function publicBody(record) {
    const body = record.body || '', mode = record.fm.site_body;
    if(mode === 'whole') return body;
    if(mode !== 'marked') throw Error('请明确选择整篇正文或公开标记区间。');
    if(body.split(BEGIN).length !== 2 || body.split(END).length !== 2 || body.indexOf(END) < body.indexOf(BEGIN)) throw Error('公开正文必须有且只有一对起止标记。');
    return body.slice(body.indexOf(BEGIN)+BEGIN.length, body.indexOf(END)).trim();
  }
  const outlineLinks = nodes => {
    if(!Array.isArray(nodes)) throw Error('书籍大纲必须是列表。');
    return nodes.flatMap(n => {
      if(n && typeof n.section === 'string' && n.section.trim() && Array.isArray(n.items)) return outlineLinks(n.items);
      if(n && typeof n.link === 'string') return [n.link];
      throw Error('大纲项必须是分组或真实章节链接。');
    });
  };
  // Preserve fenced/inline code byte-for-byte. Unsupported Markdown is rejected, never guessed away.
  function shield(text) {
    const saved=[]; let fence=null;
    const lines=text.split(/(?<=\n)/), out=[];
    for(const line of lines) {
      const m=/^ {0,3}(`{3,}|~{3,})(.*)/.exec(line);
      if(fence) { fence.text+=line;if(m && m[1][0]===fence.char && m[1].length>=fence.len && !m[2].trim()){saved.push(fence.text);out.push('\u0000'+(saved.length-1)+'\u0000');fence=null;} }
      else if(m) {if(/^(dataview(?:js)?|base|canvas)\b/i.test(m[2].trim()))throw Error('公开正文包含动态查询，请先静态导出。');fence={char:m[1][0],len:m[1].length,text:line};}
      else out.push(line);
    }
    if(fence)throw Error('公开正文有未闭合代码块。');
    const masked=out.join('').replace(/(`+)([\s\S]*?)\1/g,m=>{saved.push(m);return '\u0000'+(saved.length-1)+'\u0000';});
    return {text:masked,restore:s=>s.replace(/\u0000(\d+)\u0000/g,(_,i)=>saved[Number(i)])};
  }
  function headingIds(body) {
    const seen=new Map(), map=new Map();
    for(const m of shield(body).text.matchAll(/^ {0,3}#{1,6}\s+(.+?)\s*#*$/gm)) {
      const title=m[1].trim();
      // Complex inline Markdown may produce a different rehype-slug. Reject rather than fabricate an anchor.
      if(!/^[\p{L}\p{N}\p{M}\s_-]+$/u.test(title))continue;
      const key=title.toLowerCase().replace(/[^\p{L}\p{N}\p{M}\s_-]/gu,'').replace(/\s/g,'-');
      const count=seen.get(key)||0;seen.set(key,count+1);if(!map.has(title))map.set(title,key+(count?'-'+count:''));
    }
    return map;
  }
  function eligible(r) {
    const fm=r.fm, folder=r.path.split('/').slice(0,-1).join('/');
    if(!['output','knowledge','record','journal','note'].includes(fm.type)) return false;
    if(fm.source && !['manual','book'].includes(fm.source)) return false;
    if(/^黑洞\//.test(r.path))return fm.site_target===TARGET && Boolean(fm.site_id) && deps.isKnown?.(fm.site_id)===true;
    if(deps.allowedFolder && !deps.allowedFolder(fm.type,folder))return false;
    if(fm.type==='output')return folder==='太阳/光球/文章'||folder.startsWith('太阳/光球/文章/');
    if(fm.type==='knowledge')return folder==='月亮/满月'||folder.startsWith('月亮/满月/');
    if(['record','journal'].includes(fm.type))return folder.startsWith('地球/地层/');
    return folder.startsWith('星云/分子云/');
  }
  async function prepare(records, options={}) {
    const errors=[],warnings=[],assets=new Map(), byPath=new Map(records.map(r=>[r.path,r])), byId=new Map(), parents=new Map(), memberMap=new Map(), mapped=new Map();
    const error=(r,message)=>errors.push({path:r?.path||'',message});
    const resolve=(link,source) => {
      const raw=String(link).replace(/^\[\[/,'').replace(/\]\]$/,'').split('|')[0];
      const path=deps.resolve?.(raw,source.path) || (byPath.has(raw)?raw:byPath.has(raw+'.md')?raw+'.md':null);
      return path?byPath.get(path):null;
    };
    for(const r of records.filter(r=>r.fm.site_target===TARGET)) {
      if(!r.fm.site_id){error(r,'缺少稳定发布身份，请先准备发布。');continue;}
      if(byId.has(r.fm.site_id))error(r,'site_id 重复，不能克隆已登记身份。');else byId.set(r.fm.site_id,r);
    }
    for(const r of byId.values()) {
      if(r.fm.site_role!=='index')continue;
      try {
        const links=r.fm.site_kind==='book'?outlineLinks(r.fm.site_outline||[]):r.fm.site_members||[];
        if(!Array.isArray(links))throw Error('成员必须是有序链接列表。');
        const seen=new Set(), members=[];
        for(const link of links) {
          const child=resolve(link,r);
          if(!child){error(r,'组织成员不存在：'+link);continue;}
          if(!child.fm.site_id || child.fm.site_target!==TARGET){error(r,'成员尚未登记 Amytis：'+link);continue;}
          if(locale(child.fm.site_locale)!==locale(r.fm.site_locale)){error(r,'组织目录与成员必须使用相同发布语言：'+link);continue;}
          if(seen.has(child.fm.site_id)){error(r,'组织成员重复：'+link);continue;}seen.add(child.fm.site_id);members.push(child);
          if(r.fm.site_kind==='collection') {
            if(!((child.fm.site_kind==='post'&&child.fm.site_role==='entry')||(child.fm.site_kind==='series'&&child.fm.site_role==='index')))error(r,'专题成员仅支持文章或系列；其他形态请在正文链接。');
          } else {
            if(child.fm.type!=='output'||child.fm.site_role!=='entry'||!['post',r.fm.site_kind].includes(child.fm.site_kind)){error(r,'系列或书籍成员必须为原创成果文章／章节。');continue;}
            if(parents.has(child.fm.site_id))error(r,'成员存在多个主归属：'+link);else parents.set(child.fm.site_id,r);
          }
        }
        memberMap.set(r.fm.site_id,members);
      }catch(e){error(r,e.message);}
    }
    const selected=new Set(options.selected || [...byId.keys()].filter(id=>byId.get(id).fm.publish===true));
    let changed=true;while(changed){changed=false;for(const id of [...selected]) {
      const parent=parents.get(id);if(parent&&!selected.has(parent.fm.site_id)){selected.add(parent.fm.site_id);changed=true;}
      for(const member of memberMap.get(id)||[])if(member.fm.publish===true&&!selected.has(member.fm.site_id)){selected.add(member.fm.site_id);changed=true;}
    }}
    const registry=new Map(),paths=new Map(),urls=new Map();
    for(const r of byId.values()) {
      try {
        const f=r.fm, s=slug(f.site_slug), k=f.site_kind, index=f.site_role==='index', parent=parents.get(f.site_id),language=locale(f.site_locale);
        if(!kinds.includes(k)||!['index','entry'].includes(f.site_role))throw Error('网站形态或角色无效。');
        if(index&&!['collection','series','book'].includes(k))throw Error('此形态不能作为组织目录页。');
        if(!index&&['collection','series','book'].includes(k)&&!parent)throw Error('系列／书籍成员缺少主目录归属。');
        if(k==='flow'&&!dateValid(f.site_date))throw Error('随笔日期无效。');
        const ps=parent?slug(parent.fm.site_slug):'', group=parent?.fm.site_kind;
        let folder,filename=s+'.md',route;
        if(index){folder=(k==='book'?'books/':'series/')+s;filename='index.md';route=(k==='book'?'/books/':'/series/')+s;}
        else if(group==='book'){folder='books/'+ps;route='/books/'+ps+'/'+s;}
        else if(group==='series'){folder='series/'+ps;route='/'+ps+'/'+s;}
        else if(k==='flow'){folder='flows/'+f.site_date.slice(0,4)+'/'+f.site_date.slice(5,7);filename=f.site_date.slice(8,10)+'.md';route='/flows/'+f.site_date.replaceAll('-','/');}
        else {folder=k==='note'?'notes':'posts';route='/'+folder+'/'+s;}
        const prefix=language==='en'?'en/':'';
        folder=prefix+folder;route='/'+prefix+route.slice(1);
        const path='content/'+folder+'/'+filename,url=baseUrl+'/'+route.slice(1).split('/').map(encodeURIComponent).join('/')+'/';
        const keys=[k==='flow'?f.site_date.replaceAll('-','/'):s,...(k==='note'&&Array.isArray(f.aliases)?f.aliases:[])];
        for(const key of keys){const qualified=language+':'+key;if(registry.has(qualified)&&registry.get(qualified)!==r)throw Error('同语言网址名称／别名重复：'+key);registry.set(qualified,r);}
        if(paths.has(path))throw Error('远端文件冲突：'+path);paths.set(path,r);
        if(urls.has(url))throw Error('规范网址冲突：'+url);urls.set(url,r);
        mapped.set(f.site_id,{record:r,id:f.site_id,path,folder,url,route,locale:language,group:parent?.fm.title||'',parent:parent?.fm.site_id,registryKey:keys[0],book:group==='book'||k==='book'});
      }catch(e){error(r,e.message);}
    }
    async function asset(target,source) {
      const resolved=deps.resolveAsset?.(target,source.path);
      if(!resolved || !resolved.startsWith('星云/星尘/附件/') || /\.(md|base|canvas|epub)$/i.test(resolved) || resolved.includes('/附件/书籍/'))throw Error('附件目标不存在或不允许公开：'+target);
      const bytes=await deps.readBinary(resolved), digest=await hash(bytes), ext=resolved.split('.').pop().toLowerCase();
      if(!/^[a-z0-9]+$/.test(ext))throw Error('附件扩展名无效。');
      const path='public/assets/'+digest+'.'+ext;
      if(!assets.has(path))assets.set(path,{path,bytes,hash:digest,source:resolved});
      return '/amytis/assets/'+digest+'.'+ext;
    }
    const artifacts=[];
    for(const id of selected) {
      const item=mapped.get(id),r=byId.get(id);if(!r){error(null,'选中的发布身份不存在：'+id);continue;}if(!item)continue;
      try {
        const f=r.fm;
        if(f.publish!==true)throw Error('当前内容或主目录未获公开许可。');
        if(!eligible(r))throw Error('实体／目录不具备公开资格。');
        if(!dateValid(f.site_date))throw Error('展示日期无效。');
        if(typeof f.title!=='string'||!f.title.trim())throw Error('公开标题不能为空。');
        if(!Array.isArray(f.tags)||f.tags.some(t=>typeof t!=='string'||t.startsWith('route/')))throw Error('必须使用原生 tags 列表。');
        const fm={title:f.title,date:f.site_date,tags:[...f.tags],draft:false};
        for(const key of ['excerpt','subtitle','category'])if(typeof f[key]==='string'&&f[key].trim())fm[key]=f[key];
        if(kinds.includes(f.site_kind)&&f.site_kind==='note'&&Array.isArray(f.aliases))fm.aliases=[...f.aliases];
        if(Array.isArray(f.authors)&&f.authors.every(a=>typeof a==='string'))fm.authors=[...f.authors];
        if(f.coverImage){if(/^https?:\/\//.test(f.coverImage))fm.coverImage=f.coverImage;else fm.coverImage=await asset(String(f.coverImage).replace(/^!?(?:\[\[)/,'').replace(/\]\]$/,''),r);}
        if(item.parent && byId.get(item.parent).fm.site_kind==='series')fm.series=byId.get(item.parent).fm.site_slug;
        const approved=(memberMap.get(id)||[]).filter(c=>c.fm.publish===true);
        const dependencies=new Set(approved.map(c=>c.fm.site_id));if(item.parent)dependencies.add(item.parent);
        for(const c of (memberMap.get(id)||[]).filter(c=>c.fm.publish!==true))warnings.push({path:r.path,message:'本次不公开成员：'+c.path});
        if(f.site_role==='index') {
          if(!approved.length)throw Error('目录至少需要一个获准的成员。');
          if(f.site_kind==='collection'){fm.type='collection';fm.items=approved.map(c=>c.fm.site_kind==='series'?{series:c.fm.site_slug}:{post:c.fm.site_slug});}
          if(f.site_kind==='series'){fm.sort='manual';fm.posts=approved.map(c=>c.fm.site_slug);}
          if(f.site_kind==='book') {
            const convert=nodes=>nodes.flatMap(n=>{
              if(n.section){const items=convert(n.items);return items.length?[{section:n.section,items}]:[];}
              const child=resolve(n.link,r);return child?.fm.publish===true?[{title:child.fm.title,id:child.fm.site_slug}]:[];
            });fm.chapters=convert(f.site_outline||[]);
          }
        }
        const previous=options.manifest?.entries?.[id],migrating=previous?.path&&previous.path!==item.path;
        if(previous?.path && (previous.path.startsWith('content/en/')?'en':'zh')!==item.locale)throw Error('已上传内容不能直接更改发布语言；请另建对应语言版本，保留原有网址。');
        if(migrating){
          if(item.book || previous.book)throw Error('书籍网址迁移不具备已验证重定向支持，请撤稿后明确重新登记。');
          if(!options.allowMigration)throw Error('已发布路径发生变化；请预览并确认网址迁移。');
        }
        if(previous?.redirectFrom?.length)fm.redirectFrom=[...previous.redirectFrom];
        if(migrating){fm.redirectFrom=[...new Set([...(fm.redirectFrom||[]),previous.route])];}
        let body=publicBody(r), code=shield(body);
        const indexPage=f.site_role==='index'&&['collection','series'].includes(f.site_kind);
        if(indexPage&&body.replace(/^ {0,3}#\s+[^\n]*\n?/,'').trim())throw Error('Amytis 专题／系列目录不渲染正文；请把介绍填入摘要，长文另建成员文章。');
        if(/<(?:script|iframe|img|audio|video|source|object|embed)\b|javascript:|!\[[^\]]*\]\[[^\]]*\]|^ {0,3}\[[^\]]+\]:/im.test(code.text))throw Error('公开正文包含未支持的活动内容、HTML 媒体或引用式链接，请改为普通 Markdown。');
        async function link(target,label,embed) {
          const [raw,anchor]=target.split('#');
          const child=resolve(raw,r), ci=child&&mapped.get(child.fm.site_id);
          if(!child || !ci) {
            if(embed || /\.[a-z0-9]+$/i.test(raw)){const url=await asset(raw,r);return embed&&/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(raw)?'!['+mdLabel(label||'')+']('+url+')':'['+mdLabel(label||raw)+']('+url+')';}
            throw Error('链接目标未登记公开：'+target);
          }
          if(embed)throw Error('笔记嵌入须先静态展开：'+target);
          const live=options.manifest?.entries?.[ci.id]?.live;
          if(child.fm.publish!==true || (!selected.has(ci.id)&&!live))throw Error('引用目标尚未公开或未纳入本次预览：'+target);
          dependencies.add(ci.id);
          if(anchor) {
            const targetBody=publicBody(child);let fragment;
            if(anchor.startsWith('^')){if(!new RegExp('\\^'+anchor.slice(1).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:\\s|$)').test(targetBody))throw Error('块引用不存在：'+target);fragment='block-'+anchor.slice(1);}
            else {fragment=headingIds(targetBody).get(anchor);if(!fragment)throw Error('标题锚点无法验证：'+target);}
            return '['+(label||child.fm.title)+']('+ci.url+'#'+encodeURIComponent(fragment)+')';
          }
          if(ci.book||ci.locale!==item.locale)return '['+mdLabel(label||child.fm.title)+']('+ci.url+')';
          // The pinned remark-wikilinks emits root URLs without deployment basePath.
          // A visible canonical link + non-rendered native reference preserves both navigation and indexes.
          const display=label||child.fm.title,reference=String(display).replace(/--/g,'—').replace(/[\[\]|<>]/g,'');
          return '['+mdLabel(display)+']('+ci.url+')<!-- [['+ci.registryKey+'|'+reference+']] -->';
        }
        // Sequential replacements make asset collection and diagnostics deterministic.
        const tokens=/!?\[\[([^\]]+)\]\]|!?\[([^\]\n]*)\]\(([^)\n]+)\)/g;let converted='',at=0;
        for(const m of code.text.matchAll(tokens)){
          converted+=code.text.slice(at,m.index);at=m.index+m[0].length;
          if(m[1]!==undefined){const [target,...label]=m[1].split('|');converted+=await link(target,label.join('|'),m[0].startsWith('!'));}
          else {let target=m[3].trim();if(/^https?:\/\/|^mailto:|^#/.test(target))converted+=m[0];else{try{target=decodeURIComponent(target.replace(/^<|>$/g,''));}catch{}converted+=await link(target,m[2],m[0].startsWith('!'));}}
        }
        converted+=code.text.slice(at);
        if(/\[\[|\]\([^)]*$/.test(converted.replace(/\[\[[^\]]+\]\]/g,'')))throw Error('正文有未解析的链接语法。');
        converted=converted.replace(/\s\^([\w-]+)\s*$/gm,(_,block)=>' <span id="block-'+block+'"></span>');
        body=code.restore(converted);
        if(f.latex===true||/\$\$|(?:^|[^\\])\$[^$\n]+\$/m.test(code.text))fm.latex=true;
        if(item.book){const permitted=new Set(f.site_role==='index'?['title','date','excerpt','coverImage','authors','draft','latex','chapters']:['title','excerpt','draft','latex']);for(const key of Object.keys(fm))if(!permitted.has(key))delete fm[key];}
        const payload='---\n'+JSON.stringify(fm,null,2)+'\n---\n\n'+body.trim()+'\n';
        const stamp=await hash(payload);
        const content=payload+'\n<span hidden data-amytis-export="'+stamp+'"></span>\n';
        let verification;
        if(indexPage){
          const metadata={exportStamp:stamp,title:fm.title,url:item.url,members:approved.flatMap(c=>c.fm.site_kind==='series'?(memberMap.get(c.fm.site_id)||[]).filter(x=>x.fm.publish===true).map(x=>mapped.get(x.fm.site_id)?.url):[mapped.get(c.fm.site_id)?.url]).filter(Boolean)};
          const bytes=new TextEncoder().encode(JSON.stringify(metadata)+'\n'),digest=await hash(bytes),path='public/assets/'+digest+'.json';
          assets.set(path,{path,bytes,hash:digest,source:'Amytis 目录上线校验文件（公开字段）'});
          verification={url:baseUrl+'/assets/'+digest+'.json',stamp,title:fm.title,members:metadata.members.slice(0,5),excerpt:fm.excerpt||''};
        }
        artifacts.push({...item,record:undefined,content,stamp,verification,hash:await hash(content),dependencies:[...dependencies],redirectFrom:fm.redirectFrom||[],oldPath:migrating?previous.path:null});
      }catch(e){error(r,e.message);}
    }
    return {target:TARGET,artifacts,assets:[...assets.values()],errors,warnings,selected:[...selected],valid:errors.length===0};
  }
  return {prepare,eligible,slug,dateValid,locale,publicBody,outlineLinks,hash,BEGIN,END,baseUrl};
};
