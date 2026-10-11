import { object } from './schema.js';
export interface Operation { id: string; command: string; effect: 'read' | 'preview' | 'write' | 'state'; schema: object; capabilities: string[]; description: string }
export const registry: Operation[] = [
  { id: 'inspect.capabilities', command: 'inspect capabilities', effect: 'read', schema: object({}), capabilities: [], description: '查询当前绑定库与运行时能力。' }
];
export const findOperation = (command: string) => registry.find(x => x.command === command);
export const commandHelp = () => registry.map(({ schema, ...operation }) => ({ ...operation, inputSchema: schema }));
