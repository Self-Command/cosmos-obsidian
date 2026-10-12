import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { normalizeTask, normalizeTaskChange, tags } from '../src/domain/tasks.js';
import { schedule } from '../src/domain/dates.js';
import { Store, type Review } from '../src/state/store.js';
import { Reviews, planSummary, previewLocation } from '../src/workflows/review.js';
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
  it('resolves relative dates from the preview clock in the supplied timezone while retaining explicit historical bases',()=>{
    const now=new Date('2026-10-11T17:30:00Z');
    expect(schedule({relativeDays:1,time:'10:30',timeZone:'Asia/Shanghai'},now)).toBe('2026-10-13T10:30');
    expect(schedule({relativeDays:1,timeZone:'America/New_York'},now)).toBe('2026-10-12');
    expect(schedule({relativeDays:1,baseDate:'2025-12-31',timeZone:'Asia/Shanghai'},now)).toBe('2026-01-01');
    expect(()=>schedule({relativeDays:1,baseDate:'2026-02-30',timeZone:'Asia/Shanghai'},now)).toThrow();
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
  it('returns a usable link to the actual preview path including Windows separators and spaces',()=>{
    const location=previewLocation('C:\\A Vault\\state\\previews\\r-original.md');
    expect(location.path).toBe('C:\\A Vault\\state\\previews\\r-original.md');
    expect(location.link).toBe('[查看完整预览](<C:/A Vault/state/previews/r-original.md>)');
  });
  it('shows the actual pinned properties and short body, with a bounded outline for long content',()=>{
    const plan:Plan={version:1,bindingId:'bound',steps:[{action:'task.create',path:'task.md',data:{privateTransport:'excluded'},expected:{properties:{scheduled:'2026-10-13T10:30',priority:'high'},body:'# 任务\n\n核对金额后保留收据。'}},{action:'entity.create',path:'trip.md',data:{},expected:{body:'# 游记\n\n## 现场\n\n'+'山路与雨水。'.repeat(600)}}],dependencies:[],environment:{},warnings:[]};
    const summary=planSummary(plan);
    expect(summary.changes[0]!.properties?.scheduled).toBe('2026-10-13T10:30');expect(summary.changes[0]!.body).toContain('收据');
    expect(summary.changes[1]!.body).toBeUndefined();expect(summary.changes[1]!.content?.headings).toEqual(['游记','现场']);
    expect(JSON.stringify(summary)).not.toContain('privateTransport');
  });
  async function service(mode:'success'|'uncertain'='success') {
    const root=await mkdtemp(path.join(os.tmpdir(),'cosmos-review-'));cleanup.push(root);const store=new Store(root);
    let writes=0;
    const plan:Plan={version:1,bindingId:'bound',steps:[{action:'task.create',path:'太阳/核聚变/任务.md',data:{title:'任务'},expected:{body:'实际正文'}}],dependencies:[],environment:{},warnings:[]};
    const adapter:any={config:{bindingId:'bound',vaultPath:path.join(root,'vault')},store,request:async(action:string,input:any,id:string)=>{
      if(action==='task.prepare')return {state:'succeeded',result:plan};
      if(action==='review.execute'){writes++;if(mode==='uncertain')throw new CosmosError('RESULT_UNCERTAIN','timeout',{},5);return {id,bindingId:'bound',state:'succeeded',result:{state:'succeeded',verified:true,steps:[{index:0,state:'succeeded',verified:true,path:plan.steps[0]!.path,action:'task.create'}]}};}
      if(action==='execution.verify')return {id,bindingId:'bound',state:'succeeded',result:{state:'succeeded',verified:true,steps:[{index:0,state:'succeeded',verified:true,path:plan.steps[0]!.path,action:'task.create'}]}};
      throw Error('unexpected request');
    }};
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
    expect('steps' in first&&first.steps![0]!.absolutePath).toBe(path.join(s.store.root,'vault','太阳/核聚变/任务.md'));expect('steps' in second&&second.steps![0]!.absolutePath).toBe((await s.reviews.status(first.executionId!)).steps[0]!.absolutePath);
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
  it('retains execution identity when saving the final result fails',async()=>{
    const s=await service(),preview=await s.reviews.preview('task.prepare',{}),write=s.store.write.bind(s.store);
    let injected=false;
    s.store.write=async(kind,id,value:any)=>{if(kind==='executions'&&value.state==='succeeded'&&!injected){injected=true;throw Error('disk temporarily unavailable');}return write(kind,id,value);};
    const first=await s.reviews.commit(preview.reviewId,true);expect(first.state).toBe('uncertain');expect(s.writes()).toBe(1);
    const repeated=await s.reviews.commit(preview.reviewId,true);expect(repeated.executionId).toBe(first.executionId);expect(s.writes()).toBe(1);
    expect((await s.reviews.verify(first.executionId!)).state).toBe('succeeded');expect(s.writes()).toBe(1);
  });
});
