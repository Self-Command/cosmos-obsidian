import fs from 'node:fs';
import path from 'node:path';
import { fingerprint } from '../domain/identity.js';
import { CosmosError } from '../errors.js';
// Narrow runtime contract; Obsidian and plugin implementations are provided by the running application.
export async function dispatch(app: any, requestPath: string) {
  const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
  const root = path.dirname(path.dirname(fs.realpathSync(requestPath)));
  if (request.version !== 1 || !/^[eq]-[0-9a-f-]{36}$/.test(request.id) || request.receiptPath !== path.join(root, 'receipts', request.id + '.json')) throw new CosmosError('INVALID_INPUT', '运行时请求不合法。');
  const receiptPath = request.receiptPath;
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  const save = (value: unknown) => { const temp = receiptPath + '.tmp'; const fd = fs.openSync(temp, 'w', 0o600); try { fs.writeFileSync(fd, JSON.stringify(value)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } fs.renameSync(temp, receiptPath); };
  if (fs.existsSync(receiptPath)) return; // Never run an existing request again, including a started request.
  const base = { id: request.id, bindingId: request.bindingId };
  save({ ...base, state: 'started' });
  try {
    const vaultPath = fs.realpathSync(app.vault.adapter.getBasePath());
    if (vaultPath !== fs.realpathSync(request.vaultPath) || request.bindingId !== fingerprint({ vaultPath, vaultName: app.vault.getName() })) throw new CosmosError('WRONG_VAULT', '运行中的库不匹配绑定。');
    let result;
    if (request.action === 'inspect') {
      const tasknotes = app.plugins.plugins.tasknotes, api = tasknotes?.api;
      const snapshot = api?.settings.snapshot();
      const settings = snapshot && Object.fromEntries(['tasksFolder','taskFilenameFormat','customFilenameTemplate','storeTitleInFilename','defaultTaskStatus','defaultTaskPriority','taskCreationDefaults','fieldMapping','userFields','taskIdentificationMethod','taskTag','taskPropertyName','taskPropertyValue','archiveFolder','excludedFolders'].map(key => [key, snapshot[key]]));
      result = { vaultName: app.vault.getName(), bindingId: request.bindingId, electron: process.versions.electron, tasknotes: tasknotes ? { version: tasknotes.manifest.version, apiVersion: api?.apiVersion, capabilities: ['tasks.read','tasks.write','model.read','model.validate','catalog.read','settings.snapshot','recurring.write','recurring.materialize'].filter(x => api?.hasCapability(x)), statuses: api?.catalog.statuses(), priorities: api?.catalog.priorities(), fields: api?.catalog.fields(), model: api?.model.config(), settings } : null, periodic: app.plugins.plugins['periodic-notes']?.manifest.version };
    } else throw new CosmosError('CAPABILITY_MISSING', '未登记此运行时能力。');
    save({ ...base, state: 'succeeded', result });
  } catch (e) { save({ ...base, state: 'failed', error: { code: e instanceof CosmosError ? e.code : 'RUNTIME_FAILED', message: e instanceof Error ? e.message : String(e) } }); }
}
