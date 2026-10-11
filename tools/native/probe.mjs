import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const started = Date.now();
let last;
let enabled = false;
const binding = JSON.parse(await readFile(process.env.COSMOS_CONFIG, 'utf8'));
function cli(args) { return new Promise(resolve => { const child = spawn(process.execPath, ['dist/cosmos.mjs', ...args], { shell: false, windowsHide: true }); let out = '', err = ''; child.stdout.on('data', b => out += b); child.stderr.on('data', b => err += b); child.on('error', error => resolve({ code: -1, err: error.message })); child.on('close', code => resolve({ code, out, err })); }); }
function native(args) { return new Promise((resolve, reject) => { const child = spawn(binding.cliPath, ['vault=' + binding.vaultName, ...args], { shell: false, windowsHide: true }); let out = '', err = ''; const timer = setTimeout(() => { child.kill(); reject(Error('Native setup command timed out')); }, 20000); child.stdout.on('data', b => out += b); child.stderr.on('data', b => err += b); child.on('error', reject); child.on('close', code => { clearTimeout(timer); resolve({ code, out, err }); }); }); }
while (Date.now() - started < 150000) {
  last = await cli(['inspect', 'capabilities']);
  try {
    const result = JSON.parse(last.out);
    if (result.ok && !result.capabilities.tasknotes && !enabled) {
      // The official CLI manages restricted mode in this disposable acceptance vault only.
      console.log(JSON.stringify(await native(['plugins:restrict', 'off'])));
      console.log(JSON.stringify(await native(['plugin:enable', 'id=tasknotes'])));
      enabled = true;
    }
    if (last.code === 0 && result.capabilities?.tasknotes?.apiVersion === 1) {
      const tasknotes = result.capabilities.tasknotes;
      assert.equal(tasknotes.version, '4.13.8');
      assert.ok(tasknotes.capabilities.includes('tasks.write'));
      assert.ok(tasknotes.capabilities.includes('recurring.write'));
      assert.ok(tasknotes.statuses.length > 0);
      await mkdir('artifacts', { recursive: true });
      await writeFile('artifacts/native-capabilities.json', JSON.stringify({ sourceSha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, elapsedMs: Date.now() - started, ...result }, null, 2));
      console.log('Real Obsidian/TaskNotes API handshake passed.');
      process.exit(0);
    }
  } catch {}
  await new Promise(resolve => setTimeout(resolve, 2000));
}
await mkdir('artifacts', { recursive: true });
const diagnostics = await native(['dev:errors']).catch(error => ({ error: error.message }));
console.log(JSON.stringify(diagnostics));
await writeFile('artifacts/native-failure.json', JSON.stringify({ sourceSha: process.env.GITHUB_SHA, last, diagnostics }, null, 2));
throw Error('Real Obsidian/TaskNotes readiness failed: ' + JSON.stringify(last));
