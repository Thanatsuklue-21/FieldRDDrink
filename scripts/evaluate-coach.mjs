import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {buildResearchBrief} from '../src/research-coach.js';
import {detectProvider} from '../src/rd-core.js';
const baselineRef='0fe259962cc5c0cd21d0940821d0829f325f14b6';
const baselineSource=execFileSync('git',['show',baselineRef+':src/rd-core.js'],{encoding:'utf8'});
const baseline=await import('data:text/javascript;base64,'+Buffer.from(baselineSource).toString('base64'));
const base={id:'QA-BASE',menu:'Matcha Latte',status:'NEEDS_ADJUSTMENT',changed:'baseline',formula:'Matcha 5 g · Syrup 15 g · Milk 110 g',t10:'หวานนำ'};
const planned={...base,id:'QA-PLAN',status:'PLANNED',formula:'Matcha 5 g · Syrup 10 g · Milk 110 g'};
const cases=[
  ['Thai negation',{...base,t10:'ไม่หวานเกิน'},[],false],
  ['English negation',{...base,t10:'not too sweet'},[],false],
  ['High score without defect',{...base,t10:'ดีแล้ว',scoreIdentity:4,scoreOverall:5},[],false],
  ['Notes without actual tasting',{...base,t10:'',notes:'หวานนำ'},[],false],
  ['Unknown result state',{...base,status:'UNKNOWN'},[],false],
  ['Partially parsed recipe',{...base,formula:base.formula+' · unknown amount'},[],false],
  ['Specific actual defect',base,[],true],
  ['Existing planned candidate',base,[base,planned],false],
  ['Locked formula',{...base,status:'SENSORY_LOCKED'},[],false]
];
const results=cases.map(([name,trial,all,expected])=>({name,expectedCanCreate:expected,
  before:baseline.buildCandidateRecommendation(trial,all,[]).canCreate===expected,
  after:buildResearchBrief(trial,all,[]).advice.canCreate===expected}));
const spoof='https://doi.org.attacker.test/paper';
results.push({name:'Publisher-domain lookalike',before:baseline.detectProvider(spoof)==='OTHER',after:detectProvider(spoof)==='OTHER'});
const report={kind:'authored-local-regression-comparison',baselineRef,cases:results.length,
  baselinePass:results.filter(x=>x.before).length,coachPass:results.filter(x=>x.after).length,results,
  limitation:'Synthetic authored regression cases, not held-out evaluation, actual tasting, model training or a comparison with Claude/other AI models.'};
await writeFile(new URL('../docs/research-coach-benchmark.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.coachPass!==report.cases)process.exitCode=1;
