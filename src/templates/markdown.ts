import { parse, stringify } from 'yaml';
import { CosmosError } from '../errors.js';
export function splitNote(raw: string): { properties: Record<string, any>; body: string } {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = /^---\s*\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  if (!match) return { properties: {}, body: text.trim() };
  const properties = parse(match[1]!) ?? {};
  if (!properties || Array.isArray(properties) || typeof properties !== 'object') throw new CosmosError('INVALID_FRONTMATTER', '属性需要 YAML 对象。');
  delete properties.position;
  return { properties, body: text.slice(match[0].length).trim() };
}
export const noteBytes = (properties: Record<string, any>, body: string) => '---\n' + stringify(properties) + '---\n\n' + body.trim() + '\n';
export function taskBody(template: string, data: Record<string, any>) {
  if (/<%|\{\{(?:date|time)[^}]*\}\}/.test(template)) throw new CosmosError('CAPABILITY_MISSING', '此任务模板含动态程序或时间变量，不能生成稳定预览。', {}, 3);
  const vars: Record<string, string> = { title: data.title, details: data.details ?? '', status: data.status, priority: data.priority, dueDate: data.due ?? '', scheduledDate: data.scheduled ?? '', timeEstimate: String(data.timeEstimate ?? ''), contexts: (data.contexts ?? []).join(', '), projects: (data.projects ?? []).join(', '), tags: (data.tags ?? []).join(', '), parentNote: '' };
  let body = splitNote(template).body;
  body = body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => { if (!(key in vars)) throw new CosmosError('CAPABILITY_MISSING', '任务模板存在不支持的变量。', { key }, 3); return vars[key]!; });
  return body.trim();
}
