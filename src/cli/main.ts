import { readFile } from 'node:fs/promises';
import { loadConfig } from '../config.js';
import { Obsidian } from '../adapters/obsidian.js';
import { failure, CosmosError } from '../errors.js';
export async function main(argv = process.argv.slice(2)) {
  const args = [...argv];
  let configFile: string | undefined;
  const index = args.indexOf('--config');
  if (index >= 0) { configFile = args[index + 1]; if (!configFile) throw new CosmosError('INVALID_INPUT', '--config 需要文件。'); args.splice(index, 2); }
  const pretty = args.includes('--pretty');
  const clean = args.filter(x => x !== '--pretty' && x !== '--json');
  let result;
  if (!clean.length || clean[0] === 'help' || clean[0] === '--help') result = { ok: true, version: 1, commands: ['inspect capabilities'], input: 'UTF-8 JSON stdin or --input file', config: 'COSMOS_CONFIG or --config binding.json' };
  else if (clean.join(' ') === 'inspect capabilities') result = { ok: true, state: 'inspected', capabilities: await new Obsidian(await loadConfig(configFile)).inspect() };
  else throw new CosmosError('INVALID_INPUT', '命令未实现或参数不合法；运行 cosmos help 查看已实现能力。');
  process.stdout.write(JSON.stringify(result, null, pretty ? 2 : undefined) + '\n');
}
main().catch(e => { const { exitCode, ...result } = failure(e); process.stdout.write(JSON.stringify(result) + '\n'); process.exitCode = exitCode; });
