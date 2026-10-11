import { Context } from './context.js';
import { normalizeTask, normalizeTaskChange, catalogValue, taskEnvironment } from '../domain/tasks.js';
import { taskBody, splitNote } from '../templates/markdown.js';
import { validDate, schedule } from '../domain/dates.js';
import { CosmosError } from '../errors.js';
import { notePath, fingerprint } from '../domain/identity.js';
import type { Plan, Step, StepResult } from '../workflows/types.js';

export async function prepareTask(ctx: Context, raw: unknown, bindingId: string): Promise<Plan> {
  await ctx.rules();
  const { plugin, api, settings } = ctx.tasknotes('tasks.write');
  const { input, data, folder, path } = normalizeTask(raw, api, settings);
  ctx.allowed('task', folder); await ctx.target(path);
  if (input.relations?.project) data.projects = [await ctx.relation(input.relations.project, 'project')];
  if (input.relations?.area) {
    const area = settings.userFields?.find((x: any) => x.id === 'area' && x.key === 'area');
    if (!area) throw new CosmosError('CAPABILITY_MISSING', 'TaskNotes 没有已登记领域字段。', {}, 3);
    data.area = await ctx.relation(input.relations.area, 'area');
  }
  const defaults = settings.taskCreationDefaults ?? {};
  let template = '{{details}}';
  if (defaults.useBodyTemplate) {
    const templatePath = defaults.bodyTemplate.endsWith('.md') ? defaults.bodyTemplate : defaults.bodyTemplate + '.md';
    template = await ctx.read(templatePath);
  }
  const properties: Record<string, any> = { ...splitNote(template).properties, type: 'task', route: folder, source: 'manual', format: 'note', publish: false, tags: data.tags, area: data.area ?? '' };
  const mapping = settings.fieldMapping ?? {};
  for (const field of ['title','status','priority','due','scheduled','timeEstimate','dateCreated','dateModified','recurrence','projects','contexts']) {
    if (data[field] !== undefined && (field !== 'timeEstimate' || data[field] > 0)) properties[mapping[field] ?? field] = data[field];
  }
  // All user fields and defaults visible in the plan are pinned; no unreviewed default can override them.
  data.customFrontmatter = properties;
  const body = taskBody(template, data);
  return { version: 1, bindingId, steps: [{ action: 'task.create', path, data, expected: { properties, body } }], dependencies: ctx.dependencies, environment: { tasknotes: taskEnvironment(api, settings, plugin.manifest.version) }, warnings: [] };
}
export async function prepareTaskChange(ctx: Context, raw: unknown): Promise<Step> {
  const input = normalizeTaskChange(raw), { api, settings } = ctx.tasknotes('tasks.write');
  await ctx.target(input.path, false); const note = splitNote(await ctx.read(input.path));
  const task = await api.tasks.get(input.path);
  if (!task || note.properties.type !== 'task') throw new CosmosError('INVALID_TARGET', '目标不是 TaskNotes 任务。');
  ctx.allowed('task', input.path.split('/').slice(0, -1).join('/'));
  const expected: Step['expected'] = { properties: {} }, data: Record<string, any> = {};
  if (input.action === 'task.update') {
    for (const [key, value] of Object.entries(input.patch)) {
      const mapped = key === 'schedule' ? 'scheduled' : key === 'estimateMinutes' ? 'timeEstimate' : key;
      let resolved: any = value;
      if (key === 'status' || key === 'priority') resolved = catalogValue(value as string, api.catalog[key === 'status' ? 'statuses' : 'priorities'](), key);
      if (key === 'schedule' || key === 'due') resolved = value === null ? undefined : schedule(value as any);
      data[mapped] = resolved;
      expected.properties![mapped] = resolved ?? null;
    }
  } else if (input.action === 'task.complete' || input.action === 'task.uncomplete') {
    if (task.recurrence) throw new CosmosError('INVALID_INPUT', '重复任务需要明确实例动作。');
    const complete = input.action === 'task.complete';
    const candidates = api.catalog.statuses().filter((x: any) => Boolean(x.isCompleted) === complete && (complete || x.value === settings.defaultTaskStatus));
    if (candidates.length !== 1) throw new CosmosError('TARGET_AMBIGUOUS', '完成状态需要唯一目录值。', { candidates });
    data.status = candidates[0].value; expected.properties!.status = data.status;
  } else {
    if (!task.recurrence) throw new CosmosError('INVALID_INPUT', '此任务没有重复规则。');
    ctx.tasknotes(input.action === 'task.occurrence' ? 'recurring.materialize' : 'recurring.write');
    data.date = input.date; data.completed = input.completed;
    if (input.action !== 'task.occurrence') expected.properties![input.action === 'task.instance.complete' ? 'complete_instances' : 'skipped_instances'] = { date: input.date, included: input.completed };
  }
  if (input.action === 'task.update') {
    const check = api.model.validatePatch(data);
    if (!check.valid) throw new CosmosError('INVALID_INPUT', 'TaskNotes 模型拒绝修改。', { issues: check.issues });
  }
  return { action: input.action, path: input.path, data, expected };
}
export async function executeTask(ctx: Context, step: Step, executionId: string) {
  const { api } = ctx.tasknotes('tasks.write');
  const mutation = { source: 'cosmos-obsidian', correlationId: executionId, reason: 'approved immutable review' };
  let task;
  switch (step.action) {
    case 'task.create':
      await ctx.target(step.path);
      task = await api.tasks.create(step.data, mutation);
      if (task.path !== step.path) throw new CosmosError('EXECUTION_PARTIAL', '插件生成了与方案不同的路径；记录实际文件，禁止重发。', { expected: step.path, actual: task.path }, 4);
      break;
    case 'task.update': task = await api.tasks.update(step.path, step.data, mutation); break;
    case 'task.complete': task = await api.tasks.complete(step.path, { status: step.data.status }, mutation); break;
    case 'task.uncomplete': task = await api.tasks.uncomplete(step.path, { status: step.data.status }, mutation); break;
    case 'task.instance.complete':
    case 'task.instance.skip': {
      const current = await api.tasks.get(step.path), field = step.action === 'task.instance.complete' ? 'complete_instances' : 'skipped_instances';
      const present = (current[field] ?? []).includes(step.data.date);
      if (present !== step.data.completed) task = await api.recurring[step.action === 'task.instance.complete' ? 'toggleCompleteInstance' : 'toggleSkippedInstance'](step.path, step.data.date, mutation);
      else task = current;
      break;
    }
    case 'task.occurrence': task = await api.recurring.materializeOccurrence(step.path, step.data.date, mutation); break;
    default: throw new CosmosError('CAPABILITY_MISSING', '任务动作没有登记。', {}, 3);
  }
  return { task };
}
export async function verifyTask(ctx: Context, step: Step, observed?: any) {
  const { api, settings } = ctx.tasknotes();
  const path = step.action === 'task.occurrence' ? observed?.task?.path : step.path;
  if (!path) return { verified: false, differences: ['occurrence path unavailable'] };
  const task = await api.tasks.get(path), file = ctx.app.vault.getAbstractFileByPath(path);
  if (!task || !file) return { verified: false, differences: ['task or file missing'] };
  const note = splitNote(await ctx.app.vault.read(file)), differences: string[] = [];
  if (step.expected.body !== undefined && note.body !== step.expected.body.trim()) differences.push('body differs');
  for (const [key, value] of Object.entries(step.expected.properties ?? {})) {
    if (key === 'title' && settings.storeTitleInFilename) { if (task.title !== value) differences.push(key); continue; }
    if (key === 'complete_instances' || key === 'skipped_instances') {
      if ((task[key] ?? []).includes(value.date) !== value.included) differences.push(key); continue;
    }
    const logical = Object.entries(settings.fieldMapping ?? {}).find(([, field]) => field === key)?.[0] ?? key;
    const actual = Object.prototype.hasOwnProperty.call(task, logical) ? task[logical] : note.properties[key];
    if (value === null && actual == null) continue;
    if (logical === 'recurrence' && typeof value === 'string' && String(actual).includes(value)) continue;
    if (fingerprint(actual ?? null) !== fingerprint(value)) differences.push(key);
  }
  return { verified: differences.length === 0, differences, path, task };
}
