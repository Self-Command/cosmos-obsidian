import { CosmosError } from '../errors.js';
// The CLI's external CommonJS dispatcher does not receive the plugin-scoped `require('obsidian')`.
// Bind only the author's date library imports to classes from this actual running vault.
const app = (globalThis as any).window?.app;
if (!app?.vault?.getRoot || !app.vault.getMarkdownFiles().length) throw new CosmosError('CAPABILITY_MISSING', '日期接口需要运行中的 Obsidian 及当前模板文件。', {}, 3);
export const Vault = app.vault.constructor;
export const TFolder = app.vault.getRoot().constructor;
export const TFile = app.vault.getMarkdownFiles()[0].constructor;
export const normalizePath = (value: string) => value.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\/|\/$/g, '');
// Library notices mark failed creation/read paths. Surface them as structured failures to CLI callers.
export class Notice { constructor(message: string) { throw new CosmosError('PERIODIC_SERVICE_FAILED', message, {}, 4); } }
