import fs from 'node:fs';
import path from 'node:path';
import { bytesHash, notePath, within, safeTarget, fingerprint } from '../domain/identity.js';
import { splitNote } from '../templates/markdown.js';
import { CosmosError } from '../errors.js';
import type { Dependency, Plan } from '../workflows/types.js';
import { taskEnvironment } from '../domain/tasks.js';
export class Context {
  dependencies: Dependency[] = [];
  schema: any;
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
  async relation(reference: string, type: string) {
    const raw = reference.replace(/^\[\[/, '').replace(/\]\]$/, '').replace(/\.md$/, '');
    if (/[|#]/.test(raw)) throw new CosmosError('INVALID_INPUT', '关系需要笔记标识，不能带显示文字或章节。');
    const candidates = raw.includes('/') ? [raw + '.md'].filter(p => this.app.vault.getAbstractFileByPath(p)) : this.app.vault.getMarkdownFiles().filter((f: any) => f.basename === raw).map((f: any) => f.path);
    const valid: string[] = [];
    for (const candidate of candidates) { const note = splitNote(await this.read(candidate)); if (note.properties.type === type) valid.push(candidate); }
    if (valid.length !== 1) throw new CosmosError(valid.length ? 'TARGET_AMBIGUOUS' : 'TARGET_MISSING', '关系目标需要唯一且符合类型。', { type, candidates: valid });
    return '[[' + valid[0]!.replace(/\.md$/, '') + ']]';
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
  }
}
