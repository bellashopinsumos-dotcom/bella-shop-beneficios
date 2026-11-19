// BellaShop Beneficios: registro público con respuesta privada.
const allowed=Deno.env.get('ALLOWED_ORIGIN')||'';
const url=(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'');
const key=Deno.env.get('BELLA_SERVER_KEY')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const secret=Deno.env.get('TURNSTILE_SECRET')||'';
const cors:Record<string,string>={
 'Access-Control-Allow-Origin':allowed||'null',
 'Access-Control-Allow-Methods':'POST, OPTIONS',
 'Access-Control-Allow-Headers':'apikey, authorization, content-type, x-client-info',
 'Content-Type':'application/json; charset=utf-8',
 'Vary':'Origin'
};
function respond(payload:unknown,status=200){return new Response(JSON.stringify(payload),{status,headers:cors})}
function headers(){return {'apikey':key,'Content-Type':'application/json',...(!key.startsWith('sb_secret_')?{'Authorization':'Bearer '+key}:{})}}
async function verifyCaptcha(token:string,ip:string){
 if(!secret||!token)return false;
 try{
  const f=new FormData();f.append('secret',secret);f.append('response',token);if(ip)f.append('remoteip',ip);
  const resp=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:f});
  const data=await resp.json();return data.success===true;
 }catch{return false}
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS'){
  if(!allowed||req.headers.get('origin')!==allowed)return respond({error:'origin_not_allowed'},403);
  return new Response(null,{status:204,headers:cors});
 }
 if(req.method!=='POST')return respond({error:'method_not_allowed'},405);
 if(!allowed||req.headers.get('origin')!==allowed)return respond({error:'origin_not_allowed'},403);
 if(!url||!key||!secret)return respond({error:'server_not_configured'},503);
 if(Number(req.headers.get('content-length')||'0')>8000)return respond({error:'invalid_request'},400);
 let body:Record<string,unknown>;
 try{body=await req.json()}catch{return respond({error:'invalid_json'},400)}
 const fullName=String(body.full_name||'').trim().replace(/\s+/g,' ');
 let phone=String(body.phone||'').replace(/\D/g,'');
 if(/^573\d{9}$/.test(phone))phone=phone.slice(2);
 const slug=String(body.teacher_slug||'').trim().toLowerCase();
 const policy=String(body.policy_version||'').trim();
 if(body.website)return respond({ok:true});
 if(fullName.length<4||fullName.length>120||fullName.split(' ').length<2||!/^3\d{9}$/.test(phone)||
    !/^[a-z0-9-]{2,80}$/.test(slug)||body.consent!==true||!/^[a-zA-Z0-9._-]{3,60}$/.test(policy))
    return respond({error:'invalid_fields'},400);
 const ip=req.headers.get('cf-connecting-ip')||'';
 if(!await verifyCaptcha(String(body.turnstile_token||''),ip))return respond({error:'CAPTCHA_REQUIRED'},400);
 try{
  const get=await fetch(url+'/rest/v1/teachers?select=id&slug=eq.'+encodeURIComponent(slug)+'&active=eq.true&limit=1',{headers:headers()});
  if(!get.ok)throw Error('read_failed');
  const rows=await get.json();
  if(!rows.length)return respond({error:'teacher_not_active'},400);
  const resp=await fetch(url+'/rest/v1/students',{
   method:'POST',headers:{...headers(),'Prefer':'return=minimal'},
   body:JSON.stringify({full_name:fullName,phone,teacher_id:rows[0].id,consented_at:new Date().toISOString(),policy_version:policy,status:'active'})
  });
  if(resp.status===409)return respond({ok:true});
  if(!resp.ok){console.error('Registro falló:',resp.status);throw Error('write_failed')}
  return respond({ok:true});
 }catch(err){console.error(err);return respond({error:'register_unavailable'},503)}
});