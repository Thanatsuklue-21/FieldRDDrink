import React,{useEffect,useRef,useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import {newCloudCache,readCloudCache,writeCloudCache,queueCloudRecords,syncCloud,withCloudLock,parseRemote,planDeviceImport} from './cloud-sync.js';
import {mergeImmutableRecords} from './rd-core.js';

const url = import.meta.env.VITE_RD_SUPABASE_URL;
const publicKey = import.meta.env.VITE_RD_SUPABASE_PUBLISHABLE_KEY;
// Session belongs to this R&D origin and project. No service key in the browser.
const client = url && publicKey ? createClient(url,publicKey,{auth:{storageKey:'field-rd-auth-v1'}}) : null;

export default function CloudPanel({onReady,getLocalData}) {
  const [session,setSession] = useState(null), [email,setEmail] = useState(''), [password,setPassword] = useState('');
  const [message,setMessage] = useState(''), [busy,setBusy] = useState(false), [cache,setCache] = useState(null);
  const [importPreview,setImportPreview] = useState(null);
  const running = useRef(false), generation = useRef(0), sessionRef = useRef(null);
  const onReadyRef = useRef(onReady); onReadyRef.current = onReady;
  const owner = s => url+'|'+s.user.id;
  const report = c => {setCache(c);onReadyRef.current(c)};
  function errorMessage(error) {
    const m=String(error?.message||'rd_sync_failed');
    if (m.includes('conflict')) return 'หยุดซิงค์: ID เดียวกันมีเนื้อหาต่างกัน ('+m+') — เก็บทั้งข้อมูลในเครื่องและฐานกลางไว้ โปรดสำรองข้อมูลเพื่อตรวจสอบ';
    if (m.includes('other_account')) return 'เครื่องนี้มีข้อมูลของบัญชีหรือฐานกลางอื่น กรุณากลับเข้าบัญชีเดิมเพื่อสำรองข้อมูลก่อนเปลี่ยนบัญชี';
    if (m.includes('account_changed')) return 'บัญชีเปลี่ยนระหว่างทำงาน ระบบหยุดส่งข้อมูล กรุณาเข้าสู่บัญชีเดิมแล้วลองอีกครั้ง';
    if (m.includes('lock_gate')) return 'สูตร LOCKED ยังมีหลักฐานไม่ครบ ฐานกลางปฏิเสธการรับข้อมูลทั้งชุด';
    if (m.includes('JWT')||m.includes('auth')) return 'กรุณาเข้าสู่ระบบอีกครั้ง ข้อมูลรอส่งยังอยู่ในเครื่อง';
    return 'ยังซิงค์ไม่สำเร็จ ข้อมูลรอส่งยังอยู่ในเครื่อง: '+m;
  }
  async function callSync(s,records) {
    const {data,error}=await client.rpc('rd_sync',{p_owner:s.user.id,p_records:records}).abortSignal(AbortSignal.timeout(20000));
    if(error)throw error;return data;
  }
  async function runSync() {
    const s=sessionRef.current;
    if (!s || running.current || !client) return;
    running.current=true;setBusy(true);const g=generation.current;
    try {
      const c=await syncCloud({storage:localStorage,owner:owner(s),remote:records=>callSync(s,records)});
      if(g===generation.current){report(c);setMessage('อ่านและบันทึกฐานกลางสำเร็จ');}
    } catch(e) {if(g===generation.current)setMessage(errorMessage(e));}
    finally {running.current=false;if(g===generation.current)setBusy(false);}
  }
  useEffect(()=>{
    if(!client)return;
    let alive=true;
    function apply(s){
      if(!alive)return;
      generation.current++;sessionRef.current=s;setSession(s);setBusy(false);setImportPreview(null);
      if(!s){setCache(null);onReadyRef.current(null);return;}
      try {
        const c=readCloudCache(localStorage,owner(s))||writeCloudCache(localStorage,newCloudCache(owner(s)));
        report(c);setMessage('พร้อมอ่านฐานกลาง — ข้อมูลเดิมในเครื่องยังไม่ถูกส่ง');
      }catch(e){onReadyRef.current(null);setMessage(errorMessage(e));}
    }
    client.auth.getSession().then(({data,error})=>{if(error){if(alive)setMessage(errorMessage(error));}else apply(data.session)});
    const {data}=client.auth.onAuthStateChange((_event,s)=>apply(s));
    return()=>{alive=false;generation.current++;data.subscription.unsubscribe()};
  },[]);
  useEffect(()=>{
    if(!session||!cache)return;
    const attempt=()=>{if(navigator.onLine)runSync()};
    const visible=()=>{if(document.visibilityState==='visible')attempt()};
    attempt();
    const timer=setInterval(attempt,30000);
    window.addEventListener('online',attempt);window.addEventListener('field-rd-pending',attempt);
    document.addEventListener('visibilitychange',visible);
    return()=>{clearInterval(timer);window.removeEventListener('online',attempt);window.removeEventListener('field-rd-pending',attempt);document.removeEventListener('visibilitychange',visible)};
  },[session?.user.id,!!cache]);
  async function signIn(e){
    e.preventDefault();setBusy(true);setMessage('กำลังเข้าสู่ระบบ…');
    try {const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;setPassword('');}
    catch(e){setMessage(errorMessage(e));}finally{setBusy(false)}
  }
  async function inspectLocal(s) {
    const incoming=getLocalData();
    const data=parseRemote(await callSync(s,[]));
    const current=readCloudCache(localStorage,owner(s));
    if(!current)throw new Error('rd_cloud_not_initialized');
    // Include this device's unsent records in the comparison too.
    const known={trials:mergeImmutableRecords(current.trials,data.trials,'Trial').records,
      sources:mergeImmutableRecords(current.sources,data.sources,'Evidence').records};
    return {...planDeviceImport(incoming,known),deviceSnapshot:incoming};
  }
  async function prepareImport(){
    const s=sessionRef.current;if(!s||running.current)return;
    running.current=true;setBusy(true);const g=generation.current;
    try{
      const plan=await inspectLocal(s);
      if(g!==generation.current)return;
      setImportPreview(plan);setMessage('ตรวจข้อมูลแล้ว — ยังไม่ส่งข้อมูลและไม่เปลี่ยนทะเบียน');
    }catch(e){if(g===generation.current){setImportPreview(null);setMessage(errorMessage(e))}}
    finally{running.current=false;if(g===generation.current)setBusy(false)}
  }
  async function importLocal(){
    const s=sessionRef.current;if(!s||running.current||!importPreview?.canImport)return;
    running.current=true;setBusy(true);const g=generation.current;
    let queued=false;
    try{
      // Recheck against the server immediately before approval. Another device
      // may have uploaded since the preview was shown.
      const plan=await inspectLocal(s);
      if(g!==generation.current)return;
      setImportPreview(plan);
      if(!plan.canImport){setMessage(plan.conflicts.length?'พบข้อมูลขัดแย้ง — ยังไม่ส่งข้อมูล':'รายการทั้งหมดมีอยู่แล้ว — ไม่ส่งซ้ำ');return;}
      if(JSON.stringify(plan.incoming)!==JSON.stringify(importPreview.incoming)){
        setMessage('รายการเปลี่ยนหลังตรวจครั้งก่อน กรุณาตรวจผลล่าสุดและกดยืนยันอีกครั้ง');return;
      }
      const c=await withCloudLock(()=>{
        if(g!==generation.current||sessionRef.current?.user.id!==s.user.id)throw new Error('rd_account_changed');
        localStorage.setItem('field-rd-device-before-upload-'+Date.now(),JSON.stringify(plan.deviceSnapshot));
        return queueCloudRecords(localStorage,readCloudCache(localStorage,owner(s)),plan.incoming);
      });
      if(g===generation.current){report(c);setImportPreview(null);queued=true;}
    }catch(e){if(g===generation.current)setMessage(errorMessage(e))}
    finally{running.current=false;if(g===generation.current)setBusy(false)}
    if(queued)await runSync();
  }
  async function signOut(){
    generation.current++;sessionRef.current=null;setImportPreview(null);
    const {error}=await client.auth.signOut({scope:'local'});
    if(error){setMessage(errorMessage(error));return;}
    setSession(null);setCache(null);onReadyRef.current(null);setMessage('ออกจากระบบแล้ว ข้อมูลและรายการรอส่งยังเก็บไว้');
  }
  if(!client)return <aside className="cloud-panel"><strong>ข้อมูล R&D ยังอยู่เฉพาะเครื่องนี้</strong><p>ยังไม่ได้ตั้งค่าการเชื่อมฐานกลาง ต้องเชื่อม Supabase สำหรับ R&D ก่อนใช้งานข้ามอุปกรณ์</p></aside>;
  return <aside className="cloud-panel" aria-label="ข้อมูลข้ามอุปกรณ์"><h2>ข้อมูลข้ามอุปกรณ์</h2>
    {!session?<form onSubmit={signIn}><p>เข้าใช้บัญชี R&D เดียวกันบน PC มือถือ และแท็บเล็ต</p>
      <label>อีเมล<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label>รหัสผ่าน<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <button className="primary" disabled={busy}>เข้าสู่ระบบ</button></form>:<>
      <p>{session.user.email}</p><p>รอส่ง {cache?.pending.reduce((n,b)=>n+b.trials.length+b.sources.length,0)??'—'} รายการ · ซิงค์สำเร็จล่าสุด {cache?.lastSync?new Date(cache.lastSync).toLocaleString('th-TH'):'ยังไม่มี'}</p>
      <div className="actions"><button className="primary" onClick={runSync} disabled={busy||!cache}>{busy?'กำลังซิงค์…':'ซิงค์ตอนนี้'}</button>
      <button className="secondary" onClick={prepareImport} disabled={busy||!cache}>ตรวจข้อมูลเดิมก่อนนำเข้า</button>
      <button className="secondary" onClick={signOut} disabled={busy}>ออกจากระบบ</button></div>
      {importPreview&&<div className="import-preview" aria-label="ผลตรวจข้อมูลก่อนนำเข้า">
        <h3>ผลตรวจข้อมูลเดิม — ยังไม่ส่ง</h3>
        <p>ปลายทาง: บัญชี {session.user.email} · จะสำรองข้อมูลในเครื่องก่อนส่งและไม่เปลี่ยนรายการเดิม</p>
        <p>รายการใหม่: {importPreview.trials.added} Trial · {importPreview.sources.added} Evidence<br/>
          มีอยู่แล้วตรงกัน: {importPreview.trials.unchanged} Trial · {importPreview.sources.unchanged} Evidence<br/>
          ขัดแย้ง: {importPreview.conflicts.length} รายการ</p>
        {importPreview.conflicts.length>0&&<><p role="alert">หยุดนำเข้า กรุณาสำรองข้อมูลทั้งสองฝั่งและตรวจความต่างก่อน ไม่มีการเลือกเขียนทับอัตโนมัติ</p>
          {importPreview.conflicts.map(row=><details key={row.kind+':'+row.id}><summary>{row.kind==='trials'?'Trial':'Evidence'} {row.id}</summary>
            <p>ช่องที่ต่างกัน: {row.fields.join(', ')}</p><h4>ข้อมูลในเครื่องเดิม</h4><pre>{JSON.stringify(row.device,null,2)}</pre>
            <h4>ข้อมูลฐานกลาง / รายการรอส่ง</h4><pre>{JSON.stringify(row.cloud,null,2)}</pre></details>)}</>}
        {!importPreview.canImport&&!importPreview.conflicts.length&&<p>ไม่มีรายการใหม่ที่ต้องส่ง สูตรตั้งต้นที่ไม่ได้บันทึกในเครื่องจะไม่นำเข้า</p>}
        <button className="primary" onClick={importLocal} disabled={busy||!importPreview.canImport}>ยืนยันนำเข้ารายการใหม่</button>
      </div>}
      <p>Trial และ Evidence ที่บันทึกใหม่จะรอส่งในเครื่องเมื่อออฟไลน์ และลองส่งอีกครั้งเมื่อออนไลน์ รายการที่บันทึกแล้วแก้ทับไม่ได้</p></>}
    {message&&<p role="status" className="cloud-message">{message}</p>}
  </aside>;
}
