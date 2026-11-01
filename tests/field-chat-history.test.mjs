import test from 'node:test';
import assert from 'node:assert/strict';
import {FIELD_CHAT_HISTORY,previewFieldChatHistory,assertHistoricalImportSafe} from '../src/field-chat-history.js';

const cloudPure4g={
  id:'TR-existing-pure-4g',menu:'Pure Matcha 16 oz',cat:'Matcha',status:'SENSORY_LOCKED',
  changed:'5 g ไป 4 g',formula:'Yamito Matcha 4 g\nWarm water 40 g at 70°C\nCold water 120 g\nLarge ice 160 g',
  t0:'',t5:'',t10:'',t15:'',notes:'owner-approved 4 g master',created:'2026-11-02'
};

test('history import previews five evidence-labeled candidates without replacing Pure Matcha 4 g',()=>{
  const plan=previewFieldChatHistory([cloudPure4g]);
  assert.equal(FIELD_CHAT_HISTORY.length,5);
  assert.equal(plan.trials.added,5);
  assert.equal(plan.trials.unchanged,0);
  assert.equal(plan.conflicts.length,0);
  assert.equal(plan.incoming.trials.find(x=>x.id==='FIELD-CHAT-PM5-SUPERSEDED')?.status,'HOLD');
  assert.equal(plan.incoming.trials.find(x=>x.id==='FIELD-CHAT-PM5-SUPERSEDED')?.formula.includes('5 g'),true);
  assert.equal(plan.incoming.trials.every(x=>x.created==='Historical ChatGPT transcription'),true);
  assert.equal(plan.incoming.trials.every(x=>['scoreTaste','scoreBody','scoreIdentity','scoreDilution','scoreOverall'].every(k=>x[k]==='')),true);
  assert.equal(plan.incoming.trials.every(x=>!x.trialDate),true);
  assert.equal(cloudPure4g.formula.includes('4 g'),true);
});

test('same stable id with different content blocks the batch',()=>{
  const changed={...FIELD_CHAT_HISTORY[1],formula:'Yamito matcha 99 g'};
  const plan=previewFieldChatHistory([changed]);
  assert.equal(plan.conflicts.some(x=>x.id===changed.id),true);
  assert.equal(plan.canImport,false);
  assert.throws(()=>assertHistoricalImportSafe(plan),/rd_chat_history_conflict/);
});

test('same menu and equivalent ingredient gram pairs are treated as duplicate',()=>{
  const row=FIELD_CHAT_HISTORY[2];
  const equivalent={...row,id:'TR-equivalent-coconut',formula:'Yamito 5 g, warm water 40 g at 70°C, SENORITA coconut syrup 20 g, cold water 105 g'};
  const plan=previewFieldChatHistory([equivalent]);
  assert.equal(plan.semanticDuplicates.some(x=>x.id===row.id),true);
  assert.equal(plan.incoming.trials.some(x=>x.id===row.id),false);
});

test('repeated preview after a successful import yields no new records',()=>{
  const first=previewFieldChatHistory([cloudPure4g]);
  const second=previewFieldChatHistory([cloudPure4g,...assertHistoricalImportSafe(first).trials]);
  assert.equal(second.trials.added,0);
  assert.equal(second.canImport,false);
});
