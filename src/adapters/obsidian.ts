import { spawn } from 'node:child_process';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Config } from '../config.js';
import { Store, newId } from '../state/store.js';
import { CosmosError } from '../errors.js';
export interface Receipt { id: string; state: 'started' | 'succeeded' | 'failed'; result?: any; error?: { code: string; message: string; details?: Record<string,unknown> }; bindingId: string }
export class Obsidian {
  store: Store;
  timings:{action:string;milliseconds:number;state?:string}[]=[];
  constructor(public config: Config, public runtimePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cosmos-runtime.cjs')) { this.store = new Store(config.stateRoot); }
  async request(action: string, input: unknown = {}, id = newId('q')): Promise<Receipt> {
    const started=performance.now(),timing:{action:string;milliseconds:number;state?:string}={action,milliseconds:0};this.timings.push(timing);
    try {
    const requestPath = this.store.file('requests', id), receiptPath = this.store.file('receipts', id);
    await this.store.write('requests', id, { version: 1, id, bindingId: this.config.bindingId, vaultPath: this.config.vaultPath, schemaPath: this.config.schemaPath, templateFolder: this.config.templateFolder, action, input, receiptPath });
    // Only package-owned bootstrap code enters eval. Business input is read from the request file.
    const code = `(async()=>await require(${JSON.stringify(this.runtimePath)}).dispatch(app,${JSON.stringify(requestPath)}))()`;
    const child = spawn(this.config.cliPath, [`vault=${this.config.vaultName}`, 'eval', `code=${code}`], { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let diagnostics = '';
    child.stdout.on('data', () => {}); child.stderr.on('data', b => { diagnostics = (diagnostics + b).slice(-4000); });
    let processError: Error | undefined;
    child.on('error', e => { processError = e; });
    const deadline = Date.now() + (this.config.timeoutMs ?? 15000);
    while (Date.now() < deadline) {
      try { const receipt = JSON.parse(await readFile(receiptPath, 'utf8')) as Receipt; if (receipt.id !== id || receipt.bindingId !== this.config.bindingId) throw new CosmosError('WRONG_VAULT', '回执身份不匹配。', {}, 3); if (receipt.state !== 'started') {timing.state=receipt.state;return receipt;} } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
      if (processError) throw new CosmosError('CAPABILITY_MISSING', '不能调用 Obsidian CLI。', { reason: processError.message }, 3);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    child.kill();
    throw new CosmosError('RESULT_UNCERTAIN', 'CLI 超时不能证明应用内操作停止；请查询原执行回执。', { executionId: id, diagnostics }, 5);
    }finally{timing.milliseconds=performance.now()-started;}
  }
  async inspect() { const r = await this.request('inspect'); if (r.state === 'failed') throw new CosmosError(r.error?.code ?? 'CAPABILITY_MISSING', r.error?.message ?? '运行时能力不可用。', {}, 3); return r.result; }
}
