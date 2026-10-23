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
function n(v){if(v===null||v===undefined||String(v).trim()==="")return null;const x=Number(v);return Number.isFinite(x)&&x>=0&&x<=5?x:null}
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


function cleanText(v=""){return String(v||"").trim()}
function lowerText(v=""){return cleanText(v).toLowerCase()}
export function formulaItems(formula=""){
  return String(formula).split(/[·\n]/).map(x=>x.trim()).filter(Boolean).map(segment=>{
    const m=segment.match(/^(.*?)(-?\d+(?:\.\d+)?)\s*(g|ml|mL|กรัม|มล\.?)\b/i);
    if(!m)return null;
    return{segment,name:m[1].trim(),amount:Number(m[2]),amountText:m[2],unit:m[3]};
  }).filter(Boolean);
}
function fieldScore(trial,key){return n(trial?.[key])}
function feedbackText(trial){return [trial?.t0,trial?.t5,trial?.t10,trial?.t15,trial?.notes].map(lowerText).filter(Boolean).join(" · ")}
function hasAny(text,terms){return terms.some(x=>text.includes(x))}
function pickItem(items,re){return items.find(x=>re.test(x.name))}
function roundedStep(value,delta,step){
  const raw=Math.max(step,value+delta);
  return Math.round(raw/step)*step;
}
function replaceItemAmount(formula,item,next){
  const nextText=Number.isInteger(next)?String(next):String(Number(next.toFixed(2)));
  return String(formula).replace(item.segment,item.segment.replace(item.amountText,nextText));
}
function strongestSources(menu,sources=[]){
  return sources.filter(s=>s.menu===menu&&s.verified===true).map(s=>({...s,_score:sourceEvidenceScore(s)})).sort((a,b)=>b._score-a._score).slice(0,3);
}
export function researchQueriesForTrial(trial){
  if(!trial?.menu)return[];
  const text=feedbackText(trial);
  const focus=hasAny(text,["หวานนำ","หวานไป","too sweet","sweet-forward"])?"sweetness balance":
    hasAny(text,["มัทฉะบาง","ชาอ่อน","กาแฟอ่อน","โกโก้อ่อน","รสหลักบาง","weak character"])?"flavor intensity":
    hasAny(text,["จาง","น้ำเยอะ","dilut","watery"])?"dilution":
    "sensory recipe";
  const menu=cleanText(trial.menu);
  return[
    {channel:"WEB",query:menu+" "+focus+" recipe grams"},
    {channel:"YOUTUBE",query:menu+" "+focus+" recipe grams barista"},
    {channel:"LEMON8",query:menu+" สูตร "+focus},
    {channel:"PEER_REVIEWED",query:menu+" sensory extraction "+focus},
    {channel:"PRODUCT_PAGE",query:menu+" official ingredient preparation guide"}
  ];
}
export function buildCandidateRecommendation(trial,trials=[],sources=[]){
  if(!trial)return{state:"NO_TRIAL",canCreate:false,reason:"ยังไม่มี Trial ที่ใช้เป็นฐาน"};
  if(["LOCKED","SENSORY_LOCKED"].includes(trial.status))return{state:"LOCKED",canCreate:false,reason:"สูตรถูกล็อกแล้ว ระบบจะไม่เปลี่ยนสูตรอัตโนมัติ; ให้ทำ validation ที่ค้างอยู่แทน",baseTrialId:trial.id};
  if(["PLANNED","RUNNING"].includes(trial.status))return{state:"NOT_TESTED",canCreate:false,reason:"ต้องมีผลทดลองจริงก่อนจึงจะสร้างสูตรถัดไป",baseTrialId:trial.id};
  const e=evaluateTrialWithEvidence(trial,sources);
  const text=feedbackText(trial);
  const items=formulaItems(trial.formula);
  if(!items.length)return{state:"UNPARSEABLE",canCreate:false,reason:"สูตรฐานไม่มีปริมาณ g/mL ที่ระบบอ่านเพื่อเปลี่ยนตัวแปรเดียวได้",baseTrialId:trial.id};

  let rule=null,item=null,next=null,why="";
  const sweet=pickItem(items,/(syrup|น้ำเชื่อม|นมข้นหวาน|condensed|sugar|น้ำตาล)/i);
  const identity=pickItem(items,/(matcha|มัทฉะ|thai tea|green tea|jasmine|ชา|coffee|กาแฟ|cocoa|โกโก้)/i);
  const water=pickItem(items,/(water|น้ำ)/i);
  const milk=pickItem(items,/(milk|นม|evap|cream)/i);

  if(sweet&&hasAny(text,["หวานนำ","หวานไป","หวานเกิน","too sweet","sweet-forward"])){
    rule="REDUCE_SWEETENER";item=sweet;next=roundedStep(item.amount,-5,5);
    why="ผลชิมระบุว่าความหวานนำ จึงลด "+(item.name||"sweetener")+" เพียงตัวเดียวก่อน เพื่อดูว่ารสหลักชัดขึ้นโดยไม่เพิ่มผง/ชาและไม่เปลี่ยนตัวแปรอื่น";
  }else if(identity&&hasAny(text,["มัทฉะบาง","ชาอ่อน","กาแฟอ่อน","โกโก้อ่อน","รสหลักบาง","weak character","flavor faint"])){
    rule="INCREASE_IDENTITY";item=identity;const step=item.amount<=10?1:5;next=roundedStep(item.amount,step,step);
    why="ผลชิมระบุว่ารสหลักบาง จึงเพิ่ม "+(item.name||"วัตถุดิบรสหลัก")+" เพียงตัวเดียวใน step เล็ก เพื่อทดสอบ Character โดยคงความหวาน นม น้ำ และ process เดิม";
  }else if(water&&hasAny(text,["จาง","น้ำเยอะ","dilut","watery"])){
    rule="REDUCE_WATER";item=water;next=roundedStep(item.amount,-10,5);
    why="ผลชิมชี้ไปที่ dilution จึงลด "+(item.name||"น้ำ")+" เพียงตัวเดียว เพื่อเพิ่ม concentration โดยไม่เปลี่ยนวัตถุดิบรสหลัก";
  }else{
    const scored=SCORE_FIELDS.map(([k,l])=>({k,l,v:fieldScore(trial,k)})).filter(x=>x.v!==null).sort((a,b)=>a.v-b.v);
    const weakest=scored[0];
    if(weakest?.k==="scoreIdentity"&&identity){rule="INCREASE_IDENTITY";item=identity;const step=item.amount<=10?1:5;next=roundedStep(item.amount,step,step);why="Structured Score ต่ำสุดคือ "+weakest.l+" "+weakest.v+"/5 จึงทดสอบเพิ่ม "+(item.name||"วัตถุดิบรสหลัก")+" เพียงตัวเดียว";}
    else if(weakest?.k==="scoreDilution"&&water){rule="REDUCE_WATER";item=water;next=roundedStep(item.amount,-10,5);why="Structured Score ต่ำสุดคือ "+weakest.l+" "+weakest.v+"/5 จึงทดสอบลด "+(item.name||"น้ำ")+" เพียงตัวเดียว";}
    else if(weakest?.k==="scoreBody"&&milk&&hasAny(text,["บาง","body","thin"])){rule="INCREASE_BODY";item=milk;next=roundedStep(item.amount,10,5);why="Body เป็นจุดอ่อนและมี feedback ว่าเนื้อบาง จึงเพิ่ม "+(item.name||"นม")+" เพียงตัวเดียว";}
  }
  if(!rule||!item||next===null||next===item.amount)return{state:"NEEDS_HUMAN_DIRECTION",canCreate:false,reason:"ข้อมูลผลชิมยังไม่ชี้ทิศทางการเปลี่ยนตัวแปรเดียวอย่างปลอดภัย ระบบจึงไม่เดาสูตร",baseTrialId:trial.id,researchQueries:researchQueriesForTrial(trial)};

  const changed=(item.name||"ตัวแปร")+" "+item.amount+" → "+next+" "+item.unit;
  const formula=replaceItemAmount(trial.formula,item,next);
  const evidence=strongestSources(trial.menu,sources);
  const refs=[...new Set([...parseSourceRefs(trial.sourceRefs),...evidence.map(s=>s.id)])];
  const duplicate=trials.find(x=>x.id!==trial.id&&x.menu===trial.menu&&["PLANNED","RUNNING"].includes(x.status)&&cleanText(x.formula)===cleanText(formula));
  const evidenceBoost=evidence.length?Math.round(evidence.reduce((a,s)=>a+s._score,0)/evidence.length/10):0;
  const confidence=Math.max(0,Math.min(100,e.confidence+10+evidenceBoost));
  return{
    state:duplicate?"DUPLICATE":"READY",
    canCreate:!duplicate,
    baseTrialId:trial.id,
    duplicateTrialId:duplicate?.id||null,
    rule,
    changed,
    formula,
    why,
    confidence,
    evidenceRefs:refs,
    researchQueries:researchQueriesForTrial(trial),
    candidate:{
      ...trial,
      id:"",
      status:"PLANNED",
      changed,
      constants:"อ้างอิง "+trial.id+"; คงตัวแปรอื่นทั้งหมดจากสูตรฐาน",
      formula,
      sourceRefs:refs.join(" · "),
      t0:"",t5:"",t10:"",t15:"",
      scoreTaste:"",scoreBody:"",scoreIdentity:"",scoreDilution:"",scoreOverall:"",
      notes:"AI/Evidence candidate จาก "+trial.id+": "+why,
      repeatability:false,dilution:false,cupIce:false,costing:false,sop:false,pos:false,qc:false
    }
  };
}


export function replaceLocalDataAtomically(storage,trialKey,researchKey,nextTrials,nextSources,validateTrials,validateSources){
  const previousTrials=storage.getItem(trialKey);
  const previousResearch=storage.getItem(researchKey);
  const restore=(key,value)=>value===null?storage.removeItem(key):storage.setItem(key,value);
  try{
    storage.setItem(trialKey,JSON.stringify(nextTrials));
    storage.setItem(researchKey,JSON.stringify(nextSources));
    const trials=JSON.parse(storage.getItem(trialKey)||"null");
    const sources=JSON.parse(storage.getItem(researchKey)||"null");
    if(!validateTrials(trials)||!validateSources(sources))throw new Error("restore_verify_failed");
    return{trials,sources};
  }catch(error){
    try{
      restore(trialKey,previousTrials);
      restore(researchKey,previousResearch);
    }catch{
      throw new Error("restore_rollback_failed");
    }
    throw error;
  }
}
