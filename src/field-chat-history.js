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
export function previewFieldChatHistory(currentTrials, currentSources=[]) {
  const candidate={trials:FIELD_CHAT_HISTORY,sources:[]};
  validateCollections(candidate);
  return planDeviceImport(candidate,{trials:currentTrials,sources:currentSources});
}
export function assertHistoricalImportSafe(plan) {
  if (plan.conflicts.length) throw new Error('rd_chat_history_conflict');
  // Explicit confirmation required in UI before calling existing persistData.
  return plan.incoming;
}
