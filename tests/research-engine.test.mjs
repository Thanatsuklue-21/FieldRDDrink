import test from "node:test";
import assert from "node:assert/strict";
import {detectProvider,sourceEvidenceScore,evaluateTrial,rankTrials,nextExperimentHint} from "../src/rd-core.js";
import {isPrivateAddress,stripHtml} from "../api/research.js";

test("detects supported research channels",()=>{
  assert.equal(detectProvider("https://youtu.be/abc"),"YOUTUBE");
  assert.equal(detectProvider("https://www.lemon8-app.com/post/1"),"LEMON8");
  assert.equal(detectProvider("https://gemini.google.com/share/x"),"GEMINI");
  assert.equal(detectProvider("https://pubmed.ncbi.nlm.nih.gov/1"),"PEER_REVIEWED");
});

test("evidence hierarchy scores research above unverified social",()=>{
  const paper=sourceEvidenceScore({type:"PEER_REVIEWED",relevance:5,verified:true,formula:"5 g"});
  const social=sourceEvidenceScore({type:"LEMON8",relevance:5,verified:false,formula:"5 g"});
  assert.ok(paper>social);
});

test("formula evaluator requires structured sensory evidence",()=>{
  const q=evaluateTrial({status:"NEEDS_ADJUSTMENT",t0:"ok",t5:"ok",t10:"ok"});
  assert.equal(q.sensoryScore,null);
  assert.equal(q.decision,"NEEDS_STRUCTURED_SCORE");
  const scored=evaluateTrial({status:"PASS",t0:"ok",t5:"ok",t10:"ok",ingredients:"SKU",scoreTaste:4.5,scoreBody:4.5,scoreIdentity:4.5,scoreDilution:4,scoreOverall:4.5,repeatability:true});
  assert.ok(scored.sensoryScore>=85);
  assert.ok(scored.confidence>=65);
});

test("ranking prefers stronger tested sensory score, never planned trial",()=>{
  const rows=rankTrials([
    {id:"A",menu:"Latte",status:"PASS",t0:"ok",t5:"ok",t10:"ok",scoreTaste:4,scoreBody:4,scoreIdentity:4,scoreDilution:4,scoreOverall:4},
    {id:"B",menu:"Latte",status:"PASS",t0:"ok",t5:"ok",t10:"ok",scoreTaste:5,scoreBody:5,scoreIdentity:4.5,scoreDilution:4.5,scoreOverall:5},
    {id:"C",menu:"Latte",status:"PLANNED",scoreTaste:5,scoreBody:5,scoreIdentity:5,scoreDilution:5,scoreOverall:5}
  ],"Latte");
  assert.deepEqual(rows.map(x=>x.id),["B","A"]);
});

test("sensory winner recommends validation rather than changing formula",()=>{
  assert.match(nextExperimentHint({status:"SENSORY_LOCKED",t0:"ok",t5:"ok",t10:"ok"}),/คงสูตรเดิม/);
});

test("research proxy blocks private address classes",()=>{
  assert.equal(isPrivateAddress("127.0.0.1"),true);
  assert.equal(isPrivateAddress("10.1.2.3"),true);
  assert.equal(isPrivateAddress("192.168.1.2"),true);
  assert.equal(isPrivateAddress("8.8.8.8"),false);
  assert.equal(isPrivateAddress("::1"),true);
});

test("html extraction removes executable markup",()=>{
  const out=stripHtml("<html><script>alert(1)</script><style>x{}</style><body><h1>Matcha</h1><p>5 g</p></body></html>");
  assert.equal(out.includes("alert"),false);
  assert.match(out,/Matcha/);
  assert.match(out,/5 g/);
});
