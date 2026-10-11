import { Context } from './context.js';
import { prepareEntity, fillEntity, executeEntity, verifyEntity, type EntityPreparation } from './entities.js';
import { prepareEvolution, executeEvolution } from './lifecycle.js';
import { prepareFileChange, executeFileChange } from './files.js';
import { prepareTask, prepareTaskChange, executeTask, verifyTask } from './tasks.js';
import { changeSchema } from '../domain/changes.js';
import { validate } from '../registry/schema.js';
import { taskEnvironment } from '../domain/tasks.js';
import type { Plan, Step } from '../workflows/types.js';
import { CosmosError } from '../errors.js';
export async function prepareDraft(ctx: Context, input: any, bindingId: string): Promise<EntityPreparation> {
  if (input.action === 'writing.create') return (await import('./publication.js')).prepareWriting(ctx,input,bindingId);
  if (input.action === 'entity.evolve') return prepareEvolution(ctx, input, bindingId);
  if (input.action === 'journal.create') return (await import('./periods.js')).prepareJournal(ctx, input, bindingId);
  return prepareEntity(ctx, input, bindingId);
}
export async function prepareChanges(ctx: Context, raw: unknown, bindingId: string): Promise<Plan> {
  const input = validate<any>(changeSchema, raw); await ctx.rules(); const steps: Step[] = [], environment: Plan['environment'] = {}, warnings: string[] = [];
  for (const action of input.actions) {
    let plan: Plan | undefined, step: Step | undefined;
    const { action: id, ...business } = action;
    if (id === 'task.create') plan = await prepareTask(ctx, business, bindingId);
    else if (id === 'entity.create') { const prepared = await prepareEntity(ctx, business, bindingId); plan = await fillEntity(ctx, prepared, action.content, bindingId); }
    else if (id === 'entity.evolve' || id === 'journal.create') { const prepared = await prepareDraft(ctx, action, bindingId); plan = await fillEntity(ctx, prepared, action.content ?? { fields: {} }, bindingId); }
    else if (id.startsWith('task.')) { step = await prepareTaskChange(ctx, action); const { plugin,api,settings } = ctx.tasknotes(); environment.tasknotes = taskEnvironment(api, settings, plugin.manifest.version); }
    else step = await prepareFileChange(ctx, action);
    const additions = plan?.steps ?? [step!];
    for (const addition of additions) {
      const paths = new Set([addition.path, ...(addition.source ? [addition.source] : [])]);
      if (steps.some(prior => [prior.path, ...(prior.source ? [prior.source] : [])].some(p => paths.has(p)))) throw new CosmosError('INVALID_INPUT', '同一方案不能安排覆盖相同文件的多个动作。');
      steps.push(addition);
      if (['task.create','entity.create','journal.create'].includes(addition.action) || addition.action === 'entity.evolve' && addition.data.transition && addition.source !== addition.path && !addition.expected.sourceAbsent) ctx.proposed.set(addition.path, { type: addition.expected.properties!.type });
      if (addition.source && addition.expected.sourceAbsent) { ctx.renamed.set(addition.source,addition.path); ctx.proposed.set(addition.path,{type:addition.expected.properties!.type}); }
    }
    if (plan) { Object.assign(environment, plan.environment); warnings.push(...plan.warnings); }
  }
  return { version: 1, bindingId, steps, dependencies: ctx.dependencies, environment: { ...environment, ...ctx.environment }, warnings: [...new Set(warnings)] };
}
export async function executeStep(ctx: Context, step: Step, executionId: string) {
  if(step.action.startsWith('publish.')||step.action==='writing.create')return (await import('./publication.js')).executePublication(ctx,step);
  if (step.action.startsWith('task.')) return executeTask(ctx, step, executionId);
  if (step.action === 'entity.evolve') return executeEvolution(ctx, step);
  if (step.action === 'journal.create') return (await import('./periods.js')).executeJournal(ctx, step);
  if (step.action === 'entity.create') return executeEntity(ctx, step);
  return executeFileChange(ctx, step);
}
export const verifyStep = async (ctx: Context, step: Step, observed?: any):Promise<any> => step.action.startsWith('publish.')||step.action==='writing.create'?(await import('./publication.js')).verifyPublication(ctx,step,observed):step.action.startsWith('task.') ? verifyTask(ctx, step, observed) : verifyEntity(ctx, step);
