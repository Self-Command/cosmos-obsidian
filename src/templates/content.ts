import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { CosmosError } from '../errors.js';
import { fingerprint } from '../domain/identity.js';
import { splitNote } from './markdown.js';

const ast = (markdown: string): any => unified().use(remarkParse).parse(markdown);
const value = (node: any): string => node.value ?? (node.children ?? []).map(value).join('');
const slice = (raw: string, node: any) => raw.slice(node.position.start.offset, node.position.end.offset);
function walk(node: any, visit: (node: any) => void) { visit(node); for (const child of node.children ?? []) walk(child, visit); }
export interface ContentField {
  id: string; label: string; kind: 'markdown'; skeleton: string; guidance: string[];
  anchors: string[]; tables: { header: string[]; labels: string[]; optionalLabels: boolean }[];
  repeat: boolean; flexibleTitle: boolean; fixed: string[];
}
export interface ContentTemplate { version: 1; mapping: 'sections-v1'; hash: string; prefix: string; fields: ContentField[]; sections: { title: string; fieldId?: string; fixed?: string; suffix: string }[] }
const row = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(x => x.trim());
function tables(raw: string) {
  const lines = raw.split('\n'), result: string[][][] = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!lines[i]!.trim().startsWith('|') || !row(lines[i + 1]!).every(x => /^:?-{3,}:?$/.test(x))) continue;
    const table = [row(lines[i]!)]; i += 2;
    while (i < lines.length && lines[i]!.trim().startsWith('|')) { table.push(row(lines[i]!)); i++; }
    result.push(table);
  }
  return result;
}
export function compileContent(raw: string): ContentTemplate {
  if (/<%\*/.test(raw)) throw new CosmosError('INVALID_TEMPLATE', '命令模板不能用作正文模板。');
  const body = splitNote(raw).body.replace(/^# (?:<%\s*tp.file.title\s*%>|\{\{title\}\})\s*$/gm, '').trim();
  if (/<%|\{\{/.test(body)) throw new CosmosError('CAPABILITY_MISSING', '正文模板含不支持的程序或变量。', {}, 3);
  const nodes: any[] = ast(body).children, headings = nodes.filter(n => n.type === 'heading' && n.depth === 2);
  if (!headings.length) throw new CosmosError('INVALID_TEMPLATE', '正文模板没有可解析的章节。');
  const fields: ContentField[] = [], sections: ContentTemplate['sections'] = [];
  const publicMarker = /<!--\s*amytis:public:(?:start|end)\s*-->/g;
  const prefix = (body.slice(0, headings[0]!.position.start.offset).match(publicMarker) ?? []).join('\n');
  for (let index = 0; index < headings.length; index++) {
    const heading = headings[index]!, start = heading.position.end.offset, end = headings[index + 1]?.position.start.offset ?? body.length;
    const source = body.slice(start, end).trim(), tree = ast(source), guidance: string[] = [], anchors: string[] = [], fixed: string[] = [];
    walk(tree, node => {
      if (node.type === 'html' && /^<!--/.test(node.value) && !/amytis:public/.test(node.value)) guidance.push(node.value.replace(/^<!--|-->$/g, '').trim());
      if (node.type === 'paragraph' && node.children?.length === 1 && node.children[0].type === 'strong') anchors.push(value(node.children[0]));
      if (node.type === 'code') fixed.push(slice(source, node));
      if (node.type === 'list' && node.children?.every((n: any) => n.checked !== undefined || /^- \[ \]/m.test(slice(source, n)))) fixed.push(slice(source, node));
    });
    const skeleton = source.replace(/<!--[\s\S]*?-->/g, '').trim(), suffix = (source.match(publicMarker) ?? []).join('\n');
    const title = value(heading), editable = skeleton.replace(/```[\s\S]*?```/g, '').replace(/^- \[[ x]\].*$/gm, '').trim().length > 0 || guidance.some(x => !/^(以下读取|显示计划|此处及其他内部)/.test(x)) && !fixed.length;
    if (!editable) { sections.push({ title, fixed: skeleton, suffix }); continue; }
    const field: ContentField = { id: 's' + (index + 1), label: title, kind: 'markdown', skeleton, guidance, anchors: [...new Set(anchors)], tables: tables(skeleton).map(t => ({ header: t[0]!, labels: t.slice(1).map(r => r[0]!).filter(Boolean), optionalLabels: guidance.some(x => /不需要的行可删除/.test(x)) })), repeat: tree.children.some((n: any) => n.type === 'heading' && n.depth === 3) && guidance.some(x => /重复|复制这一小节|增减小节|repeat|sections/.test(x)), flexibleTitle: guidance.some(x => /标题与段落结构可以|Rename these headings|增减小节/.test(x)), fixed };
    fields.push(field); sections.push({ title, fieldId: field.id, suffix });
  }
  return { version: 1, mapping: 'sections-v1', hash: fingerprint(raw), prefix, fields, sections };
}
function fail(field: ContentField, reason: string): never { throw new CosmosError('CONTENT_INVALID', reason, { field: 'content.fields.' + field.id, label: field.label }); }
function nonempty(text: string) { return text.replace(/[*_`#|\s\[\]>-]/g, '').length >= 4 && !/^(待补充|待填写|TODO|TBD|未知|unknown)$/i.test(text.trim()); }
function checkSection(field: ContentField, markdown: string) {
  if (!markdown.trim() || /<%|\{\{|amytis:public|^---(?:\s|$)/m.test(markdown)) fail(field, '正文不能注入属性、模板程序或公开区间。');
  const tree = ast(markdown), nodes: any[] = tree.children;
  walk(tree, node => { if (node.type === 'html' || node.type === 'heading' && node.depth < 3 || node.url && /^\s*(?:javascript|data):/i.test(node.url)) fail(field, '正文含不允许的 HTML、标题层级或链接。'); });
  for (const code of field.fixed) if (!markdown.includes(code)) fail(field, '模板中的查询或固定检查表必须保留。');
  const groups = field.repeat ? markdown.split(/(?=^###\s)/m).filter(x => /^###\s/.test(x.trim())) : [markdown];
  if (field.repeat && !groups.length) fail(field, '此章节需要至少一个真实场景或摘录片段。');
  for (const group of groups) {
    if (field.repeat && /^###\s+(?:时间 · (?:场景|地点|关键片段)|位置 · 主题|章节 \/ 页码 · 主题|一个主要段落|A central section)\s*$/m.test(group)) fail(field, '重复片段标题需要对应真实时间、地点或主题。');
    let position = -1;
    for (const anchor of field.anchors) {
      const marker = '**' + anchor + '**', at = group.indexOf(marker);
      if (at <= position) fail(field, '固定标签缺失、重复次序错误或跨片段缺失：' + anchor);
      position = at;
      const rest = group.slice(at + marker.length).split(/\n(?:\*\*|#{1,6}\s|```)/)[0]!;
      if (!nonempty(rest)) fail(field, '固定标签后需要实际内容或说明未知原因：' + anchor);
    }
  }
  const renderedTables = tables(markdown);
  for (const required of field.tables) {
    const table = renderedTables.find(t => fingerprint(t[0]) === fingerprint(required.header));
    if (!table || table.length < 2) fail(field, '固定表头需要保留，并填入实际数据。');
    if (!required.optionalLabels && required.labels.some((label, index) => table![index + 1]?.[0] !== label)) fail(field, '固定表格标签或顺序发生变化。');
    for (const cells of table!.slice(1)) if (cells.length !== required.header.length || cells.some(cell => !cell.trim() || /^(?:待补充|待填写|TODO|TBD|未知|unknown)$/i.test(cell))) fail(field, '表格每个单元格需要内容；未知信息需说明原因。');
  }
  for (let i = 0; i < nodes.length; i++) if (nodes[i]!.type === 'heading' && (i + 1 === nodes.length || nodes[i + 1]!.type === 'heading')) fail(field, '正文不能留空小节。');
  let prose = markdown;
  for (const anchor of field.anchors) prose = prose.replaceAll('**' + anchor + '**', '');
  for (const fixed of field.fixed) prose = prose.replace(fixed, '');
  for (const t of field.tables) for (const token of [...t.header, ...t.labels]) prose = prose.replaceAll(token, '');
  prose = prose.replace(/^#{1,6}.*$/gm, '');
  if (!nonempty(prose) || prose.trim().length < 12) fail(field, '正文不能只交付空骨架，需要具体内容或未知原因。');
}
export function renderContent(template: ContentTemplate, title: string, content: unknown) {
  if (!content || typeof content !== 'object' || Array.isArray(content) || Object.keys(content).some(k => k !== 'fields')) throw new CosmosError('INVALID_INPUT', '正文只接收 content.fields。');
  const fields = (content as any).fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new CosmosError('INVALID_INPUT', 'fields 需要模板字段对象。');
  const ids = template.fields.map(x => x.id);
  if (Object.keys(fields).some(id => !ids.includes(id)) || ids.some(id => !(id in fields))) throw new CosmosError('CONTENT_INVALID', '字段必须匹配本草稿的实际模板。', { expected: ids, actual: Object.keys(fields) });
  const rendered = new Map<string, { title: string; markdown: string }>();
  for (const field of template.fields) {
    const input = fields[field.id], item = typeof input === 'string' ? { markdown: input } : input;
    if (!item || typeof item.markdown !== 'string' || Object.keys(item).some(k => !['markdown','title'].includes(k))) fail(field, '字段需要 Markdown 或 {markdown,title}。');
    if (item.title !== undefined && (!field.flexibleTitle || typeof item.title !== 'string' || /[\r\n<>#]/.test(item.title) || !item.title.trim())) fail(field, '此字段不允许更换标题或标题格式不合法。');
    checkSection(field, item.markdown); rendered.set(field.id, { title: item.title ?? field.label, markdown: item.markdown.trim() });
  }
  return [template.prefix, '# ' + title, ...template.sections.map(section => { const field = section.fieldId && rendered.get(section.fieldId); return '## ' + (field ? field.title : section.title) + '\n\n' + (field ? field.markdown : section.fixed ?? '') + (section.suffix ? '\n\n' + section.suffix : ''); })].filter(Boolean).join('\n\n').trim();
}
