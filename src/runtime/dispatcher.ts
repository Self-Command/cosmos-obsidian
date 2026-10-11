import fs from 'node:fs';
import path from 'node:path';
import { fingerprint, safeTarget, bytesHash } from '../domain/identity.js';
import { CosmosError } from '../errors.js';
import { Context } from './context.js';
import { prepareTask, prepareTaskChange, executeTask, verifyTask } from './tasks.js';
import { prepareEntity, fillEntity, executeEntity, verifyEntity } from './entities.js';
import { prepareDraft, prepareChanges, executeStep, verifyStep } from './business.js';
import { queryNotes, queryActions } from './queries.js';
import { taskEnvironment } from '../domain/tasks.js';
import { object, text, validate } from '../registry/schema.js';
import type { Plan, StepResult } from '../workflows/types.js';
import type { Review } from '../state/store.js';

function assertStoredReview(review: Review, bindingId: string, root: string) {
  if (review.bindingId !== bindingId || fingerprint(review.plan) !== review.planHash || fingerprint(review.preview) !== review.previewHash || fingerprint(fs.readFileSync(path.join(root, 'previews', review.id + '.md'), 'utf8')) !== review.previewHash) throw new CosmosError('REVIEW_TAMPERED', '预览或方案不匹配。');
}
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
    const ctx = new Context(app, vaultPath, request.schemaPath, request.templateFolder);
    let result;
    if (request.action === 'inspect') {
      const tasknotes = app.plugins.plugins.tasknotes, api = tasknotes?.api;
      const snapshot = api?.settings.snapshot();
      const settings = snapshot && Object.fromEntries(['tasksFolder','taskFilenameFormat','customFilenameTemplate','storeTitleInFilename','defaultTaskStatus','defaultTaskPriority','taskCreationDefaults','fieldMapping','userFields','taskIdentificationMethod','taskTag','taskPropertyName','taskPropertyValue','archiveFolder','excludedFolders'].map(key => [key, snapshot[key]]));
      result = { vaultName: app.vault.getName(), bindingId: request.bindingId, electron: process.versions.electron, tasknotes: tasknotes ? { version: tasknotes.manifest.version, apiVersion: api?.apiVersion, capabilities: ['tasks.read','tasks.write','model.read','model.validate','catalog.read','settings.snapshot','recurring.write','recurring.materialize'].filter(x => api?.hasCapability(x)), statuses: api?.catalog.statuses(), priorities: api?.catalog.priorities(), fields: api?.catalog.fields(), model: api?.model.config(), settings } : null, periodic: app.plugins.plugins['periodic-notes']?.manifest.version };
    } else if (request.action === 'task.prepare') result = await prepareTask(ctx, request.input, request.bindingId);
    else if (request.action === 'entity.prepare') result = await prepareEntity(ctx, request.input, request.bindingId);
    else if (request.action === 'draft.prepare') result = await prepareDraft(ctx, request.input, request.bindingId);
    else if (request.action === 'entity.preview') {
      const prepared = await prepareEntity(ctx, request.input, request.bindingId);
      result = await fillEntity(ctx, prepared, request.input.content, request.bindingId);
    } else if (request.action === 'entity.fill') {
      const input = validate<any>(object({ preparation: { type: 'object' }, content: { type: 'object' } }, ['preparation','content']), request.input);
      result = await fillEntity(ctx, input.preparation, input.content, request.bindingId);
    }
    else if (request.action === 'change.prepare') {
      result = await prepareChanges(ctx, request.input, request.bindingId);
    } else if (request.action === 'query.notes') result = await queryNotes(ctx, request.input);
    else if (request.action === 'query.actions') result = await queryActions(ctx, request.input);
    else if (request.action === 'query.tasks') {
      const input = validate<any>(object({ title: text, status: text, folder: text, project: text, limit: { type: 'integer', minimum: 1, maximum: 100 } }), request.input);
      const { api } = ctx.tasknotes();
      const list = await api.tasks.list();
      result = list.filter((task: any) => (!input.title || task.title.includes(input.title)) && (!input.status || task.status === input.status) && (!input.folder || task.path.startsWith(input.folder + '/')) && (!input.project || task.projects?.includes(input.project))).slice(0, input.limit ?? 20).map((task: any) => ({ path: task.path, title: task.title, status: task.status, priority: task.priority, scheduled: task.scheduled, due: task.due, recurrence: task.recurrence, projects: task.projects }));
    } else if (request.action === 'review.execute') {
      const input = validate<any>(object({ reviewId: text }, ['reviewId']), request.input);
      if (!/^r-[0-9a-f-]{36}$/.test(input.reviewId)) throw new CosmosError('INVALID_ID', '方案 ID 无效。');
      const review = JSON.parse(fs.readFileSync(path.join(root, 'reviews', input.reviewId + '.json'), 'utf8')) as Review;
      assertStoredReview(review, request.bindingId, root);
      const lock = JSON.parse(fs.readFileSync(path.join(root, 'locks', request.bindingId + '.lock'), 'utf8'));
      if (review.state !== 'executing' || review.executionId !== request.id || lock.executionId !== request.id) throw new CosmosError('INVALID_STATE', '执行身份或锁不匹配。');
      const plan = review.plan as Plan;
      await ctx.assertFresh(plan);
      if (app.__cosmosObsidianExecution) throw new CosmosError('VAULT_LOCKED', '应用内有未完成执行。');
      app.__cosmosObsidianExecution = request.id;
      const steps: StepResult[] = [];
      let currentDependencies = structuredClone(plan.dependencies);
      try {
        for (let index = 0; index < plan.steps.length; index++) {
          const step = plan.steps[index]!;
          try { await ctx.assertFresh({ ...plan, dependencies: currentDependencies }); }
          catch (error) { steps.push({index,action:step.action,path:step.path,state:'failed',verified:false,error:{code:error instanceof CosmosError?error.code:'PRECONDITION_FAILED',message:error instanceof Error?error.message:String(error)}});break; }
          save({ ...base, state: 'started', phase: 'dispatching', index, steps });
          try {
            const observed = await executeStep(ctx, step, request.id);
            const verification = await verifyStep(ctx, step, observed);
            steps.push({ index, action: step.action, path: step.path, state: verification.verified ? 'succeeded' : 'failed', verified: verification.verified, observed, error: verification.verified ? undefined : { code: 'VERIFICATION_FAILED', message: JSON.stringify(verification.differences) } });
            save({ ...base, state: 'started', phase: 'readback', index, steps });
            if (!verification.verified) break;
            const changed = new Set([step.path,step.source,...(step.data.links ?? []).map((link:any)=>link.path)]);
            currentDependencies = await Promise.all(currentDependencies.map(async dependency => {
              if (dependency.kind === 'directory' || !changed.has(dependency.path)) return dependency;
              const target = await safeTarget(vaultPath,dependency.path);
              return fs.existsSync(target) ? {...dependency,kind:'file' as const,hash:bytesHash(fs.readFileSync(target))} : {...dependency,kind:'absent' as const,hash:null};
            }));
          } catch (error) {
            // A mutation error is not proof that nothing changed. Resolve from receipts/readback.
            steps.push({ index, action: step.action, path: step.path, state: 'uncertain', verified: false, error: { code: error instanceof CosmosError ? error.code : 'RUNTIME_FAILED', message: error instanceof Error ? error.message : String(error) } });
            break;
          }
        }
        const succeeded = steps.length === plan.steps.length && steps.every(x => x.verified);
        result = { state: succeeded ? 'succeeded' : steps.some(x => x.state === 'uncertain') ? 'uncertain' : steps.some(x => x.verified) ? 'partial' : 'failed', verified: succeeded, steps, unstarted: plan.steps.slice(steps.length).map(x => ({ action: x.action, path: x.path })) };
      } finally { delete app.__cosmosObsidianExecution; }
    } else if (request.action === 'execution.verify') {
      const input = validate<any>(object({ executionId: text }, ['executionId']), request.input);
      if (!/^e-[0-9a-f-]{36}$/.test(input.executionId)) throw new CosmosError('INVALID_ID', '执行 ID 无效。');
      const execution = JSON.parse(fs.readFileSync(path.join(root, 'executions', input.executionId + '.json'), 'utf8'));
      const review = JSON.parse(fs.readFileSync(path.join(root, 'reviews', execution.reviewId + '.json'), 'utf8')) as Review;
      assertStoredReview(review, request.bindingId, root);
      const plan = review.plan as Plan, priorPath = path.join(root, 'receipts', input.executionId + '.json');
      if (!fs.existsSync(priorPath) || app.__cosmosObsidianExecution === input.executionId) result = { state: 'uncertain', verified: false, steps: execution.steps, message: '没有最终回执或应用仍在执行；保持锁，不派发。' };
      else {
        const prior = JSON.parse(fs.readFileSync(priorPath, 'utf8'));
        if (prior.state === 'failed') result = { state: 'failed', verified: false, steps: [], error: prior.error };
        else {
          const previous = prior.result?.steps ?? prior.steps ?? [], steps: StepResult[] = [];
          const count = prior.state === 'started' ? Math.min(plan.steps.length, (prior.index ?? -1) + 1) : previous.length;
          for (let index = 0; index < count; index++) {
            const step = plan.steps[index]!, observed = previous[index]?.observed;
            const verification = await verifyStep(ctx, step, observed);
            steps.push({ index, action: step.action, path: step.path, state: verification.verified ? 'succeeded' : 'uncertain', verified: verification.verified, observed });
          }
          const all = steps.length === plan.steps.length && steps.every(x => x.verified);
          const final = prior.state !== 'started' && !steps.some(x => x.state === 'uncertain');
          result = { state: all ? 'succeeded' : final ? (steps.some(x => x.verified) ? 'partial' : 'failed') : 'uncertain', verified: all, steps };
        }
      }
    } else throw new CosmosError('CAPABILITY_MISSING', '未登记此运行时能力。');
    save({ ...base, state: 'succeeded', result });
  } catch (e) { save({ ...base, state: 'failed', error: { code: e instanceof CosmosError ? e.code : 'RUNTIME_FAILED', message: e instanceof Error ? e.message : String(e), details: e instanceof CosmosError ? e.details : undefined } }); }
}
