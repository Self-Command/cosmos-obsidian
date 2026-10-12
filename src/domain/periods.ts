import { object, text, contentSchema } from '../registry/schema.js';
import { fingerprint } from './identity.js';
export const journalSchema = object({ action: { const: 'journal.create' }, period: { enum: ['day','week','month','quarter','year'] }, date: text, content: contentSchema }, ['action','period','date']);
export const periodNames: Record<string,string> = { day: 'daily', week: 'weekly', month: 'monthly', quarter: 'quarterly', year: 'yearly' };
export const periodEnvironment = (plugin: any) => fingerprint({ version: plugin.manifest.version, settings: Object.fromEntries(Object.values(periodNames).map(k => [k, plugin.settings[k]])) });
