import test from "node:test";
import assert from "node:assert/strict";
import {detectProvider,sourceEvidenceScore,evaluateTrial,rankTrials,nextExperimentHint,parseSourceRefs,linkedEvidence,evaluateTrialWithEvidence,bestByMenuWithEvidence,trialValidationErrors,formulaItems,researchQueriesForTrial,buildCandidateRecommendation} from "../src/rd-core.js";
import {isPrivateAddress,stripHtml} from "../api/research.js";
import {decodeSearchUrl,parseDuckResults,parseBingResults} from "../api/research-discover.js";

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

test("evidence refs are normalized and deduplicated",()=>assert.deepEqual(parseSourceRefs("SRC-1 · SRC-2, SRC-1\nSRC-3"),["SRC-1","SRC-2","SRC-3"]));
test("verified linked evidence increases confidence but not sensory score",()=>{
 const trial={id:"A",menu:"Latte",status:"PASS",t0:"ok",t5:"ok",t10:"ok",ingredients:"SKU",sourceRefs:"SRC-1",scoreTaste:4,scoreBody:4,scoreIdentity:4,scoreDilution:4,scoreOverall:4};
 const base=evaluateTrial(trial),withEvidence=evaluateTrialWithEvidence(trial,[{id:"SRC-1",type:"PEER_REVIEWED",relevance:5,verified:true,formula:"5 g"}]);
 assert.equal(withEvidence.sensoryScore,base.sensoryScore);assert.ok(withEvidence.confidence>base.confidence);
});
test("missing evidence refs are visible and penalize confidence",()=>{
 const x=linkedEvidence({sourceRefs:"SRC-X"},[]);assert.equal(x.missingCount,1);
 const e=evaluateTrialWithEvidence({status:"PASS",t0:"ok",t5:"ok",t10:"ok",sourceRefs:"SRC-X",scoreTaste:4,scoreBody:4,scoreIdentity:4,scoreDilution:4,scoreOverall:4},[]);
 assert.ok(e.confidence<evaluateTrial({status:"PASS",t0:"ok",t5:"ok",t10:"ok",sourceRefs:"SRC-X",scoreTaste:4,scoreBody:4,scoreIdentity:4,scoreDilution:4,scoreOverall:4}).confidence);
});
test("best formula remains FIELD sensory-led when external evidence differs",()=>{
 const trials=[{id:"A",menu:"Latte",status:"PASS",t0:"ok",t5:"ok",t10:"ok",sourceRefs:"SRC-1",scoreTaste:4.5,scoreBody:4.5,scoreIdentity:4.5,scoreDilution:4.5,scoreOverall:4.5},{id:"B",menu:"Latte",status:"PASS",t0:"ok",t5:"ok",t10:"ok",sourceRefs:"SRC-2",scoreTaste:4,scoreBody:4,scoreIdentity:4,scoreDilution:4,scoreOverall:4}];
 const sources=[{id:"SRC-1",type:"LEMON8",relevance:3,verified:false},{id:"SRC-2",type:"PEER_REVIEWED",relevance:5,verified:true,formula:"x"}];
 assert.equal(bestByMenuWithEvidence(trials,sources)[0].best.id,"A");
});

test("trial validation returns visible errors for empty form",()=>{
 const errors=trialValidationErrors({status:"RUNNING"});
 assert.ok(errors.includes("กรอกชื่อเมนู"));assert.ok(errors.includes("กรอกตัวแปรที่เปลี่ยน"));assert.ok(errors.includes("กรอกสูตรและปริมาณ"));
});
test("Production LOCK validation names missing gates and evidence",()=>{
 const errors=trialValidationErrors({menu:"QA",changed:"QA",formula:"Water 100 g",status:"LOCKED"},["repeatability","dilution"]);
 assert.ok(errors.some(x=>x.includes("T0")));assert.ok(errors.some(x=>x.includes("Ingredient")));assert.ok(errors.some(x=>x.includes("repeatability")));
});


test("formula parser extracts gram and ml variables",()=>{
 const items=formulaItems("Yamito 5 g · Water 40 g · Milk 110 ml");
 assert.deepEqual(items.map(x=>[x.name,x.amount,x.unit]),[["Yamito",5,"g"],["Water",40,"g"],["Milk",110,"ml"]]);
});

