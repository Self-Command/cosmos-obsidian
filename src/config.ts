import { readFile, realpath, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { object, text, validate } from './registry/schema.js';
import { within, fingerprint } from './domain/identity.js';
import { CosmosError } from './errors.js';
export interface Binding { version: 1; vaultPath: string; vaultName: string; cliPath: string; stateRoot: string; schemaPath: string; timeoutMs?: number }
export interface Config extends Binding { bindingId: string }
export const configSchema = object({ version: { const: 1 }, vaultPath: text, vaultName: text, cliPath: text, stateRoot: text, schemaPath: text, timeoutMs: { type: 'integer', minimum: 1000, maximum: 120000 } }, ['version', 'vaultPath', 'vaultName', 'cliPath', 'stateRoot', 'schemaPath']);
export async function loadConfig(file = process.env.COSMOS_CONFIG ?? path.join(os.homedir(), '.cosmos-obsidian', 'binding.json')): Promise<Config> {
  let raw: unknown;
  try { raw = JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, '')); } catch { throw new CosmosError('CONFIG_MISSING', '需要独立库绑定配置；请先运行安装器绑定。', {}, 3); }
  const config = validate<Binding>(configSchema, raw);
  if (![config.vaultPath, config.cliPath, config.stateRoot].every(path.isAbsolute)) throw new CosmosError('INVALID_INPUT', '绑定目录和 CLI 必须是绝对路径。');
  config.vaultPath = await realpath(config.vaultPath);
  config.cliPath = await realpath(config.cliPath);
  // Resolve before creating to avoid accidentally leaving state inside a linked vault.
  let ancestor = path.resolve(config.stateRoot), tail: string[] = [];
  while (true) {
    try { ancestor = await realpath(ancestor); break; } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; tail.unshift(path.basename(ancestor)); ancestor = path.dirname(ancestor); }
  }
  config.stateRoot = path.join(ancestor, ...tail);
  if (within(config.vaultPath, config.stateRoot) || within(config.stateRoot, config.vaultPath)) throw new CosmosError('INVALID_INPUT', '状态存储必须位于知识库外且不能包含知识库。');
  await mkdir(config.stateRoot, { recursive: true });
  return { ...config, bindingId: fingerprint({ vaultPath: config.vaultPath, vaultName: config.vaultName }) };
}
