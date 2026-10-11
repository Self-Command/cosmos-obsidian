import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { normalizeTask, normalizeTaskChange, tags } from '../src/domain/tasks.js';
import { schedule } from '../src/domain/dates.js';
import { Store, type Review } from '../src/state/store.js';
import { Reviews } from '../src/workflows/review.js';
import { CosmosError } from '../src/errors.js';
import type { Plan } from '../src/workflows/types.js';
const catalog = { statuses: () => [{value:'open',label:'未开始',isCompleted:false},{value:'done',label:'完成',isCompleted:true}], priorities: () => [{value:'low',label:'低',weight:1},{value:'high',label:'高',weight:4}] };
const api = { catalog, model: { validateTask: () => ({ valid: true }), validatePatch: () => ({ valid: true }) } };
const settings = { tasksFolder:'太阳/核聚变',taskFilenameFormat:'title',defaultTaskStatus:'open',defaultTaskPriority:'low',taskCreationDefaults:{defaultRecurrence:'none',defaultDueDate:'none',defaultScheduledDate:'none'} };
const cleanup: string[] = [];
afterEach(async () => { for (const root of cleanup.splice(0)) await rm(root, {recursive:true,force:true}); });
describe('task business contract', () => {
  it('pins relative dates once and keeps time estimate separate from due date', () => {
    const task = normalizeTask({title:'准备材料',schedule:{relativeDays:1,baseDate:'2026-10-11',time:'09:00',timeZone:'Asia/Shanghai'},estimateMinutes:30,priority:{rank:'highest'}},api,settings);
    expect(task.data.scheduled).toBe('2026-10-12T09:00'); expect(task.data.due).toBeUndefined(); expect(task.data.timeEstimate).toBe(30); expect(task.data.priority).toBe('high');
  });
  it.each(['2026-02-30','2026-13-01','2026-10-32'])('rejects nonexistent date %s', date => { expect(() => schedule({date,timeZone:'Asia/Shanghai'})).toThrow(); });
  it('rejects ambiguous ranked priority and undeclared fields', () => {
    const ambiguous={...api,catalog:{...catalog,priorities:()=>[{value:'high',weight:4},{value:'urgent',weight:4}]}};
    expect(()=>normalizeTask({title:'title',priority:{rank:'highest'}},ambiguous,settings)).toThrow();
    expect(()=>normalizeTask({title:'title',customFrontmatter:{type:'project'}},api,settings)).toThrow();
    expect(()=>tags(['route/太阳'])).toThrow();
  });
  it('requires an explicit instance date and desired state rather than accidental toggles', () => {
    expect(()=>normalizeTaskChange({action:'task.instance.complete',path:'太阳/核聚变/任务.md',completed:true})).toThrow();
    expect(normalizeTaskChange({action:'task.instance.complete',path:'太阳/核聚变/任务.md',date:'2026-10-12',completed:true}).completed).toBe(true);
  });
});
describe('review execution state', () => {
  async function service(mode:'success'|'uncertain'='success') {
    const root=await mkdtemp(path.join(os.tmpdir(),'cosmos-review-'));cleanup.push(root);const store=new Store(root);
    let writes=0;
    const plan:Plan={version:1,bindingId:'bound',steps:[{action:'task.create',path:'太阳/核聚变/任务.md',data:{title:'任务'},expected:{body:'实际正文'}}],dependencies:[],environment:{},warnings:[]};
    const adapter:any={config:{bindingId:'bound'},store,request:async(action:string,input:any,id:string)=>{
      if(action==='task.prepare')return {state:'succeeded',result:plan};
      if(action==='review.execute'){writes++;if(mode==='uncertain')throw new CosmosError('RESULT_UNCERTAIN','timeout',{},5);return {id,bindingId:'bound',state:'succeeded',result:{state:'succeeded',verified:true,steps:[{index:0,state:'succeeded',verified:true,path:plan.steps[0]!.path,action:'task.create'}]}};}
      if(action==='execution.verify')return {id,bindingId:'bound',state:'succeeded',result:{state:'succeeded',verified:true,steps:[{index:0,state:'succeeded',verified:true,path:plan.steps[0]!.path,action:'task.create'}]}};
      throw Error('unexpected request');
    };
    return {reviews:new Reviews(adapter),store,writes:()=>writes};
  }
  it('does not write before confirmation or after cancellation, including resumed commit', async () => {
    const s=await service(),preview=await s.reviews.preview('task.prepare',{});
    await expect(s.reviews.commit(preview.reviewId,false)).rejects.toThrow();expect(s.writes()).toBe(0);
    await s.reviews.cancel(preview.reviewId);await expect(s.reviews.commit(preview.reviewId,true)).rejects.toThrow();expect(s.writes()).toBe(0);
  });
  it('returns the existing execution on repeat commit and detects edited preview bytes',async()=>{
    const s=await service(),preview=await s.reviews.preview('task.prepare',{});
    const first=await s.reviews.commit(preview.reviewId,true),second=await s.reviews.commit(preview.reviewId,true);
    expect(second.executionId).toBe(first.executionId);expect(s.writes()).toBe(1);
    const next=await s.reviews.preview('task.prepare',{});await s.store.atomic(s.store.file('previews',next.reviewId),'edited');
    await expect(s.reviews.commit(next.reviewId,true)).rejects.toThrow();expect(s.writes()).toBe(1);
  });
  it('keeps uncertain execution locked, resumes by readback, and never redispatches',async()=>{
    const s=await service('uncertain'),preview=await s.reviews.preview('task.prepare',{}),first=await s.reviews.commit(preview.reviewId,true);
    expect(first.state).toBe('uncertain');await s.reviews.commit(preview.reviewId,true);expect(s.writes()).toBe(1);
    const lock=JSON.parse(await readFile(path.join(s.store.root,'locks/bound.lock'),'utf8'));expect(lock.executionId).toBe(first.executionId);
    const verified=await s.reviews.verify(first.executionId!);expect(verified.state).toBe('succeeded');expect(s.writes()).toBe(1);
    const next=await s.reviews.preview('task.prepare',{});expect(next.state).toBe('review-ready');
  });
});
