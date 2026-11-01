// Local QA only: synthetic identities and an in-memory database. Never deploy.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const uid='00000000-0000-0000-0000-000000000001';
await db.exec(`create role anon;create role authenticated;create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
insert into auth.users values('${uid}');`);
await db.exec(await readFile(new URL('../supabase/migrations/202611010001_rd_sync.sql',import.meta.url),'utf8'));
const token=Buffer.from(JSON.stringify({alg:'none'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')+'.qa';
const user={id:uid,aud:'authenticated',role:'authenticated',email:'qa@example.test',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
let chain=Promise.resolve();
http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS'){res.end();return;}
  let body='';for await(const chunk of req)body+=chunk;
  if(req.url.startsWith('/auth/v1/token')){res.end(JSON.stringify({access_token:token,token_type:'bearer',expires_in:3600,refresh_token:'qa-refresh',user}));return;}
  if(req.url.startsWith('/auth/v1/user')){res.end(JSON.stringify(user));return;}
  if(req.url.startsWith('/auth/v1/logout')){res.end('{}');return;}
  if(req.url==='/rest/v1/rpc/rd_sync'){
    if(req.headers.authorization!=='Bearer '+token){res.statusCode=401;res.end(JSON.stringify({message:'rd_auth_required'}));return;}
    const run=chain.then(async()=>{
      try{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
        const params=JSON.parse(body);
        const result=await db.query('select public.rd_sync($1::uuid,$2::jsonb) as data',[params.p_owner,JSON.stringify(params.p_records)]);
        res.end(JSON.stringify(result.rows[0].data));
      }catch(e){res.statusCode=400;res.end(JSON.stringify({message:e.message,code:e.code}));}
    });chain=run.catch(()=>{});return;
  }
  res.statusCode=404;res.end('{}');
}).listen(5188,'127.0.0.1',()=>console.log('Synthetic R&D QA API http://127.0.0.1:5188'));
