import test from "node:test";import assert from "node:assert/strict";
const statuses=["PLANNED","RUNNING","NEEDS_ADJUSTMENT","PASS","FAIL","HOLD","SENSORY_LOCKED","LOCKED"];
function valid(a){return Array.isArray(a)&&a.every(x=>x&&typeof x.id==="string"&&typeof x.menu==="string"&&statuses.includes(x.status))}
const requiredLockGates=["repeatability","dilution","cupIce","costing","sop","qc"];
function canLock(x){return !!(x.t0?.trim()&&x.t5?.trim()&&x.t10?.trim()&&x.ingredients?.trim()&&requiredLockGates.every(k=>x[k]))}
function migrate(a){return a.map(x=>{const n={...x};if(n.id==="PM-02")n.status="SENSORY_LOCKED";if(n.id==="ML-01"){n.status="NEEDS_ADJUSTMENT";n.t0=n.t0||"กินง่าย หวานกำลังดี";n.t5=n.t5||"ยังอร่อยอยู่";n.t10=n.t10||"พอกินได้ ได้กลิ่นมัทฉะบางๆ แต่หวานนำ"}if(n.id==="ML-02"&&!n.t0&&!n.t5&&!n.t10)n.status="PLANNED";return n})}
test("valid trial collection supports evidence states",()=>assert.equal(valid([{id:"T1",menu:"Latte",status:"NEEDS_ADJUSTMENT"},{id:"T2",menu:"Pure",status:"SENSORY_LOCKED"}]),true));
test("reject corrupt collection",()=>assert.equal(valid([{id:"T1",menu:"Latte",status:"BAD"}]),false));
test("Production LOCK requires sensory identity and readiness gates",()=>{const ok={t0:"ok",t5:"ok",t10:"ok",ingredients:"SKU-1",repeatability:true,dilution:true,cupIce:true,costing:true,sop:true,qc:true};assert.equal(canLock(ok),true);assert.equal(canLock({...ok,t10:""}),false);assert.equal(canLock({...ok,ingredients:""}),false);assert.equal(canLock({...ok,cupIce:false}),false)});
test("migration never marks unperformed ML-02 as RUNNING",()=>{const [pm,ml1,ml2]=migrate([{id:"PM-02",menu:"Pure",status:"LOCKED"},{id:"ML-01",menu:"Latte",status:"PLANNED"},{id:"ML-02",menu:"Latte",status:"RUNNING",t0:"",t5:"",t10:""}]);assert.equal(pm.status,"SENSORY_LOCKED");assert.equal(ml1.status,"NEEDS_ADJUSTMENT");assert.equal(ml2.status,"PLANNED");assert.equal(ml1.t0,"กินง่าย หวานกำลังดี")});

function extractBackup(parsed){const candidate=Array.isArray(parsed)?parsed:parsed?.trials;const a=migrate(candidate);if(!valid(a))throw new Error("invalid");return a}
test("backup import accepts wrapped v3 and legacy arrays",()=>{assert.equal(extractBackup({version:3,trials:[{id:"T1",menu:"Pure",status:"PLANNED"}]}).length,1);assert.equal(extractBackup([{id:"T2",menu:"Latte",status:"PASS"}]).length,1)});
test("backup import rejects malformed payload",()=>assert.throws(()=>extractBackup({version:3,trials:{bad:true}})));
