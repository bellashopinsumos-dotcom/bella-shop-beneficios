// Master Viviana × BellaShop. Registro directo para la campaña temporal.
// Sólo la función de servidor puede insertar estudiantes; nunca se expone una clave secreta al navegador.
const allowed = Deno.env.get('ALLOWED_ORIGIN') || 'https://bellashopinsumos-dotcom.github.io';
const url = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
const key = Deno.env.get('BELLA_SERVER_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || secretKeys.default || '';
const captchaSecret = Deno.env.get('TURNSTILE_SECRET') || '';
const cors: Record<string,string> = {
 'Access-Control-Allow-Origin': allowed,
 'Access-Control-Allow-Methods': 'POST, OPTIONS',
 'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
 'Content-Type': 'application/json; charset=utf-8',
 'Vary': 'Origin'
};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const serverHeaders=()=>({
 'apikey':key,'Content-Type':'application/json',
 ...(key.startsWith('sb_secret_')?{}:{'Authorization':'Bearer '+key})
});
async function verifyCaptcha(token:string,ip:string){
 // Turnstile puede añadirse después sin bloquear el lanzamiento.
 if(!captchaSecret)return true;
 if(!token)return false;
 try{
  const form=new FormData();form.append('secret',captchaSecret);form.append('response',token);
  if(ip)form.append('remoteip',ip);
  const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:form});
  return (await r.json()).success===true;
 }catch{return false}
}
async function hashIp(ip:string){
 const seed=new TextEncoder().encode(key+'|'+ip);
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',seed));
 return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
async function allowLimit(bucket:string,max:number,seconds:number){
 const response=await fetch(url+'/rest/v1/rpc/bella_check_registration_limit',{
  method:'POST',headers:serverHeaders(),
  body:JSON.stringify({p_bucket:bucket,p_max:max,p_window_seconds:seconds})
 });
 if(!response.ok)throw Error('rate_limit_not_configured');
 return (await response.json())===true;
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS'){
  if(req.headers.get('origin')!==allowed)return respond({error:'origin_not_allowed'},403);
  return new Response(null,{status:204,headers:cors});
 }
 if(req.method!=='POST')return respond({error:'method_not_allowed'},405);
 if(req.headers.get('origin')!==allowed)return respond({error:'origin_not_allowed'},403);
 if(!url||!key)return respond({error:'server_not_configured'},503);
 if(Number(req.headers.get('content-length')||'0')>8000)return respond({error:'invalid_request'},413);
 let body:Record<string,unknown>;
 try{body=await req.json()}catch{return respond({error:'invalid_json'},400)}
 const fullName=String(body.full_name||'').trim().replace(/\s+/g,' ');
 let phone=String(body.phone||'').replace(/\D/g,'');
 if(/^573\d{9}$/.test(phone))phone=phone.slice(2);
 const slug=String(body.teacher_slug||'').trim().toLowerCase();
 const policy=String(body.policy_version||'').trim();
 if(body.website)return respond({ok:true}); // campo trampa invisible
 if(fullName.length<4||fullName.length>120||fullName.split(' ').length<2||
   !/^3\d{9}$/.test(phone)|| !/^[a-z0-9-]{2,80}$/.test(slug)||
   body.consent!==true || !/^[a-zA-Z0-9._-]{3,60}$/.test(policy))
    return respond({error:'invalid_fields'},400);
 const ip=req.headers.get('cf-connecting-ip')||
  (req.headers.get('x-forwarded-for')||'').split(',')[0].trim()||
  req.headers.get('x-real-ip')||'sin-ip';
 try{
  const fingerprint=await hashIp(ip);
  // Limites por IP y global para proteger la base sin poner obstáculos a estudiantes reales.
  const perIp=await allowLimit('ip:'+fingerprint,40,600);
  const global=await allowLimit('global:registros',500,3600);
  if(!perIp||!global)return respond({error:'rate_limited'},429);
  if(!await verifyCaptcha(String(body.turnstile_token||''),ip))
    return respond({error:'CAPTCHA_REQUIRED'},400);
  const campaignResponse=await fetch(url+'/rest/v1/campaign_settings?select=registration_open,ends_at&id=eq.1&limit=1',{headers:serverHeaders()});
  if(!campaignResponse.ok)throw Error('campaign_lookup_failed');
  const campaign=(await campaignResponse.json())[0];
  if(!campaign||!campaign.registration_open||(campaign.ends_at&&new Date(campaign.ends_at)<=new Date()))
    return respond({error:'campaign_closed'},403);
  const teacherResponse=await fetch(url+'/rest/v1/teachers?select=id&slug=eq.'+
   encodeURIComponent(slug)+'&active=eq.true&limit=1',{headers:serverHeaders()});
  if(!teacherResponse.ok)throw Error('teacher_lookup_failed');
  const found=await teacherResponse.json();
  if(!found.length)return respond({error:'teacher_not_active'},400);
  const result=await fetch(url+'/rest/v1/students',{
   method:'POST',
   headers:{...serverHeaders(),'Prefer':'return=minimal'},
   body:JSON.stringify({
    full_name:fullName,phone,teacher_id:found[0].id,
    consented_at:new Date().toISOString(),policy_version:policy,status:'active'
   })
  });
  // No revelar si un número ya estaba inscrito.
  if(result.status===409)return respond({ok:true});
  if(!result.ok){console.error('Failed registration',result.status);throw Error('insert_failed')}
  return respond({ok:true});
 }catch(err){
  console.error('Register student error',err);
  return respond({error:'register_unavailable'},503);
 }
});