test("candidate engine reduces sweetener first when FIELD says sweet-forward",()=>{
 const base={id:"ML-01",menu:"Matcha Latte",status:"NEEDS_ADJUSTMENT",formula:"Yamito 5 g · Crystal 40 g @70°C · Mitr Phol Original Cane Syrup 15 g · CP-Meiji 110 g",t0:"กินง่าย",t5:"ยังอร่อย",t10:"มัทฉะบาง แต่หวานนำ",ingredients:"SKU"};
 const r=buildCandidateRecommendation(base,[base],[]);
 assert.equal(r.state,"READY");
 assert.equal(r.rule,"REDUCE_SWEETENER");
 assert.match(r.changed,/15 → 10 g/);
 assert.match(r.formula,/Syrup 10 g/);
 assert.match(r.why,/ความหวานนำ/);
 assert.equal(r.candidate.status,"PLANNED");
 assert.equal(r.candidate.t0,"");
});

test("candidate engine refuses to mutate sensory or production locked formula",()=>{
 const sensory=buildCandidateRecommendation({id:"PM-02",menu:"Pure Matcha",status:"SENSORY_LOCKED",formula:"Matcha 5 g · Water 160 g"},[],[]);
 const prod=buildCandidateRecommendation({id:"X",menu:"X",status:"LOCKED",formula:"Tea 20 g · Water 200 g"},[],[]);
 assert.equal(sensory.canCreate,false);assert.equal(sensory.state,"LOCKED");
 assert.equal(prod.canCreate,false);assert.equal(prod.state,"LOCKED");
});

test("candidate engine detects an equivalent planned trial instead of duplicating it",()=>{
 const base={id:"ML-01",menu:"Matcha Latte",status:"NEEDS_ADJUSTMENT",formula:"Yamito 5 g · Syrup 15 g · Milk 110 g",t10:"หวานนำ"};
 const planned={id:"ML-02",menu:"Matcha Latte",status:"PLANNED",formula:"Yamito 5 g · Syrup 10 g · Milk 110 g"};
 const r=buildCandidateRecommendation(base,[base,planned],[]);
 assert.equal(r.state,"DUPLICATE");assert.equal(r.canCreate,false);assert.equal(r.duplicateTrialId,"ML-02");
});

test("external evidence can raise candidate confidence but cannot choose a worse sensory winner",()=>{
 const base={id:"A",menu:"Latte",status:"NEEDS_ADJUSTMENT",formula:"Matcha 5 g · Syrup 15 g · Milk 110 g",t0:"ok",t5:"ok",t10:"หวานนำ",scoreTaste:4,scoreBody:4,scoreIdentity:4,scoreDilution:4,scoreOverall:4,sourceRefs:"SRC-1"};
 const source={id:"SRC-1",menu:"Latte",type:"PEER_REVIEWED",relevance:5,verified:true,formula:"sweetness"};
 const r=buildCandidateRecommendation(base,[base],[source]);
 assert.ok(r.confidence>=evaluateTrialWithEvidence(base,[source]).confidence);
 assert.equal(r.candidate.status,"PLANNED");
});

test("research planner builds channel-specific queries from the actual defect",()=>{
 const q=researchQueriesForTrial({menu:"Matcha Latte",t10:"หวานนำ"});
 assert.equal(q.length,5);
 assert.ok(q.every(x=>x.query.includes("Matcha Latte")));
 assert.ok(q.some(x=>x.query.includes("sweetness balance")));
});


test("research scout decodes DuckDuckGo redirect targets safely",()=>{
 const u=decodeSearchUrl("https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fmatcha%3Fa%3D1");
 assert.equal(u,"https://example.com/matcha?a=1");
 assert.equal(decodeSearchUrl("http://example.com/x"),"");
});

test("research scout parses and deduplicates search result links",()=>{
 const html='<a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa">Matcha A</a><a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa">Duplicate</a><a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.org%2Fb">Matcha B</a>';
 const rows=parseDuckResults(html,"WEB",5);
 assert.equal(rows.length,2);
 assert.equal(rows[0].channel,"WEB");
 assert.equal(rows[0].title,"Matcha A");
});


test("research scout parses Bing RSS direct HTTPS results",()=>{
 const xml='<?xml version="1.0"?><rss><channel><item><title>Matcha Guide</title><link>https://example.com/matcha</link><description>5 g</description></item><item><title>Bing Self</title><link>https://www.bing.com/search?q=x</link></item></channel></rss>';
 const rows=parseBingResults(xml,"PRODUCT_PAGE",5);
 assert.equal(rows.length,1);
 assert.equal(rows[0].url,"https://example.com/matcha");
 assert.equal(rows[0].title,"Matcha Guide");
 assert.equal(rows[0].channel,"PRODUCT_PAGE");
});
