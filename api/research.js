import dns from "node:dns/promises";
const MAX_BYTES=600000;

function isPrivateIPv4(ip){
  const p=ip.split(".").map(Number);
  if(p.length!==4||p.some(x=>!Number.isFinite(x)))return false;
  return p[0]===10||p[0]===127||(p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168)||p[0]===0;
}

export function isPrivateAddress(ip=""){
  const x=ip.toLowerCase();
  if(x==="::1"||x.startsWith("fc")||x.startsWith("fd")||x.startsWith("fe80:"))return true;
  if(x.startsWith("::ffff:"))return isPrivateIPv4(x.slice(7));
  return isPrivateIPv4(x);
}

async function assertPublicUrl(raw){
  const u=new URL(raw);
  if(u.protocol!=="https:")throw new Error("https_only");
  const h=u.hostname.toLowerCase();
  if(h==="localhost"||h.endsWith(".local")||h.endsWith(".internal"))throw new Error("private_host");
  if(/^\d+\.\d+\.\d+\.\d+$/.test(h)&&isPrivateAddress(h))throw new Error("private_host");
  const addrs=await dns.lookup(h,{all:true});
  if(!addrs.length||addrs.some(x=>isPrivateAddress(x.address)))throw new Error("private_host");
  return u;
}

async function safeFetch(raw,limit=4){
  let current=await assertPublicUrl(raw);
  for(let i=0;i<limit;i++){
    const r=await fetch(current,{redirect:"manual",headers:{"user-agent":"FIELD-RD-Research/1.0","accept":"text/html,application/json,text/plain;q=0.9,*/*;q=0.5"}});
    if(r.status>=300&&r.status<400){
      const loc=r.headers.get("location");
      if(!loc)throw new Error("redirect_without_location");
      current=await assertPublicUrl(new URL(loc,current).toString());
      continue;
    }
    return {r,url:current.toString()};
  }
  throw new Error("too_many_redirects");
}

function entity(s=""){
  return s.replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
}

export function stripHtml(html=""){
  return entity(html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<noscript[\s\S]*?<\/noscript>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim());
}

function pickMeta(html){
  const d=html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)||html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const o=html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i)||html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i);
  return entity((d&&d[1])||(o&&o[1])||"");
}

function pageTitle(html){
  const m=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?stripHtml(m[1]):"";
}

function provider(raw){
  try{
    const h=new URL(raw).hostname.toLowerCase();
    if(h.includes("youtube.com")||h==="youtu.be")return"YOUTUBE";
    if(h.includes("lemon8"))return"LEMON8";
    if(h.includes("gemini.google")||h==="share.google")return"GEMINI";
    if(h.includes("pubmed")||h.includes("doi.org")||h.includes("sciencedirect")||h.includes("ncbi.nlm.nih.gov"))return"PEER_REVIEWED";
    return"WEB";
  }catch{return"WEB"}
}

async function youtubeMeta(url){
  const endpoint="https://www.youtube.com/oembed?url="+encodeURIComponent(url)+"&format=json";
  const r=await fetch(endpoint,{headers:{"user-agent":"FIELD-RD-Research/1.0"}});
  if(!r.ok)return null;
  const j=await r.json();
  return {title:j.title||"",author:j.author_name||"",description:"YouTube metadata imported. Transcript/formula must still be verified from the video.",text:""};
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="GET")return res.status(405).json({ok:false,error:"method_not_allowed"});
  const raw=String(req.query?.url||"").trim();
  if(!raw)return res.status(400).json({ok:false,error:"url_required"});
  try{
    const p=provider(raw);
    if(p==="YOUTUBE"){
      const y=await youtubeMeta(raw);
      if(y)return res.status(200).json({ok:true,provider:p,url:raw,...y,limited:true});
    }
    const got=await safeFetch(raw);
    const r=got.r,url=got.url;
    if(!r.ok)return res.status(400).json({ok:false,error:"upstream_status",status:r.status});
    const type=(r.headers.get("content-type")||"").toLowerCase();
    const buf=Buffer.from(await r.arrayBuffer());
    if(buf.length>MAX_BYTES)return res.status(413).json({ok:false,error:"source_too_large"});
    const rawText=buf.toString("utf8");
    if(type.includes("application/json"))return res.status(200).json({ok:true,provider:p,url,title:"JSON source",description:"",text:rawText.slice(0,10000),limited:rawText.length>10000});
    const text=stripHtml(rawText).slice(0,10000);
    return res.status(200).json({ok:true,provider:p,url,title:pageTitle(rawText)||url,description:pickMeta(rawText),text,limited:text.length>=10000});
  }catch(e){
    const code=String(e?.message||"fetch_failed");
    const safe=["https_only","private_host","too_many_redirects","redirect_without_location"].includes(code)?code:"fetch_failed";
    return res.status(400).json({ok:false,error:safe});
  }
}
