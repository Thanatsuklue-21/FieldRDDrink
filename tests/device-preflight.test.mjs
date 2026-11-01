import test from 'node:test';
import assert from 'node:assert/strict';
import {planDeviceImport} from '../src/cloud-sync.js';
const trial=(id,formula='matcha 5 g')=>({id,menu:'Matcha',changed:'water',formula,status:'PLANNED'});
const source=id=>({id,menu:'Matcha',url:'https://example.test',type:'OTHER',verified:false});
test('read-only preflight separates new, identical and conflicting records',()=>{
  const device={trials:[trial('new'),trial('same'),trial('conflict','matcha 6 g')],sources:[source('new-source')]};
  const cloud={trials:[trial('same'),trial('conflict')],sources:[]};
  const before=JSON.stringify({device,cloud});const plan=planDeviceImport(device,cloud);
  assert.deepEqual(plan.trials,{added:1,unchanged:1});assert.deepEqual(plan.sources,{added:1,unchanged:0});
  assert.equal(plan.canImport,false);assert.deepEqual(plan.conflicts[0].fields,['formula']);
  assert.equal(plan.conflicts[0].device.formula,'matcha 6 g');assert.equal(plan.conflicts[0].cloud.formula,'matcha 5 g');
  assert.equal(JSON.stringify({device,cloud}),before);
});
test('preflight queues only new records and recognizes reordered keys',()=>{
  const row=trial('known');const plan=planDeviceImport({trials:[trial('new'),{...row}],sources:[]},{trials:[Object.fromEntries(Object.entries(row).reverse())],sources:[]});
  assert.equal(plan.canImport,true);assert.deepEqual(plan.incoming.trials,[trial('new')]);assert.equal(plan.trials.unchanged,1);
});
test('rechecking after another device uploads prevents a stale import',()=>{
  const device={trials:[trial('T1')],sources:[]};
  assert.equal(planDeviceImport(device,{trials:[],sources:[]}).canImport,true);
  assert.equal(planDeviceImport(device,device).canImport,false);
  assert.equal(planDeviceImport(device,{trials:[trial('T1','different')],sources:[]}).conflicts.length,1);
});
test('preflight rejects duplicate or invalid device IDs without repairing or dropping data',()=>{
  assert.throws(()=>planDeviceImport({trials:[trial('T1'),trial('T1')],sources:[]},{trials:[],sources:[]}));
  assert.throws(()=>planDeviceImport({trials:[{...trial('T1'),status:'GUESS'}],sources:[]},{trials:[],sources:[]}));
});
test('empty device data never imports baseline records',()=>{
  const plan=planDeviceImport({trials:[],sources:[]},{trials:[trial('server')],sources:[]});
  assert.equal(plan.canImport,false);assert.deepEqual(plan.incoming,{trials:[],sources:[]});
});
test('evidence verification conflicts require explicit review, never overwrite',()=>{
  const plan=planDeviceImport({trials:[],sources:[{...source('SRC1'),verified:true}]},{trials:[],sources:[source('SRC1')]});
  assert.equal(plan.canImport,false);assert.deepEqual(plan.conflicts[0].fields,['verified']);
});
