import test from 'node:test';
import assert from 'node:assert/strict';
import {CLOUD_CACHE_KEY,newCloudCache,readCloudCache,writeCloudCache,queueCloudRecords,syncCloud} from '../src/cloud-sync.js';
const trial=id=>({id,menu:'Matcha',status:'PLANNED',changed:'water 60→50 g',formula:'matcha 5 g · water 50 g'});
function storage(){const map=new Map();return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}}
function setup(){const s=storage();const c=writeCloudCache(s,newCloudCache('project|owner'));return {s,c};}
function reply(records){return {records:records.map((r,i)=>({...r,revision:i+1})),revision:records.length};}
test('offline pending survives reload and exact replay creates one record',async()=>{
  const {s,c}=setup();queueCloudRecords(s,c,{trials:[trial('T1')],sources:[]},'batch1');
  await assert.rejects(syncCloud({storage:s,owner:c.owner,remote:async()=>{throw Error('offline')}}),/offline/);
  assert.equal(readCloudCache(s,c.owner).pending.length,1);
  const saved=new Map();let first=true;
  const remote=async records=>{records.forEach(r=>saved.set(r.payload.id,r));if(first){first=false;throw Error('reply lost')}return reply([...saved.values()]);};
  await assert.rejects(syncCloud({storage:s,owner:c.owner,remote}),/reply lost/);
  const result=await syncCloud({storage:s,owner:c.owner,remote});
  assert.equal(saved.size,1);assert.equal(result.pending.length,0);assert.equal(result.trials.length,1);assert.ok(result.lastSync);
});
test('new device reads exact remote data without local seed',async()=>{
  const {s,c}=setup();const out=await syncCloud({storage:s,owner:c.owner,remote:async()=>reply([{kind:'trial',payload:trial('PC-1')}])});
  assert.deepEqual(out.trials,[trial('PC-1')]);assert.equal(out.pending.length,0);
});
test('same ID with changed content stops all changes and preserves outbox',async()=>{
  const {s,c}=setup();queueCloudRecords(s,c,{trials:[trial('T1')],sources:[]},'batch1');
  const before=s.getItem(CLOUD_CACHE_KEY);
  await assert.rejects(syncCloud({storage:s,owner:c.owner,remote:async()=>reply([{kind:'trial',payload:{...trial('T1'),formula:'changed'}}])}),/unacknowledged/);
  assert.equal(s.getItem(CLOUD_CACHE_KEY),before);
});
test('local write while network in flight is preserved and remains pending',async()=>{
  const {s,c}=setup();queueCloudRecords(s,c,{trials:[trial('T1')],sources:[]},'b1');
  const out=await syncCloud({storage:s,owner:c.owner,remote:async sent=>{
    queueCloudRecords(s,readCloudCache(s,c.owner),{trials:[trial('T2')],sources:[]},'b2');return reply(sent);
  }});
  assert.deepEqual(out.trials.map(t=>t.id),['T1','T2']);assert.deepEqual(out.pending.map(b=>b.id),['b2']);
});
test('corrupt or unavailable storage fails visibly instead of empty success',async()=>{
  const {s,c}=setup();s.setItem(CLOUD_CACHE_KEY,'{bad');assert.throws(()=>readCloudCache(s,c.owner));
  let calls=0;await assert.rejects(syncCloud({storage:s,owner:c.owner,remote:async()=>{calls++}}));assert.equal(calls,0);
  const unavailable={getItem(){throw Error('storage unavailable')}};assert.throws(()=>readCloudCache(unavailable,c.owner),/unavailable/);
});
test('different account/project cannot read, upload or reuse a pending cache',async()=>{
  const {s,c}=setup();queueCloudRecords(s,c,{trials:[trial('private')],sources:[]},'b');
  let calls=0;await assert.rejects(syncCloud({storage:s,owner:'other',remote:async()=>{calls++}}),/other_account/);assert.equal(calls,0);
});
test('failed cache commit retains pending batch for safe retry',async()=>{
  const {s,c}=setup();queueCloudRecords(s,c,{trials:[trial('T1')],sources:[]},'b');
  const set=s.setItem;s.setItem=(k,v)=>{if(k===CLOUD_CACHE_KEY)throw Error('quota');set(k,v)};
  await assert.rejects(syncCloud({storage:s,owner:c.owner,remote:async sent=>reply(sent)}),/quota/);
  assert.equal(readCloudCache(s,c.owner).pending.length,1);
});
test('malformed remote response cannot erase acknowledged history',async()=>{
  const {s,c}=setup();writeCloudCache(s,{...c,trials:[trial('T1')],revision:1,lastSync:'before'});
  await assert.rejects(syncCloud({storage:s,owner:c.owner,remote:async()=>({records:[],revision:1})}),/history_missing/);
  assert.equal(readCloudCache(s,c.owner).lastSync,'before');
});
test('client prevents fake LOCK gates and duplicate local IDs before storage commit',()=>{
  const {s,c}=setup();assert.throws(()=>queueCloudRecords(s,c,{trials:[{...trial('T1'),status:'LOCKED',repeatability:'true'}],sources:[]}),/invalid_trial/);
  assert.throws(()=>queueCloudRecords(s,c,{trials:[trial('T1'),trial('T1')],sources:[]}));
  assert.equal(readCloudCache(s,c.owner).trials.length,0);
});
