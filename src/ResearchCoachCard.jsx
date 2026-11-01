import React from 'react';

export default function ResearchCoachCard({trial,brief,onCandidate}){
  const a=brief.advice;
  return <article className="coach-card" aria-label={'แผน R&D '+trial.menu}>
    <h3>{trial.menu} · ฐาน {trial.id}</h3>
    <p><b>ผลชิม:</b> T0/T5/T10 {brief.timeline.measured}/{brief.timeline.total} · คะแนน {brief.scores.measured}/{brief.scores.total} ด้าน</p>
    <p><b>หลักฐานที่อ้างถึงและตรวจแล้ว:</b> {brief.evidence.accepted.length} URL ไม่ซ้ำ</p>
    {brief.gaps.length>0&&<p className="coach-gap"><b>ต้องระบุให้เทียบรอบได้:</b> {brief.gaps.join(' · ')}</p>}
    <p>{a.why||a.reason||'ตรวจข้อมูลผลทดลองก่อนวางแผนรอบถัดไป'}</p>
    {brief.delta&&<p><b>เปลี่ยนเพียงจุดเดียว:</b> {brief.delta.ingredient} {brief.delta.from} → {brief.delta.to} {brief.delta.unit}</p>}
    {a.duplicateTrialId&&<p>มีแผนนี้แล้วใน {a.duplicateTrialId} — ทำรายการเดิมให้เสร็จก่อน</p>}
    {brief.plan&&<details><summary>แผนทดลองเทียบสูตรฐาน</summary>
      <ol>{brief.plan.steps.map(step=><li key={step}>{step}</li>)}</ol><p>{brief.plan.decision}</p>
      <p><b>สูตรเสนอ:</b> {a.formula}</p>
    </details>}
    {a.canCreate&&<><button className="primary" onClick={()=>onCandidate(a)}>เตรียม Trial รอทดลอง</button><p>เมื่อบันทึก Trial จะเก็บแผนและแหล่งอ้างอิงรอบนี้ไปด้วย</p></>}
    {brief.evidence.issues.length>0&&<details><summary>หลักฐานที่ยังใช้ยืนยันไม่ได้ ({brief.evidence.issues.length})</summary>
      <ul>{brief.evidence.issues.map((x,i)=><li key={x.id+i}>{x.id}: {x.reason}</li>)}</ul></details>}
    {brief.evidence.accepted.length>0&&<details><summary>เปิดหลักฐานของ Trial นี้</summary>
      <ul>{brief.evidence.accepted.map(s=><li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a><p>{s.finding}</p></li>)}</ul>
    </details>}
    <details><summary>วิธีคิดและข้อจำกัด</summary>
      <ul>{brief.limitations.map(x=><li key={x}>{x}</li>)}</ul>
      {brief.methodRefs.map(s=><p key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a><br/>{s.note}</p>)}
      <p>แหล่งวิธีวิจัยเป็นความรู้ประกอบ ไม่ใช่หลักฐานว่า FIELD ทดลองแล้ว</p>
    </details>
  </article>;
}
