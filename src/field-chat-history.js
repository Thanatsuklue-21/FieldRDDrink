import {planDeviceImport,validateCollections} from './cloud-sync.js';

// Historical transcription is reviewed data, not a live ChatGPT-history API.
// IDs are stable, so repeated imports cannot create duplicate Trials.
export const FIELD_CHAT_HISTORY_VERSION = '2026-11-02';
const common = {
  cat:'Matcha', brand:'Yamito', cup:'16 oz', created:'Historical ChatGPT transcription',
  repeatability:false,dilution:false,cupIce:false,costing:false,sop:false,pos:false,qc:false,
  t0:'',t5:'',t10:'',t15:'',sourceRefs:'',scoreTaste:'',scoreBody:'',scoreIdentity:'',scoreDilution:'',scoreOverall:''
};
export const FIELD_CHAT_HISTORY = [
  {...common,id:'FIELD-CHAT-PM5-SUPERSEDED',menu:'Pure Matcha 16 oz (historical 5 g)',status:'HOLD',
    changed:'Owner superseded former 5 g master with 4 g',formula:'Yamito 5 g; warm water 40 g at 70°C; cold water 120 g; large ice 160 g',
    notes:'Historical 5 g reference only. DO NOT use as active master. Source: FIELD_MASTER_CONTROL_LIVE historical 2026-11-01 entry.'},
  {...common,id:'FIELD-CHAT-ML-SYRUP15',menu:'Matcha Latte 16 oz',status:'NEEDS_ADJUSTMENT',
    changed:'Syrup 20 g too sweet; 15 g preferred',formula:'Yamito 5 g; warm water 40 g; CP-Meiji milk 110 g; syrup 15 g; full cup ice',
    t0:'Owner: syrup 15 g already sweet enough; 20 g too sweet.',
    notes:'Historical sensory note; other recorded T10 observation says sweet-forward and faint matcha. Not production locked. Source: FIELD Project ChatGPT tasting history.'},
  {...common,id:'FIELD-CHAT-COCONUT-APPROVED',menu:'Coconut Matcha 16 oz',status:'SENSORY_LOCKED',
    changed:'Owner approved coconut matcha reference',formula:'Yamito 5 g; warm water 40 g at 70°C; SENORITA coconut syrup 20 g; cold water 105 g; full ice',
    notes:'Historical owner-approved recipe; no structured scores or production repeatability evidence. Source: FIELD Project ChatGPT R&D.'},
  {...common,id:'FIELD-CHAT-ORANGE-APPROVED',menu:'Orange Sunquick 16 oz',cat:'Soda',brand:'Sunquick',status:'SENSORY_LOCKED',
    changed:'Owner approved orange reference',formula:'Sunquick orange concentrate 25 g; cold water 145 g; full ice',
    notes:'Historical owner-approved recipe; no structured scores or production repeatability evidence. Source: FIELD Project ChatGPT R&D.'},
  {...common,id:'FIELD-CHAT-SIGNATURE-REVISION',menu:'FIELD Matcha Signature 16 oz',status:'NEEDS_ADJUSTMENT',
    changed:'SCM/EVM 30/30 g → owner-directed 20/20 g candidate; fresh milk quantity not approved',
    formula:'Candidate only: Yamito matcha 5 g; warm water 40 g; SCM 20 g; EVM 20 g; fresh milk quantity NOT CONFIRMED',
    t0:'Owner: prior 100% formula too rich; milk dominated matcha.',
    notes:'NOT approved; do not invent missing fresh milk amount or declare finished formula. Source: FIELD Project ChatGPT R&D.'}
];

// Conservative recipe fingerprint: ignore punctuation/spacing but require the
// same menu and the same ingredient-to-gram pairs. Unknown prose stays unknown
// rather than being guessed into an equivalence.
function recipeFingerprint(row) {
  const menu = String(row.menu||'').normalize('NFC').toLocaleLowerCase('th-TH')
    .replace(/\b(?:16\s*oz|16\s*ออนซ์)\b/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const formula = String(row.formula||'').normalize('NFC').toLocaleLowerCase('th-TH')
    .replace(/^\s*candidate only\s*:\s*/,'');
  const pairs = [...formula.matchAll(/([^;\n·,]+?)\s*(\d+(?:\.\d+)?)\s*g\b/giu)]
    .map(match => {
      const ingredient = match[1].replace(/@\s*\d+(?:\.\d+)?\s*°?c/giu,'')
        .replace(/[^\p{L}\p{N}]+/gu,' ').trim();
      return ingredient ? `${ingredient}:${Number(match[2])}` : '';
    }).filter(Boolean).sort();
  return menu && pairs.length ? `${menu}|${pairs.join('|')}` : null;
}
export function previewFieldChatHistory(currentTrials, currentSources=[]) {
  const candidate={trials:FIELD_CHAT_HISTORY,sources:[]};
  validateCollections(candidate);
  const plan=planDeviceImport(candidate,{trials:currentTrials,sources:currentSources});
  const knownRecipes=new Set(currentTrials.map(recipeFingerprint).filter(Boolean));
  const semanticDuplicates=[];
  plan.incoming.trials=plan.incoming.trials.filter(row=>{
    const fingerprint=recipeFingerprint(row);
    if(fingerprint&&knownRecipes.has(fingerprint)){
      semanticDuplicates.push({kind:'trials',id:row.id,menu:row.menu,semantic:true});
      return false;
    }
    return true;
  });
  plan.trials.added=plan.incoming.trials.length;
  plan.trials.unchanged+=semanticDuplicates.length;
  plan.semanticDuplicates=semanticDuplicates;
  const conflicts=new Set(plan.conflicts.map(row=>row.id));
  plan.duplicateIds=[...new Set([
    ...currentTrials.filter(row=>FIELD_CHAT_HISTORY.some(candidate=>candidate.id===row.id)).map(row=>row.id),
    ...semanticDuplicates.map(row=>row.id)
  ].filter(id=>!conflicts.has(id)))];
  plan.canImport=plan.conflicts.length===0&&plan.trials.added+plan.sources.added>0;
  return plan;
}
export function assertHistoricalImportSafe(plan) {
  if (plan.conflicts.length) throw new Error('rd_chat_history_conflict');
  // Explicit confirmation required in UI before calling existing persistData.
  return plan.incoming;
}
