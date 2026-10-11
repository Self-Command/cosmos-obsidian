import {it,expect} from 'vitest';
import fs from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Context} from '../src/runtime/context.js';
import {journalPublication,readPublicationJournal} from '../src/runtime/publication-journal.js';
it('persists mutation intent before dispatch and leaves an unknown response durable without storing content or credentials',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'cosmos-journal-'));
  const ctx=new Context({plugins:{plugins:{}}},root,'rules.json');ctx.stateRoot=root;ctx.bindingId='bound';ctx.executionId='e-00000000-0000-0000-0000-000000000001';
  let sent=0;
  const reload=async()=>({__amytisOwnedRequest:async(_route:string,_params:any)=>{
    const saved=readPublicationJournal(ctx,ctx.executionId!);expect(saved.events.at(-1)?.intent.ref).toBe('refs/heads/amytis-publish/one');expect(saved.events.at(-1)?.result).toBeUndefined();sent++;throw Error('Connection ended after server accepted request');
  }});
  const plugin={reloadOctokit:reload};ctx.app.plugins.plugins['obsidian-mkdocs-publisher']=plugin;
  try{
    await expect(journalPublication(ctx,async()=>{
      const client=await plugin.reloadOctokit();return client.__amytisOwnedRequest('POST /repos/{owner}/{repo}/git/refs',{owner:'Self-Command',repo:'amytis',ref:'refs/heads/amytis-publish/one',sha:'a'.repeat(40),token:'private-token',content:'private-content'});
    })).rejects.toThrow();
    expect(sent).toBe(1);expect(plugin.reloadOctokit).toBe(reload);
    const raw=fs.readFileSync(path.join(root,'publication',ctx.executionId+'.json'),'utf8');expect(raw).not.toContain('private-');expect(readPublicationJournal(ctx,ctx.executionId).events[0]!.result).toBeUndefined();
  }finally{await rm(root,{recursive:true,force:true});}
});
