import { object, text } from '../registry/schema.js';
import { taskSchema, taskChangeSchema } from './tasks.js';
import { entitySchema } from './entities.js';
import { journalSchema } from './periods.js';
const creation = (schema: any, action: string) => ({ ...schema, properties: { ...schema.properties, action: { const: action } }, required: [...schema.required,'action'] });
export const evolveSchema = object({ action: { const: 'entity.evolve' }, path: text, transition: text, name: text, folder: text, category: text, attributes: entitySchema.properties.attributes, relations: entitySchema.properties.relations, tags: entitySchema.properties.tags, content: { type: 'object' }, evidence: object({ url: text, publishedDate: text, description: text }, ['url','publishedDate','description']) }, ['action','path','transition']);
export const fileChangeSchema = { oneOf: [
  object({ action: { const: 'content.patch' }, path: text, find: text, replace: { type: 'string' } }, ['action','path','find','replace']),
  object({ action: { const: 'relations.patch' }, path: text, relations: object({ project: { type: ['string','null'] }, area: { type: ['string','null'] } }) }, ['action','path','relations']),
  object({ action: { const: 'file.rename' }, path: text, name: text }, ['action','path','name']),
  object({ action: { const: 'file.move' }, path: text, folder: text }, ['action','path','folder']),
  object({ action: { const: 'file.recycle' }, path: text }, ['action','path'])
] };
export const changeItemSchema = { oneOf: [taskChangeSchema, creation(taskSchema, 'task.create'), creation(entitySchema, 'entity.create'), evolveSchema, fileChangeSchema, journalSchema] };
export const changeSchema = object({ actions: { type: 'array', minItems: 1, maxItems: 50, items: changeItemSchema } }, ['actions']);
export const draftSchema = { oneOf: [entitySchema, evolveSchema, journalSchema] };
