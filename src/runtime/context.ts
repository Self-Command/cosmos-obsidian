import fs from 'node:fs';
import path from 'node:path';
import { bytesHash, notePath, within, safeTarget, fingerprint } from '../domain/identity.js';
import { splitNote } from '../templates/markdown.js';
import { CosmosError } from '../errors.js';
import type { Dependency, Plan } from '../workflows/types.js';
import { taskEnvironment } from '../domain/tasks.js';
import { periodEnvironment, periodNames } from '../domain/periods.js';
export class Context {
  dependencies: Dependency[] = [];
  schema: any;
  proposed = new Map<string, { type: string }>();
  renamed = new Map<string,string>();
  environment: Plan['environment'] = {};
  executionId?:string;
  bindingId?:string;
  stateRoot?:string;
  constructor(public app: any, public vaultPath: string, public schemaPath: string, public templateFolder = '宇宙/创世/模板') {}
  async read(relative: string) {
    const target = await safeTarget(this.vaultPath, relative);
    const bytes = fs.readFileSync(target, 'utf8');
    this.depend({ path: relative, hash: bytesHash(bytes), kind: 'file' });
    return bytes;
  }
  depend(value: Dependency) { if (!this.dependencies.some(x => x.path === value.path)) this.dependencies.push(value); }
  async target(relative: string, absent = true) {
    const target = await safeTarget(this.vaultPath, relative);
    if (absent && (fs.existsSync(target) || this.app.vault.getAbstractFileByPath(relative))) throw new CosmosError('TARGET_EXISTS', '目标已存在，不能覆盖或自动改名。', { path: relative });
    if (absent) this.depend({ path: relative, hash: null, kind: 'absent' });
    const folder = path.posix.dirname(relative), folderPath = await safeTarget(this.vaultPath, folder);
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) throw new CosmosError('TARGET_MISSING', '目标目录不存在；需在方案中明确创建目录。', { path: folder });
    this.depend({ path: folder, hash: null, kind: 'directory' });
    return target;
  }
  async rules() {
    this.schema = JSON.parse(await this.read(this.schemaPath));
    if (this.schema.version !== 3 || !this.schema.entities || !this.schema.common || !Array.isArray(this.schema.actions)) throw new CosmosError('CAPABILITY_MISSING', '知识库规则契约不兼容。', {}, 3);
    return this.schema;
  }
  allowed(entity: string, folder: string) {
    notePath(folder); const e = this.schema.entities[entity];
    const stage = folder.split('/').slice(0, 2).join('/'), child = folder.split('/')[2], registered = this.schema.stageCategories?.[stage];
    if (!e || !e.folders?.some((root: string) => folder === root || e.allowSubfolders !== false && folder.startsWith(root + '/')) || registered && child && !registered.includes(child)) throw new CosmosError('INVALID_DIRECTORY', '目录不符合已登记实体或分类。', { entity, folder });
  }
  tasknotes(capability = 'tasks.read') {
    const plugin = this.app.plugins.plugins.tasknotes, api = plugin?.api;
    if (api?.apiVersion !== 1 || !api.hasCapability(capability)) throw new CosmosError('CAPABILITY_MISSING', '需要 TaskNotes runtime API v1 的相应能力。', { capability }, 3);
    return { plugin, api, settings: api.settings.snapshot() };
  }
  periodic(period?: string) {
    const plugin = this.app.plugins.plugins['periodic-notes'];
    if (!plugin?.settings || plugin.settings.subscribe || !Object.values(periodNames).every(k => plugin.settings[k] && typeof plugin.settings[k].enabled === 'boolean')) throw new CosmosError('CAPABILITY_MISSING', '需要经验证的 Periodic Notes 设置契约。', {}, 3);
    if (period && !plugin.settings[periodNames[period]!]?.enabled) throw new CosmosError('CAPABILITY_MISSING', '此周期未启用。', { period }, 3);
    return plugin;
  }
  async relation(reference: string, type: string) {
    const raw = reference.replace(/^\[\[/, '').replace(/\]\]$/, '').replace(/\.md$/, '');
    if (/[|#]/.test(raw)) throw new CosmosError('INVALID_INPUT', '关系需要笔记标识，不能带显示文字或章节。');
    const candidates = raw.includes('/') ? [raw + '.md'].filter(p => this.app.vault.getAbstractFileByPath(p) || this.proposed.has(p)) : [...new Set([...this.app.vault.getMarkdownFiles().filter((f: any) => f.basename === raw).map((f: any) => f.path), ...[...this.proposed.keys()].filter(p => path.posix.basename(p,'.md') === raw)])];
    const valid: string[] = [];
    for (const candidate of candidates) { const proposed = this.proposed.get(candidate); if (proposed ? proposed.type === type : splitNote(await this.read(candidate)).properties.type === type) valid.push(candidate); }
    if (valid.length !== 1) throw new CosmosError(valid.length ? 'TARGET_AMBIGUOUS' : 'TARGET_MISSING', '关系目标需要唯一且符合类型。', { type, candidates: valid });
    return '[[' + (this.renamed.get(valid[0]!) ?? valid[0]!).replace(/\.md$/, '') + ']]';
  }
  async system() {
    if (!this.schema) await this.rules();
    const relative = this.schema.scriptFolder + '/lib/system-engine.cjs';
    await this.read(relative); const absolute = await safeTarget(this.vaultPath, relative);
    delete require.cache[require.resolve(absolute)];
    const factory = require(absolute);
    if (typeof factory !== 'function') throw new CosmosError('CAPABILITY_MISSING', '当前业务服务没有工厂入口。', {}, 3);
    const system = factory(this.app, this.schema);
    for (const name of ['availableActions','archiveEligibility','executeAction','normalizeValues','supplementBody','bodySections']) if (typeof system[name] !== 'function') throw new CosmosError('CAPABILITY_MISSING', '当前业务服务契约不兼容。', { capability: name }, 3);
    return system;
  }
  async metadata(file: any, properties: Record<string,any>) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const cached = { ...this.app.metadataCache.getFileCache(file)?.frontmatter }; delete cached.position;
      if (fingerprint(cached) === fingerprint(properties)) return;
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    throw new CosmosError('CAPABILITY_MISSING', '实际属性缓存尚未与文件一致，未调用业务服务。', {}, 3);
  }
  linkEnvironment() {
    const configFile = path.join(this.vaultPath, '.obsidian', 'app.json');
    const settings = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : {};
    return { alwaysUpdateLinks: settings.alwaysUpdateLinks ?? false, useMarkdownLinks: settings.useMarkdownLinks ?? false, newLinkFormat: settings.newLinkFormat ?? 'shortest' };
  }
  async renameScope(source: string, destination: string) {
    const settings = this.linkEnvironment(), links: { path: string; count: number; originalLinks: string[] }[] = [];
    for (const [filePath, targets] of Object.entries(this.app.metadataCache.resolvedLinks ?? {}) as [string,Record<string,number>][]) {
      if (!targets[source]) continue;
      if (filePath === source) throw new CosmosError('CAPABILITY_MISSING', '此文件含指向自身的引用，需要单独审阅引用改写。', {}, 3);
      if (!settings.alwaysUpdateLinks) throw new CosmosError('CAPABILITY_MISSING', '当前设置不允许自动更新已有引用，尚未生成可验证改名方案。', {}, 3);
      const file = this.app.vault.getAbstractFileByPath(filePath), cache = this.app.metadataCache.getFileCache(file);
      const entries = [...(cache?.links ?? []), ...(cache?.embeds ?? []), ...(cache?.frontmatterLinks ?? [])];
      const originalLinks = entries.filter(x => this.app.metadataCache.getFirstLinkpathDest(x.link.split('#')[0], filePath)?.path === source).map(x => x.link);
      await this.read(filePath); links.push({ path: filePath, count: targets[source]!, originalLinks });
    }
    this.environment.links = fingerprint(settings);
    return links;
  }
  async verifyRenamedLinks(step: any) {
    if (!step.data.links?.length) return [];
    const deadline = Date.now() + 5000;
    let differences: string[] = [];
    while (Date.now() < deadline) {
      differences = step.data.links.filter((link:any) => (this.app.metadataCache.resolvedLinks?.[link.path]?.[step.path] ?? 0) < link.count || this.app.metadataCache.resolvedLinks?.[link.path]?.[step.source]).map((link:any) => 'link target differs: ' + link.path);
      if (!differences.length) break;
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    return differences;
  }
  async assertFresh(plan: Plan) {
    if (plan.version !== 1 || !Array.isArray(plan.steps)) throw new CosmosError('INVALID_INPUT', '执行方案不兼容。');
    for (const dep of plan.dependencies) {
      const target = await safeTarget(this.vaultPath, dep.path);
      if (dep.kind === 'absent' && fs.existsSync(target)) throw new CosmosError('REVIEW_STALE', '目标已被创建，需要新预览。', { path: dep.path });
      if (dep.kind === 'directory' && (!fs.existsSync(target) || !fs.statSync(target).isDirectory())) throw new CosmosError('REVIEW_STALE', '依赖目录已变化。', { path: dep.path });
      if (dep.kind === 'file' && (!fs.existsSync(target) || bytesHash(fs.readFileSync(target)) !== dep.hash)) throw new CosmosError('REVIEW_STALE', '相关来源、规则或模板已变化。', { path: dep.path });
    }
    if (plan.environment.tasknotes) { const { plugin, api, settings } = this.tasknotes(); if (taskEnvironment(api, settings, plugin.manifest.version) !== plan.environment.tasknotes) throw new CosmosError('REVIEW_STALE', 'TaskNotes 的字段、默认值或版本已变化。'); }
    if (plan.environment.periodic && periodEnvironment(this.periodic()) !== plan.environment.periodic) throw new CosmosError('REVIEW_STALE', '周期插件版本或设置已变化。');
    if (plan.environment.links && fingerprint(this.linkEnvironment()) !== plan.environment.links) throw new CosmosError('REVIEW_STALE', 'Obsidian 链接更新设置已变化。');
    if (plan.environment.publication || plan.environment.publicationDisk) {
      const {publicationEnvironment,policyDisk}=await import('./publication.js');
      if(publicationEnvironment(this.app)!==plan.environment.publication||await policyDisk(this)!==plan.environment.publicationDisk)throw new CosmosError('REVIEW_STALE','发布客户端或目标政策已变化。');
    }
    if(plan.environment.publicationCatalog&&(await (await import('./publication.js')).publicationCatalog(this))!==plan.environment.publicationCatalog)throw new CosmosError('REVIEW_STALE','发布身份、语言或组织登记已变化。');
  }
}
