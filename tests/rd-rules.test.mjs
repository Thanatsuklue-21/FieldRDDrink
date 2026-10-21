import test from "node:test";import assert from "node:assert/strict";
const statuses=["PLANNED","RUNNING","PASS","FAIL","HOLD","LOCKED"];
function valid(a){return Array.isArray(a)&&a.every(x=>x&&typeof x.id==="string"&&typeof x.menu==="string"&&statuses.includes(x.status))}
function canLock(x){return !!(x.t0?.trim()&&x.t5?.trim()&&x.t10?.trim()&&x.repeatability)}
test("valid trial collection",()=>assert.equal(valid([{id:"T1",menu:"Latte",status:"PASS"}]),true));
test("reject corrupt collection",()=>assert.equal(valid([{id:"T1",menu:"Latte",status:"BAD"}]),false));
test("LOCK requires sensory and repeatability",()=>{assert.equal(canLock({t0:"ok",t5:"ok",t10:"ok",repeatability:true}),true);assert.equal(canLock({t0:"ok",t5:"ok",t10:"",repeatability:true}),false);assert.equal(canLock({t0:"ok",t5:"ok",t10:"ok",repeatability:false}),false)});
