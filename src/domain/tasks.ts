import { object, text, validate } from '../registry/schema.js';
import { name, notePath, fingerprint } from './identity.js';
import { schedule, validDate, type Schedule } from './dates.js';
import { CosmosError } from '../errors.js';
const texts = { type: 'array', items: text, uniqueItems: true };
export const scheduleSchema = object({ date: text, time: text, timeZone: text, relativeDays: { type: 'integer' }, baseDate: text }, ['timeZone']);
export const taskSchema = object({ title: text, status: text, schedule: scheduleSchema, due: scheduleSchema, estimateMinutes: { type: 'integer', minimum: 1, maximum: 525600 }, priority: { anyOf: [text, object({ rank: { enum: ['highest','lowest'] } }, ['rank'])] }, relations: object({ project: text, area: text }), tags: texts, contexts: texts, recurrence: text, details: { type: 'string' } }, ['title']);
export const taskChangeSchema = object({ action: { enum: ['task.update','task.complete','task.uncomplete','task.instance.complete','task.instance.skip'] }, path: text, patch: object({ status: text, priority: text, schedule: { anyOf: [scheduleSchema, { type: 'null' }] }, due: { anyOf: [scheduleSchema, { type: 'null' }] }, estimateMinutes: { type: 'integer', minimum: 1 }, recurrence: { type: ['string','null'] } }), date: text, completed: { type: 'boolean', description:'实例完成或跳过标记的目标状态。true 登记指定日期，false 撤销该标记；task.instance.skip 同样用 true 表示跳过。' } }, ['action','path']);
export interface TaskInput { title: string; status?: string; schedule?: Schedule; due?: Schedule; estimateMinutes?: number; priority?: string | { rank: 'highest' | 'lowest' }; relations?: { project?: string; area?: string }; tags?: string[]; contexts?: string[]; recurrence?: string; details?: string }
export function tags(value: string[] = []) {
  const normalized = [...new Set(value.map(x => x.replace(/^#/, '')))];
  if (normalized.some(x => !/^(?=.*[^\p{N}/])[\p{L}\p{M}\p{N}_/-]+$/u.test(x) || x.startsWith('route/') || x.split('/').some(p => !p))) throw new CosmosError('INVALID_TAG', '需要原生主题标签，不能填写系统路由。');
  return normalized;
}
export function catalogValue(value: string, catalog: any[], field: string) {
  const candidates = catalog.filter(x => x.value === value || x.label === value);
  const values = [...new Set(candidates.map(x => x.value))];
  if (values.length !== 1) throw new CosmosError(values.length ? 'TARGET_AMBIGUOUS' : 'INVALID_INPUT', '需要当前目录中的唯一值。', { field, candidates: catalog.map(x => ({ value: x.value, label: x.label })) });
  return values[0];
}
export function taskEnvironment(api: any, settings: any, version: string) {
  return fingerprint({ version, apiVersion: api.apiVersion, settings: Object.fromEntries(['tasksFolder','taskFilenameFormat','customFilenameTemplate','storeTitleInFilename','defaultTaskStatus','defaultTaskPriority','taskCreationDefaults','fieldMapping','userFields','taskIdentificationMethod','taskTag','taskPropertyName','taskPropertyValue','archiveFolder'].map(k => [k, settings[k]])), statuses: api.catalog.statuses(), priorities: api.catalog.priorities(), model: api.model.config() });
}
export function normalizeTask(raw: unknown, api: any, settings: any, now = new Date()) {
  const input = validate<TaskInput>(taskSchema, raw);
  const title = name(input.title.trim().replace(/\.md$/i, ''));
  if (/[\[\]#]/.test(title)) throw new CosmosError('INVALID_NAME', '任务文件名不能包含链接或标签分隔符。');
  if (!['title','custom'].includes(settings.taskFilenameFormat) || settings.taskFilenameFormat === 'custom' && settings.customFilenameTemplate !== '{{title}}') throw new CosmosError('CAPABILITY_MISSING', '当前命名格式无法绑定稳定的任务目标；不修改插件设置。', {}, 3);
  const folder = notePath(settings.tasksFolder);
  const priorityCatalog = api.catalog.priorities();
  let priority: string = settings.defaultTaskPriority;
  if (typeof input.priority === 'string') priority = catalogValue(input.priority, priorityCatalog, 'priority');
  else if (input.priority) {
    const weights = priorityCatalog.map((x: any) => x.weight).filter(Number.isFinite);
    if (!weights.length) throw new CosmosError('CAPABILITY_MISSING', '优先级没有可比较的权重。', {}, 3);
    const limit = input.priority.rank === 'highest' ? Math.max(...weights) : Math.min(...weights);
    const candidates = priorityCatalog.filter((x: any) => x.weight === limit);
    if (candidates.length !== 1) throw new CosmosError('TARGET_AMBIGUOUS', '优先级排名存在多个候选。', { candidates });
    priority = candidates[0].value;
  }
  const defaults = settings.taskCreationDefaults ?? {};
  if ((!input.schedule && defaults.defaultScheduledDate && defaults.defaultScheduledDate !== 'none') || (!input.due && defaults.defaultDueDate && defaults.defaultDueDate !== 'none') || (!input.recurrence && defaults.defaultRecurrence && defaults.defaultRecurrence !== 'none') || defaults.defaultReminders?.length) throw new CosmosError('NEEDS_INPUT', '当前插件有日期、重复或提醒默认值，需明确本次内容后预览。', { defaults: Object.fromEntries(['defaultDueDate','defaultScheduledDate','defaultRecurrence','defaultReminders'].map(k => [k, defaults[k]])) });
  const data: Record<string, any> = { title, status: catalogValue(input.status ?? settings.defaultTaskStatus, api.catalog.statuses(), 'status'), priority: catalogValue(priority, priorityCatalog, 'priority'), details: input.details ?? '', projects: [], tags: tags(input.tags), contexts: input.contexts ?? [], reminders: [], timeEstimate: input.estimateMinutes ?? defaults.defaultTimeEstimate ?? 0, dateCreated: now.toISOString(), dateModified: now.toISOString() };
  if (input.schedule) data.scheduled = schedule(input.schedule, now);
  if (input.due) data.due = schedule(input.due, now);
  if (input.recurrence) {
    if (!/^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;[A-Z]+=[A-Z0-9,+-]+)*$/.test(input.recurrence)) throw new CosmosError('INVALID_INPUT', '重复规则需要受支持的 RRULE；例如 FREQ=DAILY。');
    if (!data.scheduled) throw new CosmosError('NEEDS_INPUT', '重复任务需要具体计划日期以绑定起点。');
    data.recurrence = input.recurrence;
  }
  const check = api.model.validateTask(data);
  if (!check.valid) throw new CosmosError('INVALID_INPUT', 'TaskNotes 模型拒绝任务数据。', { issues: check.issues });
  return { input, data, folder, path: folder + '/' + title + '.md' };
}
export function normalizeTaskChange(raw: unknown) {
  const input = validate<any>(taskChangeSchema, raw); notePath(input.path);
  if (!input.path.endsWith('.md')) throw new CosmosError('INVALID_PATH', '任务目标需要 Markdown 笔记。');
  if (['task.instance.complete','task.instance.skip'].includes(input.action)) { if (!input.date) throw new CosmosError('NEEDS_INPUT', '实例操作需要明确日期。'); validDate(input.date); }
  if (input.action === 'task.update' && (!input.patch || !Object.keys(input.patch).length)) throw new CosmosError('NEEDS_INPUT', '任务修改需要非空 patch。');
  if (input.action !== 'task.update' && input.patch) throw new CosmosError('INVALID_INPUT', '此动作不接收 patch。');
  if (!['task.instance.complete','task.instance.skip'].includes(input.action) && input.completed !== undefined) throw new CosmosError('INVALID_INPUT', 'completed 只用于实例动作。');
  if (['task.instance.complete','task.instance.skip'].includes(input.action) && input.completed === undefined) throw new CosmosError('NEEDS_INPUT', '实例操作需要明确 desired completed 状态。');
  return input;
}
