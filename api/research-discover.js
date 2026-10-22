const MAX_QUERY=120;
function decodeEntity(s=""){return String(s).replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#x2F;/gi,"/")}
function stripTags(s=""){return decodeEntity(String(s).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim())}
export function decodeSearchUrl(raw=""){
  try{
    let href=decodeEntity(raw);
    if(href.startsWith("//"))href="https:"+href;
    const u=new URL(href,"https://duckduckgo.com");
    const target=u.searchParams.get("uddg");
    const out=target?new URL(target):u;
    if(out.protocol!=="https:")return"";
    const h=out.hostname.toLowerCase();
    if(h.includes("duckduckgo.com"))return"";
    return out.toString();
  }catch{return""}
}
export function parseDuckResults(html="",channel="WEB",limit=4){
  const out=[],seen=new Set();
  const re=/<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while((m=re.exec(html))&&out.length<limit){
    const attrs=m[1];
    if(!/result__a/i.test(attrs))continue;
    const hm=attrs.match(/href=["']([^"']+)["']/i);
    if(!hm)continue;
    const url=decodeSearchUrl(hm[1]);
    if(!url||seen.has(url))continue;
    seen.add(url);
    out.push({channel,url,title:stripTags(m[2])||url});
  }
  return out;
}
function queries(menu,focus=""){
  const m=String(menu||"").trim().slice(0,MAX_QUERY);
  const f=String(focus||"").trim().slice(0,60);
  const extra=f?" "+f:"";
  return[
    {channel:"WEB",q:m+extra+" recipe grams"},
    {channel:"YOUTUBE",q:"site:youtube.com "+m+extra+" recipe grams barista"},
    {channel:"LEMON8",q:"site:lemon8-app.com "+m+" สูตร"+extra},
    {channel:"PEER_REVIEWED",q:"site:pubmed.ncbi.nlm.nih.gov "+m+" sensory extraction"+extra},
    {channel:"PRODUCT_PAGE",q:m+" official preparation guide ingredients"+extra}
  ];
}
export function parseBingResults(xml="",channel="WEB",limit=4){
  const out=[],seen=new Set();
  const re=/<item>([\s\S]*?)<\/item>/gi;
  let m;
  while((m=re.exec(xml))&&out.length<limit){
    const body=m[1];
    const title=stripTags((body.match(/<title>([\s\S]*?)<\/title>/i)||[])[1]||"");
    const link=decodeEntity((body.match(/<link>([\s\S]*?)<\/link>/i)||[])[1]||"").trim();
    let url="";
    try{const u=new URL(link);if(u.protocol==="https:"&&!u.hostname.toLowerCase().includes("bing.com"))url=u.toString()}catch{}
    if(!url||seen.has(url))continue;
    seen.add(url);
    out.push({channel,url,title:title||url});
  }
  return out;
}
async function searchBing(x){
  const u="https://www.bing.com/search?q="+encodeURIComponent(x.q)+"&format=rss&count=5&setlang=en-US";
  const r=await fetch(u,{signal:AbortSignal.timeout(7000),headers:{"user-agent":"Mozilla/5.0 FIELD-RD-ResearchScout/1.0","accept":"application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.5"}});
  if(!r.ok)throw new Error("bing_status");
  return parseBingResults(await r.text(),x.channel,3);
}
async function searchDuck(x){
  const u="https://html.duckduckgo.com/html/?q="+encodeURIComponent(x.q);
  const r=await fetch(u,{signal:AbortSignal.timeout(7000),headers:{"user-agent":"Mozilla/5.0 FIELD-RD-ResearchScout/1.0","accept":"text/html"}});
  if(!r.ok)throw new Error("duck_status");
  return parseDuckResults(await r.text(),x.channel,3);
}
async function searchOne(x){
  try{
    const bing=await searchBing(x);
    if(bing.length)return bing;
  }catch{}
  return searchDuck(x);
}
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="GET")return res.status(405).json({ok:false,error:"method_not_allowed"});
  const menu=String(req.query?.menu||"").trim();
  const focus=String(req.query?.focus||"").trim();
  if(!menu)return res.status(400).json({ok:false,error:"menu_required"});
  if(menu.length>MAX_QUERY)return res.status(400).json({ok:false,error:"menu_too_long"});
  try{
    const sets=await Promise.allSettled(queries(menu,focus).map(searchOne));
    const results=[],seen=new Set();
    for(const s of sets){
      if(s.status!=="fulfilled")continue;
      for(const row of s.value){if(!seen.has(row.url)){seen.add(row.url);results.push(row)}}
    }
    return res.status(200).json({ok:true,menu,focus,results:results.slice(0,12),partial:sets.some(x=>x.status==="rejected"),verified:false});
  }catch{
    return res.status(502).json({ok:false,error:"discovery_failed"});
  }
}
