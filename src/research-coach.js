import {SCORE_FIELDS,parseSourceRefs,formulaItems,buildCandidateRecommendation} from './rd-core.js';

// Human-readable summaries of inspected primary sources, not imported recipes
// or evidence that FIELD has carried out the described experiments.
export const METHOD_LIBRARY=[
  {id:'NIST-OFAT',title:'NIST: ข้อจำกัดการเปลี่ยนทีละตัวแปร',url:'https://www.itl.nist.gov/div898/handbook/pri/section2/pri212.htm',
    note:'ใช้ทดสอบการเปลี่ยนหนึ่งจุดได้ แต่ยังสรุปปฏิสัมพันธ์ระหว่างตัวแปรหรือสูตรที่ดีที่สุดทั้งหมดไม่ได้'},
  {id:'NIST-BLOCKS',title:'NIST: ควบคุมปัจจัยรบกวนและสุ่มลำดับ',url:'https://www.itl.nist.gov/div898/handbook/pri/section3/pri332.htm',
    note:'เทียบสูตรในรอบที่ใช้ล็อต ผู้ชง และเงื่อนไขใกล้กัน พร้อมสุ่มลำดับชิมเพื่อลดความเอนเอียง'},
  {id:'MATCHA-SENSORY-2022',title:'Tea Research Journal: Sensory Evaluation of Matcha',url:'https://www.jstage.jst.go.jp/article/cha/2022/134/2022_31/_article/-char/en',
    note:'สำหรับมัทฉะ พิจารณาสี ความละเอียด ฟอง และสัมผัสรสควบคู่กัน วิธีประเมินในงานวิจัยไม่ใช่สูตรขายของ FIELD'}
];
const text=x=>typeof x==='string'?x.trim():'';
const score=x=>['string','number'].includes(typeof x)&&String(x).trim()!==''&&Number.isFinite(Number(x))&&Number(x)>=0&&Number(x)<=5;
export function canonicalSourceUrl(raw){
  try{
    const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password)return '';
    u.hash='';for(const k of [...u.searchParams.keys()])if(/^utm_/i.test(k)||['gclid','fbclid'].includes(k.toLowerCase()))u.searchParams.delete(k);
    u.searchParams.sort();u.pathname=u.pathname.replace(/\/+$/,'')||'/';return u.href;
  }catch{return ''}
}
export function auditTrialEvidence(trial,sources=[]){
  const refs=parseSourceRefs(trial?.sourceRefs),accepted=[],issues=[],seen=new Set();
  for(const id of refs){
    const matches=sources.filter(s=>s.id===id);
    if(matches.length!==1){issues.push({id,reason:matches.length?'ID หลักฐานซ้ำ':'ไม่พบหลักฐานที่อ้างอิง'});continue;}
    const row=matches[0],url=canonicalSourceUrl(row.url);
    if(row.menu!==trial.menu){issues.push({id,reason:'หลักฐานเป็นของเมนูอื่น'});continue;}
    if(row.verified!==true){issues.push({id,reason:'ยังไม่ได้ตรวจต้นทาง'});continue;}
    if(!url||!text(row.title)||!text(row.finding)){issues.push({id,reason:'ต้องมี HTTPS ชื่อแหล่ง และข้อค้นพบที่ตรวจแล้ว'});continue;}
    if(seen.has(url)){issues.push({id,reason:'URL ซ้ำกับหลักฐานที่นับแล้ว'});continue;}
    seen.add(url);accepted.push({id,title:row.title,url,finding:row.finding,type:row.type});
  }
  return {refs,accepted,issues};
}
export function verifyOneVariable(baseFormula,nextFormula){
  const before=formulaItems(baseFormula),after=formulaItems(nextFormula);
  const segments=s=>String(s||'').split(/[·\n]/).map(x=>x.trim()).filter(Boolean);
  if(!before.length||before.length!==after.length||segments(baseFormula).length!==before.length||segments(nextFormula).length!==after.length)return {ok:false,reason:'สูตรมีส่วนที่อ่านปริมาณไม่ได้'};
  const seen=new Set(),changes=[];
  for(let i=0;i<before.length;i++){
    const a=before[i],b=after[i],name=a.name.trim().toLowerCase();
    if(!name||seen.has(name)||name!==b.name.trim().toLowerCase()||a.unit.toLowerCase()!==b.unit.toLowerCase()||a.amount<=0||b.amount<=0)return {ok:false,reason:'ชื่อ หน่วย หรือปริมาณวัตถุดิบกำกวม'};
    seen.add(name);
    if(a.amount!==b.amount)changes.push({ingredient:a.name,from:a.amount,to:b.amount,unit:a.unit});
  }
  // Reconstruct the exact intended amount edit. Temperature/process text must
  // remain identical too; a parser-only diff could otherwise miss a second change.
  if(changes.length!==1)return {ok:false,reason:'ต้องเปลี่ยนปริมาณเพียงหนึ่งตัวแปร'};
  const index=before.findIndex((a,i)=>a.amount!==after[i].amount);
  const a=before[index],b=after[index];
  const expected=String(baseFormula).replace(a.segment,a.segment.replace(a.amountText,b.amountText));
  if(expected!==String(nextFormula))return {ok:false,reason:'มีข้อความสูตรหรือวิธีทำเปลี่ยนเพิ่ม'};
  return {ok:true,change:changes[0]};
}
export function buildResearchBrief(trial,trials=[],sources=[]){
  const evidence=auditTrialEvidence(trial,sources);
  const timeline=['t0','t5','t10'].filter(k=>text(trial?.[k]));
  const scores=SCORE_FIELDS.filter(([k])=>score(trial?.[k]));
  const controls=[['ingredients','วัตถุดิบ / SKU'],['brand','ยี่ห้อ'],['lot','ล็อต'],['temp','อุณหภูมิ'],['time','เวลา'],['ice','น้ำแข็ง'],['cup','แก้ว'],['order','ลำดับการผสม']];
  const gaps=controls.filter(([k])=>!text(trial?.[k])).map(([,label])=>label);
  const checked=new Set(evidence.accepted.map(x=>x.id));
  // Only the citations actually linked to this Trial may inform its hypothesis.
  let advice=buildCandidateRecommendation(trial,trials,sources.filter(s=>checked.has(s.id)));
  const result={trialId:trial?.id||'',menu:trial?.menu||'',timeline:{measured:timeline.length,total:3},scores:{measured:scores.length,total:5},gaps,evidence,advice,
    limitations:['เป็นข้อเสนอจากกติกาที่ตรวจสอบได้ ไม่ใช่ผลทดลองใหม่หรือความน่าจะเป็นว่าสูตรจะชนะ', 'การเปลี่ยนทีละตัวแปรยังไม่พิสูจน์ผลร่วมระหว่างน้ำ นม น้ำตาล และกระบวนการ'],
    methodRefs:METHOD_LIBRARY.filter(x=>x.id!=='MATCHA-SENSORY-2022'||/matcha|มัทฉะ/i.test(trial?.menu||''))};
  if(!trial||!['NEEDS_ADJUSTMENT','PASS','FAIL','HOLD','SENSORY_LOCKED','LOCKED'].includes(trial.status)){
    result.advice={state:'NOT_TESTED',canCreate:false,reason:'ยังไม่มีสถานะผลทดลองจริงให้วิเคราะห์'};return result;
  }
  if(['LOCKED','SENSORY_LOCKED'].includes(trial.status))return result;
  if(!timeline.length&&!scores.length){result.advice={state:'NEEDS_MEASUREMENT',canCreate:false,reason:'บันทึกผลชิมจริงก่อน โน้ตหรือสถานะอย่างเดียวไม่พอเลือกทิศทางสูตร'};return result;}
  if(/(?:ไม่|not\s+|never\s+)(?:หวาน|จาง|บาง|too sweet|watery|weak)/i.test([trial.t0,trial.t5,trial.t10,trial.t15,trial.notes].filter(Boolean).join(' '))){
    result.advice={state:'CLARIFY_FEEDBACK',canCreate:false,reason:'พบข้อความปฏิเสธหรือกำกวม กรุณาระบุว่าต้องการลด เพิ่ม หรือคงตัวแปรใดก่อน'};return result;
  }
  if(advice.candidate){
    const delta=verifyOneVariable(trial.formula,advice.formula);
    if(!delta.ok){result.advice={state:'UNSAFE_DELTA',canCreate:false,reason:delta.reason};return result;}
    result.delta=delta.change;
    result.plan={baselineId:trial.id,candidateStatus:'PLANNED',
      hypothesis:advice.why,
      steps:['ทำสูตรฐานและสูตรเสนอในรอบเดียวกัน ใช้ล็อต วัตถุดิบ แก้ว น้ำแข็ง และวิธีชงเดิม',
        'ติดรหัสแก้วและสุ่มลำดับชิม บันทึกผู้ชง วันเวลา และลำดับจริง',
        'ให้คะแนน Taste / Body / Character / T10 / Overall และจด T0, T5, T10 ของทั้งสองแก้ว',
        'ทำซ้ำในรอบอิสระก่อนตัดสินผล ห้ามเลื่อนเป็น PASS หรือ LOCK จากคำแนะนำนี้'],
      decision:'เปรียบเทียบผลจริงกับสูตรฐาน หากคะแนนขัดกันหรือข้อมูลไม่ครบให้คงสถานะรอทดลอง; ไม่มีการรับรองนัยสำคัญทางสถิติจากแผนนี้'};
    // Saved only if the operator explicitly creates/saves this candidate. Keep
    // the reviewed method/evidence with its immutable Trial across devices.
    result.advice={...advice,candidate:{...advice.candidate,researchPlan:{
      version:'field-research-coach-v1',baselineId:trial.id,delta:result.delta,
      hypothesis:result.plan.hypothesis,steps:[...result.plan.steps],decision:result.plan.decision,
      dataGaps:[...gaps],evidence:evidence.accepted.map(x=>({...x})),
      methodRefs:result.methodRefs.map(x=>({id:x.id,title:x.title,url:x.url})),
      limitations:[...result.limitations],status:'PLANNED'
    }}};
  }
  return result;
}
