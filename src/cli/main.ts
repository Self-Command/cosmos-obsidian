import { readFile } from 'node:fs/promises';
import { loadConfig } from '../config.js';
import { Obsidian } from '../adapters/obsidian.js';
import { failure, CosmosError } from '../errors.js';
import { commandHelp, findOperation } from '../registry/index.js';
import { validate } from '../registry/schema.js';
import { Reviews } from '../workflows/review.js';
import { Drafts } from '../workflows/drafts.js';
export async function main(argv = process.argv.slice(2)) {
  const args = [...argv];
  let configFile: string | undefined;
  const index = args.indexOf('--config');
  if (index >= 0) { configFile = args[index + 1]; if (!configFile) throw new CosmosError('INVALID_INPUT', '--config 需要文件。'); args.splice(index, 2); }
  const pretty = args.includes('--pretty');
  const clean = args.filter(x => x !== '--pretty' && x !== '--json');
  const option = (flag: string) => { const i = clean.indexOf(flag); if (i < 0) return undefined; const value = clean[i + 1]; if (!value || value.startsWith('--')) throw new CosmosError('INVALID_INPUT', flag + ' 需要值。'); clean.splice(i, 2); return value; };
  const inputFile = option('--input'), reviewId = option('--review'), executionId = option('--execution'), draftId = option('--draft');
  const confirmed = clean.includes('--confirm'); if (confirmed) clean.splice(clean.indexOf('--confirm'), 1);
  let result;
  if (!clean.length || clean[0] === 'help' || clean[0] === '--help') result = { ok: true, version: 1, commands: commandHelp(), input: 'UTF-8 JSON stdin or --input file', config: 'COSMOS_CONFIG or --config binding.json' };
  else {
    const operation = findOperation(clean.join(' '));
    if (!operation) throw new CosmosError('INVALID_INPUT', '命令未实现或参数不合法；运行 cosmos help 查看已实现能力。');
    if (confirmed && !['review.commit','publish.commit'].includes(operation.id)) throw new CosmosError('INVALID_INPUT', '--confirm 仅用于提交。');
    const adapter = new Obsidian(await loadConfig(configFile)), reviews = new Reviews(adapter);
    if (['task.preview','entity.preview','draft.open','draft.preview','change.preview','publish.preview','query.publication','query.tasks','query.notes','query.actions'].includes(operation.id)) {
      if (!inputFile) throw new CosmosError('INVALID_INPUT', '此命令需要 --input <file|->。');
      let bytes: string;
      if (inputFile === '-') { const chunks: Buffer[] = []; for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk)); bytes = Buffer.concat(chunks).toString('utf8'); }
      else bytes = await readFile(inputFile, 'utf8');
      let input;
      try { input = JSON.parse(bytes.replace(/^\uFEFF/, '')); } catch { throw new CosmosError('INVALID_INPUT', '输入需要 UTF-8 JSON。'); }
      validate(operation.schema, input);
      if (operation.id.startsWith('query.')) { const r = await adapter.request(operation.id, input); if (r.state !== 'succeeded') throw new CosmosError(r.error?.code ?? 'QUERY_FAILED', r.error?.message ?? '查询失败。', r.error?.details); result = { ok: true, state: 'queried', [operation.id.slice(6)]: r.result }; }
      else if (operation.id === 'draft.open') result = await new Drafts(adapter, reviews).open(input);
      else if (operation.id === 'draft.preview') { if (!draftId) throw new CosmosError('INVALID_INPUT', '需要 --draft ID。'); result = await new Drafts(adapter, reviews).preview(draftId, input); }
      else result = await reviews.preview(operation.id === 'task.preview' ? 'task.prepare' : operation.id === 'entity.preview' ? 'entity.preview' : operation.id==='publish.preview'?'publish.prepare':'change.prepare', input);
    } else if (operation.id === 'inspect.capabilities') result = { ok: true, state: 'inspected', capabilities: await adapter.inspect() };
    else if (operation.id.startsWith('review.')||operation.id==='publish.commit') {
      if (!reviewId) throw new CosmosError('INVALID_INPUT', '需要 --review ID。');
      result = operation.id === 'review.show' ? await reviews.show(reviewId) : operation.id === 'review.cancel' ? await reviews.cancel(reviewId) : await reviews.commit(reviewId, confirmed);
    } else {
      if (!executionId) throw new CosmosError('INVALID_INPUT', '需要 --execution ID。');
      result = operation.id === 'execution.status' ? await reviews.status(executionId) : await reviews.verify(executionId);
    }
  }
  process.stdout.write(JSON.stringify(result, null, pretty ? 2 : undefined) + '\n');
  if (!(result as any).ok) process.exitCode = (result as any).state === 'uncertain' ? 5 : 4;
}
main().catch(e => { const { exitCode, ...result } = failure(e); process.stdout.write(JSON.stringify(result) + '\n'); process.exitCode = exitCode; });
