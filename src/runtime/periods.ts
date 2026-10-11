import * as periodic from 'obsidian-daily-notes-interface';
import { Context } from './context.js';
import { journalSchema, periodEnvironment, periodNames } from '../domain/periods.js';
import { validDate } from '../domain/dates.js';
import { validate } from '../registry/schema.js';
import { fingerprint, name } from '../domain/identity.js';
import { compileContent } from '../templates/content.js';
import { splitNote } from '../templates/markdown.js';
import { CosmosError } from '../errors.js';
import type { EntityPreparation } from './entities.js';
import type { Plan, Step } from '../workflows/types.js';
const creators: Record<string,any> = { day: periodic.createDailyNote, week: periodic.createWeeklyNote, month: periodic.createMonthlyNote, quarter: periodic.createQuarterlyNote, year: periodic.createYearlyNote };
const getters: Record<string,any> = { day: periodic.getDailyNoteSettings, week: periodic.getWeeklyNoteSettings, month: periodic.getMonthlyNoteSettings, quarter: periodic.getQuarterlyNoteSettings, year: periodic.getYearlyNoteSettings };
export async function prepareJournal(ctx: Context, raw: unknown, bindingId: string): Promise<EntityPreparation> {
  const input = validate<any>(journalSchema, raw); validDate(input.date); await ctx.rules(); const plugin = ctx.periodic(input.period), settings = getters[input.period]!();
  const moment = (globalThis as any).window?.moment;
  if (typeof moment !== 'function' || !settings.folder || !settings.template || !settings.format) throw new CosmosError('CAPABILITY_MISSING', '周期服务缺少日期或模板配置。', {}, 3);
  const date = moment(input.date, 'YYYY-MM-DD', true);
  const title = name(date.format(settings.format)), path = settings.folder + '/' + title + '.md'; ctx.allowed('journal', settings.folder); await ctx.target(path);
  const templatePath = settings.template.endsWith('.md') ? settings.template : settings.template + '.md', rawTemplate = await ctx.read(templatePath);
  if (/<%|\{\{\s*time|\{\{[^}]+[+-]\d/.test(rawTemplate)) throw new CosmosError('CAPABILITY_MISSING', '此周期模板含未能固定的程序或相对时间。', {}, 3);
  const rendered = rawTemplate.replace(/\{\{\s*title\s*\}\}/gi, title).replace(/\{\{\s*date\s*(?::([^}]+))?\}\}/gi, (_,format: string) => date.format(format?.trim() ?? settings.format));
  if (/\{\{/.test(rendered)) throw new CosmosError('CAPABILITY_MISSING', '此周期模板含不支持的日期变量。', {}, 3);
  const template = compileContent(rawTemplate), actual = splitNote(rendered), properties: Record<string,any> = { ...actual.properties, route: settings.folder };
  if (properties.type !== 'journal' || properties.period !== input.period || typeof properties.date !== 'string') throw new CosmosError('INVALID_TEMPLATE', '周期模板类型、周期或日期字段与本次操作不一致。');
  const plan: Plan = { version: 1, bindingId, steps: [{ action: 'journal.create', path, data: { period: input.period, date: input.date, intermediateBody: actual.body }, expected: { properties } }], dependencies: ctx.dependencies, environment: { periodic: periodEnvironment(plugin) }, warnings: [] };
  const prepared = { version: 1 as const, bindingId, plan, template, title, facts: { period: input.period, date: input.date } };
  return { ...prepared, hash: fingerprint(prepared) };
}
export async function executeJournal(ctx: Context, step: Step) {
  await ctx.target(step.path); ctx.periodic(step.data.period);
  const date = (globalThis as any).window.moment(step.data.date, 'YYYY-MM-DD', true), file = await creators[step.data.period]!(date);
  if (!file || file.path !== step.path) throw new CosmosError('EXECUTION_PARTIAL', '周期服务未返回预览的目标文件。', { actual: file?.path, expected: step.path }, 4);
  await ctx.app.vault.process(file, (bytes: string) => {
    const current = splitNote(bytes); if (current.body !== step.data.intermediateBody) throw new CosmosError('CONCURRENT_CHANGE', '周期服务落盘正文与固定模板不符，已停止填充。');
    const header = /^(?:\uFEFF)?---\s*\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(bytes);
    return (header?.[0] ?? '') + '\n' + step.expected.body + '\n';
  });
  if (step.expected.properties!.route !== splitNote(await ctx.app.vault.read(file)).properties.route) await ctx.app.fileManager.processFrontMatter(file, (fm:any) => { fm.route = step.expected.properties!.route; });
  return { path: file.path };
}
