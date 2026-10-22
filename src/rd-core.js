export const SOURCE_TYPES={
  PEER_REVIEWED:{label:"งานวิจัย Peer-reviewed",weight:.95},
  OFFICIAL_GUIDE:{label:"คู่มือผู้ผลิต/ผู้เชี่ยวชาญ",weight:.9},
  PRODUCT_PAGE:{label:"เว็บผลิตภัณฑ์วัตถุดิบ",weight:.85},
  PROFESSIONAL:{label:"สูตร/บทความมืออาชีพ",weight:.75},
  YOUTUBE:{label:"YouTube",weight:.55},
  LEMON8:{label:"Lemon8",weight:.45},
  SOCIAL:{label:"Social / Community",weight:.4},
  GEMINI:{label:"Gemini / AI summary",weight:.3},
  OTHER:{label:"อื่นๆ",weight:.35}
};
export const SCORE_FIELDS=[
  ["scoreTaste","Taste",.25],
  ["scoreBody","Body",.25],
  ["scoreIdentity","รสหลัก/Character",.20],
  ["scoreDilution","T10 / Dilution",.15],
  ["scoreOverall","Overall",.15]
];
export function detectProvider(raw=""){
  try{
    const h=new URL(raw).hostname.toLowerCase();
    if(h.includes("youtube.com")||h==="youtu.be")return"YOUTUBE";
    if(h.includes("lemon8"))return"LEMON8";
    if(h.includes("gemini.google")||h==="share.google")return"GEMINI";
    if(h.includes("pubmed")||h.includes("doi.org")||h.includes("sciencedirect")||h.includes("ncbi.nlm.nih.gov"))return"PEER_REVIEWED";
  }catch{}
  return"OTHER";
}
export function sourceEvidenceScore(source){
  const base=SOURCE_TYPES[source?.type]?.weight??SOURCE_TYPES.OTHER.weight;
  const relevance=Math.min(5,Math.max(1,Number(source?.relevance)||3))/5;
  const verified=source?.verified?1:.8;
  const exact=source?.formula?.trim()?1:.95;
  return Math.round(Math.min(1,base*relevance*verified*exact)*100);
}
function n(v){const x=Number(v);return Number.isFinite(x)&&x>=0&&x<=5?x:null}
const qualitative={LOCKED:6,SENSORY_LOCKED:5,PASS:4,NEEDS_ADJUSTMENT:3,HOLD:2,FAIL:0,PLANNED:-1,RUNNING:-1};
export function evaluateTrial(trial){
  let weighted=0,totalWeight=0,structured=0;
  for(const [k,,w] of SCORE_FIELDS){const v=n(trial?.[k]);if(v!==null){weighted+=v*w;totalWeight+=w;structured++}}
  const sensoryScore=structured>=3&&totalWeight?Math.round((weighted/totalWeight)*20):null;
  const timeline=[trial?.t0,trial?.t5,trial?.t10].filter(x=>String(x||"").trim()).length;
  let confidence=0;
  if(timeline===3)confidence+=.35;else confidence+=timeline*.08;
  if(String(trial?.t15||"").trim())confidence+=.10;
  if(trial?.repeatability)confidence+=.20;
  if(String(trial?.ingredients||"").trim())confidence+=.10;
  if(String(trial?.sourceRefs||"").trim())confidence+=.10;
  if(["SENSORY_LOCKED","LOCKED"].includes(trial?.status))confidence+=.15;
  confidence=Math.min(1,confidence);
  let decision="UNTESTED";
  if(trial?.status==="FAIL")decision="REJECT";
  else if(trial?.status==="LOCKED")decision="PRODUCTION_READY";
  else if(trial?.status==="SENSORY_LOCKED")decision="SENSORY_WINNER";
  else if(sensoryScore!==null&&sensoryScore>=85&&confidence>=.65)decision="STRONG_CANDIDATE";
  else if(sensoryScore!==null)decision="PROVISIONAL";
  else if(timeline>0)decision="NEEDS_STRUCTURED_SCORE";
  return{sensoryScore,confidence:Math.round(confidence*100),structured,decision,qualitative:qualitative[trial?.status]??0};
}
export function rankTrials(trials,menu){
  return trials.filter(x=>x.menu===menu&& !["PLANNED","RUNNING"].includes(x.status)).map(x=>({...x,evaluation:evaluateTrial(x)})).sort((a,b)=>{
    const as=a.evaluation.sensoryScore,bs=b.evaluation.sensoryScore;
    if(as!==null&&bs!==null&&as!==bs)return bs-as;
    if(as!==null&&bs===null)return-1;
    if(as===null&&bs!==null)return 1;
    if(a.evaluation.qualitative!==b.evaluation.qualitative)return b.evaluation.qualitative-a.evaluation.qualitative;
    return b.evaluation.confidence-a.evaluation.confidence;
  });
}
export function bestByMenu(trials){
  const menus=[...new Set(trials.map(x=>x.menu).filter(Boolean))];
  return menus.map(menu=>({menu,ranked:rankTrials(trials,menu)})).map(x=>({...x,best:x.ranked[0]||null}));
}
export function nextExperimentHint(trial){
  if(!trial)return"ยังไม่มีผลทดลองจริง";
  const e=evaluateTrial(trial);
  if(e.decision==="PRODUCTION_READY")return"สูตรนี้ผ่าน Production Lock แล้ว";
  if(e.decision==="SENSORY_WINNER")return"คงสูตรเดิม แล้วทำ Process / Ice / Repeatability / Costing ให้ครบก่อน Production Lock";
  const scores=SCORE_FIELDS.map(([k,l])=>({k,l,v:n(trial[k])})).filter(x=>x.v!==null).sort((a,b)=>a.v-b.v);
  if(scores.length)return `จุดอ่อนต่ำสุด: ${scores[0].l} ${scores[0].v}/5 — ออก Trial ถัดไปโดยเปลี่ยนตัวแปรเดียวที่เกี่ยวข้อง`;
  if(String(trial.t0||trial.t5||trial.t10||"").trim())return"มีผลชิมแล้ว แต่ยังไม่มี Structured Score; ให้ให้คะแนน Taste/Body/Character/T10/Overall ก่อนเปลี่ยนสูตร";
  return"ยังไม่ควรแนะนำสูตรนี้จนกว่าจะทดลองจริง";
}

