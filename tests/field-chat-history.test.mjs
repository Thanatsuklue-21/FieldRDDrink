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

test('partial one-ingredient notes cannot silently suppress a historical Trial',()=>{
  const candidate=FIELD_CHAT_HISTORY[2];
  const partial={...candidate,id:'TR-partial-coconut',formula:'Yamito 5 g'};
  const plan=previewFieldChatHistory([partial]);
  assert.equal(plan.semanticDuplicates.some(row=>row.id===candidate.id),false);
  assert.equal(plan.incoming.trials.some(row=>row.id===candidate.id),true);
});

// Regression: the device seed already holds ML-01 / PM-02 with the same gram
// amounts written under different ingredient names. These must be surfaced for
// review and excluded from the default selection, never auto-imported as a
// second copy and never silently suppressed.
const seedML01={id:'ML-01',menu:'Matcha Latte',cat:'Matcha',status:'NEEDS_ADJUSTMENT',changed:'Baseline trial',
  formula:'Yamito 5 g · Crystal 40 g @70°C · Mitr Phol Original Cane Syrup 15 g · CP-Meiji 110 g'};
const seedPM02={id:'PM-02',menu:'Pure Matcha',cat:'Matcha',status:'SENSORY_LOCKED',changed:'Water 180→160 g',
  formula:'Yamito 5 g · Crystal 40 g @70°C · Crystal cold water 120 g'};

test('same-gram recipes under different ingredient names are flagged and not selected by default',()=>{
  const plan=previewFieldChatHistory([seedML01,seedPM02,cloudPure4g]);
  assert.deepEqual(plan.possibleDuplicates.map(x=>x.id).sort(),['FIELD-CHAT-ML-SYRUP15','FIELD-CHAT-PM5-SUPERSEDED']);
  assert.deepEqual(plan.possibleDuplicates.find(x=>x.id==='FIELD-CHAT-ML-SYRUP15').matches,['ML-01']);
  assert.equal(plan.defaultSelection.includes('FIELD-CHAT-ML-SYRUP15'),false);
  assert.equal(plan.defaultSelection.includes('FIELD-CHAT-PM5-SUPERSEDED'),false);
  assert.equal(plan.defaultSelection.includes('FIELD-CHAT-COCONUT-APPROVED'),true);
  // Still reviewable: flagged rows remain in incoming so the owner can opt in.
  assert.equal(plan.incoming.trials.some(x=>x.id==='FIELD-CHAT-ML-SYRUP15'),true);
});

test('Pure Matcha 4 g is never a match for the 5 g historical record',()=>{
  const plan=previewFieldChatHistory([cloudPure4g]);
  assert.equal(plan.possibleDuplicates.length,0);
  assert.equal(plan.defaultSelection.length,5);
});

test('selection filters the batch and rejects ids outside the reviewed plan',()=>{
  const plan=previewFieldChatHistory([seedML01]);
  const picked=assertHistoricalImportSafe(plan,plan.defaultSelection).trials.map(x=>x.id);
  assert.equal(picked.includes('FIELD-CHAT-ML-SYRUP15'),false);
  assert.equal(picked.length,plan.defaultSelection.length);
  assert.throws(()=>assertHistoricalImportSafe(plan,['ML-01']),/rd_chat_history_selection_invalid/);
  assert.equal(assertHistoricalImportSafe(plan).trials.length,plan.incoming.trials.length);
});

test('Thai size suffix is normalized like the English one',()=>{
  const thai={...FIELD_CHAT_HISTORY[3],id:'TR-orange-thai',menu:'Orange Sunquick 16 ออนซ์',
    formula:'Sunquick orange concentrate 25 g; cold water 145 g; full ice'};
  const plan=previewFieldChatHistory([thai]);
  assert.equal(plan.semanticDuplicates.some(x=>x.id==='FIELD-CHAT-ORANGE-APPROVED'),true);
});
