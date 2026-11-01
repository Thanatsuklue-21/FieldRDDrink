import React,{useEffect,useRef,useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import {newCloudCache,readCloudCache,writeCloudCache,queueCloudRecords,syncCloud,withCloudLock} from './cloud-sync.js';

const url = import.meta.env.VITE_RD_SUPABASE_URL;
const publicKey = import.meta.env.VITE_RD_SUPABASE_PUBLISHABLE_KEY;
// Session belongs to this R&D origin and project. No service key in the browser.
const client = url && publicKey ? createClient(url,publicKey,{auth:{storageKey:'field-rd-auth-v1'}}) : null;

export default function CloudPanel({onReady,getLocalData}) {
  const [session,setSession] = useState(null), [email,setEmail] = useState(''), [password,setPassword] = useState('');
  const [message,setMessage] = useState(''), [busy,setBusy] = useState(false), [cache,setCache] = useState(null);
  const running = useRef(false), generation = useRef(0), sessionRef = useRef(null);
  const onReadyRef = useRef(onReady); onReadyRef.current = onReady;
  const owner = s => url+'|'+s.user.id;
  const report = c => {setCache(c);onReadyRef.current(c)};
  function errorMessage(error) {
    const m=String(error?.message||'rd_sync_failed');
    if (m.includes('conflict')) return 'หยุดซิงค์: ID เดียวกันมีเนื้อหาต่างกัน ('+m+') — เก็บทั้งข้อมูลในเครื่องและฐานกลางไว้ โปรดสำรองข้อมูลเพื่อตรวจสอบ';
    if (m.includes('other_account')) return 'เครื่องนี้มีข้อมูลของบัญชีหรือฐานกลางอื่น กรุณากลับเข้าบัญชีเดิมเพื่อสำรองข้อมูลก่อนเปลี่ยนบัญชี';
    if (m.includes('lock_gate')) return 'สูตร LOCKED ยังมีหลักฐานไม่ครบ ฐานกลางปฏิเสธการรับข้อมูลทั้งชุด';
    if (m.includes('JWT')||m.includes('auth')) return 'กรุณาเข้าสู่ระบบอีกครั้ง ข้อมูลรอส่งยังอยู่ในเครื่อง';
    return 'ยังซิงค์ไม่สำเร็จ ข้อมูลรอส่งยังอยู่ในเครื่อง: '+m;
  }
  async function runSync() {
    const s=sessionRef.current;
    if (!s || running.current || !client) return;
    running.current=true;setBusy(true);const g=generation.current;
    try {
      const c=await syncCloud({storage:localStorage,owner:owner(s),remote:async records=>{
        const {data,error}=await client.rpc('rd_sync',{p_records:records}).abortSignal(AbortSignal.timeout(20000));
        if(error)throw error;return data;
      }});
      if(g===generation.current){report(c);setMessage('อ่านและบันทึกฐานกลางสำเร็จ');}
    } catch(e) {if(g===generation.current)setMessage(errorMessage(e));}
    finally {running.current=false;if(g===generation.current)setBusy(false);}
  }
  useEffect(()=>{
    if(!client)return;
    let alive=true;
    function apply(s){
      if(!alive)return;
      generation.current++;sessionRef.current=s;setSession(s);setBusy(false);
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
  async function importLocal(){
    if(!session||running.current)return;
    try{
      const incoming=getLocalData();
      if(!incoming.trials.length&&!incoming.sources.length){setMessage('ไม่มีผลทดลองเดิมที่บันทึกในเครื่องนี้ — ไม่ส่งสูตรตั้งต้น');return;}
      if(!window.confirm(`ส่งข้อมูลเดิม ${incoming.trials.length} Trial และ ${incoming.sources.length} Evidence เข้าฐานกลางของบัญชีนี้? จะสำรองก่อนส่ง และหยุดหาก ID ขัดแย้งกัน`))return;
      localStorage.setItem('field-rd-device-before-upload-'+Date.now(),JSON.stringify(incoming));
      const c=await withCloudLock(()=>queueCloudRecords(localStorage,readCloudCache(localStorage,owner(session)),incoming));
      report(c);await runSync();
    }catch(e){setMessage(errorMessage(e))}
  }
  async function signOut(){
    generation.current++;sessionRef.current=null;
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
      <button className="secondary" onClick={importLocal} disabled={busy||!cache}>นำข้อมูลเดิมในเครื่องเข้าฐานกลาง</button>
      <button className="secondary" onClick={signOut} disabled={busy}>ออกจากระบบ</button></div>
      <p>Trial และ Evidence ที่บันทึกใหม่จะรอส่งในเครื่องเมื่อออฟไลน์ และลองส่งอีกครั้งเมื่อออนไลน์ รายการที่บันทึกแล้วแก้ทับไม่ได้</p></>}
    {message&&<p role="status" className="cloud-message">{message}</p>}
  </aside>;
}
