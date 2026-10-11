import { object, text } from '../registry/schema.js';
const strings = { type: 'array', items: text, maxItems: 100 };
export const publicationValues = object({ language: { enum: ['zh','en'] }, kind: { enum: ['post','note','flow','collection','series','book'] }, role: { enum: ['entry','index'] }, slug: text, date: text, title: text, excerpt: {type:'string'}, coverImage: {type:'string'}, tags: strings, permission: {type:'boolean'}, scope: {enum:['marked','whole']}, members: strings, outline: {type:'array',maxItems:100} }, ['language','kind','slug','date','title','permission','scope']);
export const writingSchema = object({ action: {const:'writing.create'}, name: text, folder: text, values: publicationValues, relations: object({project:text,area:text}), content: {type:'object'} }, ['action','name','values']);
export const publicationSchema = { oneOf: [
  object({action:{const:'register'},path:text,values:publicationValues},['action','path','values']),
  object({action:{const:'copy'},path:text,name:text,folder:text,values:publicationValues},['action','path','name','values']),
  object({action:{const:'upload'},ids:strings,allowMigration:{type:'boolean'}},['action','ids']),
  object({action:{enum:['resume','refresh']},batch:text},['action','batch']),
  object({action:{const:'withdraw'},id:text},['action','id'])
] };