export function parseSourceRefs(raw=""){return [...new Set(String(raw).split(/[·,\n]/).map(x=>x.trim()).filter(Boolean))]}
export function linkedEvidence(trial,sources=[]){
  const refs=parseSourceRefs(trial?.sourceRefs);
  const rows=refs.map(id=>sources.find(s=>s.id===id)).filter(Boolean);
  const verified=rows.filter(s=>s.verified);
  const scores=verified.map(sourceEvidenceScore);
  return{refs,rows,verifiedCount:verified.length,missingCount:Math.max(0,refs.length-rows.length),average:scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):0};
}
export function evaluateTrialWithEvidence(trial,sources=[]){
  const base=evaluateTrial(trial),evidence=linkedEvidence(trial,sources);
  let confidence=base.confidence;
  if(evidence.verifiedCount)confidence+=Math.min(10,Math.round(evidence.average/10));
  if(evidence.missingCount)confidence-=Math.min(15,evidence.missingCount*5);
  return{...base,confidence:Math.max(0,Math.min(100,confidence)),evidence};
}
export function recommendationReason(trial,sources=[]){
  if(!trial)return"ยังไม่มี Trial ที่ผ่านการทดลองจริง";
  const e=evaluateTrialWithEvidence(trial,sources);
  const parts=[];
  if(e.sensoryScore!==null)parts.push(`FIELD sensory ${e.sensoryScore}/100`);else parts.push("ยังไม่มี Structured Sensory Score");
  parts.push(`confidence ${e.confidence}%`);
  if(e.evidence.verifiedCount)parts.push(`verified sources ${e.evidence.verifiedCount}`);
  if(e.evidence.missingCount)parts.push(`missing refs ${e.evidence.missingCount}`);
  return parts.join(" · ");
}
export function bestByMenuWithEvidence(trials,sources=[]){
  const menus=[...new Set(trials.map(x=>x.menu).filter(Boolean))];
  return menus.map(menu=>{
    const ranked=rankTrials(trials,menu).map(x=>({...x,evaluation:evaluateTrialWithEvidence(x,sources)})).sort((a,b)=>{
      const as=a.evaluation.sensoryScore,bs=b.evaluation.sensoryScore;
      if(as!==null&&bs!==null&&as!==bs)return bs-as;
      if(as!==null&&bs===null)return-1;if(as===null&&bs!==null)return 1;
      if(a.evaluation.qualitative!==b.evaluation.qualitative)return b.evaluation.qualitative-a.evaluation.qualitative;
      return b.evaluation.confidence-a.evaluation.confidence;
    });
    return{menu,ranked,best:ranked[0]||null};
  });
}

export function trialValidationErrors(trial,requiredLockGates=["repeatability","dilution","cupIce","costing","sop","qc"]){
  const errors=[];
  if(!String(trial?.menu||"").trim())errors.push("กรอกชื่อเมนู");
  if(!String(trial?.changed||"").trim())errors.push("กรอกตัวแปรที่เปลี่ยน");
  if(!String(trial?.formula||"").trim())errors.push("กรอกสูตรและปริมาณ");
  if(trial?.status==="LOCKED"){
    if(!String(trial?.t0||"").trim()||!String(trial?.t5||"").trim()||!String(trial?.t10||"").trim())errors.push("Production LOCK ต้องมีผลชิม T0, T5 และ T10");
    if(!String(trial?.ingredients||"").trim())errors.push("Production LOCK ต้องมี Ingredient / SKU snapshot");
    const missing=requiredLockGates.filter(k=>!trial?.[k]);
    if(missing.length)errors.push("Production LOCK ต้องผ่าน "+missing.join(", "));
  }
  return errors;
}
