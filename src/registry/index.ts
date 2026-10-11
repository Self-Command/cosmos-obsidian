import { object } from './schema.js';
import { taskSchema, taskChangeSchema } from '../domain/tasks.js';
import { entitySchema } from '../domain/entities.js';
export interface Operation { id: string; command: string; effect: 'read' | 'preview' | 'write' | 'state'; schema: object; capabilities: string[]; description: string }
export const registry: Operation[] = [
  { id: 'inspect.capabilities', command: 'inspect capabilities', effect: 'read', schema: object({}), capabilities: [], description: '查询当前绑定库与运行时能力。' },
  { id: 'task.preview', command: 'task preview', effect: 'preview', schema: taskSchema, capabilities: ['tasks.write'], description: '按实际规则和 TaskNotes 映射预览任务创建。' },
  { id: 'entity.preview', command: 'entity preview', effect: 'preview', schema: entitySchema, capabilities: [], description: '根据实际模板和完整内容预览普通实体创建。' },
  { id: 'draft.open', command: 'draft open', effect: 'state', schema: entitySchema, capabilities: [], description: '锁定实体、目录和模板，返回必要写作字段。' },
  { id: 'draft.preview', command: 'draft preview', effect: 'preview', schema: object({ fields: { type: 'object' } }, ['fields']), capabilities: [], description: '为原草稿填写内容并保存新的不可变预览。' },
  { id: 'change.preview', command: 'change preview', effect: 'preview', schema: object({ actions: { type: 'array', minItems: 1, maxItems: 50, items: taskChangeSchema } }, ['actions']), capabilities: ['tasks.write'], description: '预览指定任务变更或重复实例动作。' },
  { id: 'query.tasks', command: 'query tasks', effect: 'read', schema: object({ title: { type: 'string' }, status: { type: 'string' }, folder: { type: 'string' }, project: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 100 } }), capabilities: ['tasks.read'], description: '查询 TaskNotes 任务。' },
  { id: 'review.show', command: 'review show', effect: 'read', schema: object({}), capabilities: [], description: '读取原方案完整预览。' },
  { id: 'review.commit', command: 'review commit', effect: 'write', schema: object({}), capabilities: [], description: '批准后提交不可变方案并读回。' },
  { id: 'review.cancel', command: 'review cancel', effect: 'state', schema: object({}), capabilities: [], description: '取消未派发的方案。' },
  { id: 'execution.status', command: 'execution status', effect: 'read', schema: object({}), capabilities: [], description: '查询原执行状态，不派发。' },
  { id: 'execution.verify', command: 'execution verify', effect: 'read', schema: object({}), capabilities: [], description: '查询回执并读回实际结果，不派发。' }
];
export const findOperation = (command: string) => registry.find(x => x.command === command);
export const commandHelp = () => registry.map(({ schema, ...operation }) => ({ ...operation, inputSchema: schema }));
