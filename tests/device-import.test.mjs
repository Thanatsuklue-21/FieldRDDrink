import test from "node:test";
import assert from "node:assert/strict";
import {mergeImmutableRecords} from "../src/rd-core.js";
const a={id:"TR-1",menu:"Pure Matcha",status:"SENSORY_LOCKED",t0:"good"};
const b={id:"TR-2",menu:"Matcha Latte",status:"PLANNED",t0:""};
test("imports new Trial without modifying the local record",()=>{
 const old=[a];const r=mergeImmutableRecords(old,[b],"Trial");
 assert.equal(r.added,1);assert.deepEqual(r.records,[a,b]);assert.deepEqual(old,[a]);
});
test("reimport is idempotent and does not duplicate IDs",()=>{
 const r=mergeImmutableRecords([a,b],[b,a],"Trial");
 assert.equal(r.added,0);assert.equal(r.unchanged,2);assert.deepEqual(r.records,[a,b]);
});
test("identical content with reordered object keys does not falsely conflict",()=>{
 const r=mergeImmutableRecords([a],[{t0:"good",status:"SENSORY_LOCKED",menu:"Pure Matcha",id:"TR-1"}],"Trial");
 assert.equal(r.added,0);
});
test("same ID with different sensory result fails closed",()=>{
 assert.throws(()=>mergeImmutableRecords([a],[{...a,t0:"changed"}],"Trial"),/import_conflict:Trial:TR-1/);
 assert.equal(a.t0,"good");
});
test("duplicate imported IDs fail before a merge can be persisted",()=>{
 assert.throws(()=>mergeImmutableRecords([a],[b,b],"Trial"),/import_invalid_or_duplicate_id/);
});
test("invalid or duplicate local IDs fail closed",()=>{
 assert.throws(()=>mergeImmutableRecords([{id:"bad"},{id:"bad"}],[b]),/local_invalid_id/);
 assert.throws(()=>mergeImmutableRecords([{}],[b]),/local_invalid_id/);
});
test("works independently for Evidence records",()=>{
 const s={id:"SRC-1",url:"https://example.com",verified:false};
 assert.equal(mergeImmutableRecords([],[s],"Evidence").added,1);
 assert.throws(()=>mergeImmutableRecords([s],[{...s,verified:true}],"Evidence"),/import_conflict:Evidence:SRC-1/);
});
