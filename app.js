import {ready,config,publicGet,register,normalizePhone,showNotice} from './api.js';
const form=document.getElementById('register-form');
const notice=document.getElementById('notice');
const button=document.getElementById('register-btn');
const teacherDisplay=document.getElementById('teacher-display');
const teacherReadonly=document.getElementById('teacher-readonly');
const slug=(new URLSearchParams(location.search).get('profe')||'viviana').trim().toLowerCase();
let teacher=null;let captchaId=null;

const socialConsent=document.getElementById('social-follow-consent');
const socialProgress=document.getElementById('social-progress');
const socialLinks=[...document.querySelectorAll('.social-link[data-social]')];
const socialVisitKey='bella_viviana_visitas_redes_v1';
let socialVisits={instagram:false,tiktok:false};
try{
 const saved=JSON.parse(sessionStorage.getItem(socialVisitKey)||'{}');
 socialVisits={instagram:saved.instagram===true,tiktok:saved.tiktok===true};
}catch{}
function socialStepsDone(){return socialVisits.instagram&&socialVisits.tiktok}
function updateSocialSteps(){
 const complete=socialStepsDone();
 socialConsent.disabled=!complete;
 if(!complete)socialConsent.checked=false;
 document.querySelector('.social-confirm').classList.toggle('social-locked',!complete);
 socialLinks.forEach(link=>{
  const visited=!!socialVisits[link.dataset.social];
  link.classList.toggle('social-visited',visited);
  link.setAttribute('aria-label',(visited?'Perfil abierto anteriormente. ':'Abrir perfil de ') + (link.dataset.social==='instagram'?'Instagram':'TikTok')+' de BellaShop en una pestaña nueva');
 });
 if(complete) socialProgress.textContent='¡Ya abriste ambas redes! Si nos seguiste en las dos, marca la confirmación para continuar.';
 else if(socialVisits.instagram) socialProgress.textContent='¡Instagram abierto! Ahora abre TikTok y regresa a confirmar.';
 else if(socialVisits.tiktok) socialProgress.textContent='¡TikTok abierto! Ahora abre Instagram y regresa a confirmar.';
 else socialProgress.textContent='Paso 1: abre Instagram y TikTok. Después podrás marcar la confirmación.';
}
socialLinks.forEach(link=>link.addEventListener('click',()=>{
 const network=link.dataset.social;
 if(network!=='instagram'&&network!=='tiktok')return;
 socialVisits[network]=true;
 try{sessionStorage.setItem(socialVisitKey,JSON.stringify(socialVisits))}catch{}
 updateSocialSteps();
}));
updateSocialSteps();

function lock(msg){button.disabled=true;showNotice(notice,msg,'warning')}
async function start(){
 if(!ready()){lock('Estamos preparando este beneficio. Aún no se reciben registros: falta conectar la base de datos.');return}
 if(!/^[a-z0-9-]{2,80}$/.test(slug)){lock('Enlace de profesora inválido.');return}
 try{
  const rows=await publicGet('teachers?select=id,display_name,slug&slug=eq.'+encodeURIComponent(slug)+'&active=eq.true&limit=1');
  if(!rows?.length){lock('Este enlace no está activo. Consulta en BellaShop.');return}
  teacher=rows[0];teacherDisplay.textContent=teacher.display_name;teacherReadonly.value=teacher.display_name;
  const campaign=await publicGet('campaign_settings?select=registration_open,ends_at&id=eq.1&limit=1');
  if(!campaign?.[0]?.registration_open || (campaign[0].ends_at && new Date(campaign[0].ends_at)<=new Date())){
    lock('Esta temporada de beneficios ha finalizado. ¡Gracias por acompañarnos!');return;
  }
 }catch(err){console.error(err);lock('Por ahora no pudimos cargar el registro. Intenta más tarde.')}
}
function loadCaptcha(){
 if(!config().turnstileSiteKey)return;
 window.onBellaTurnstileLoaded=()=>{
  captchaId=window.turnstile.render('#turnstile-slot',{sitekey:config().turnstileSiteKey,theme:'light'});
 };
 const script=document.createElement('script');
 script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onBellaTurnstileLoaded&render=explicit';
 script.async=true;script.defer=true;document.head.append(script);
}
function renderRegistrationBenefits(result){
 const container=document.getElementById('success-benefits-list');
 container.replaceChildren();
 const offers=Array.isArray(result?.benefits)?result.benefits:[];
 if(!offers.length){
  const empty=document.createElement('p');
  empty.className='benefits-empty';
  empty.textContent='En este momento no hay descuentos publicados. Consulta en BellaShop por los precios especiales de esta temporada.';
  container.append(empty);return;
 }
 const formatPercent=value=>{
  const n=Number(value);
  return Number.isFinite(n)?n.toLocaleString('es-CO',{maximumFractionDigits:2})+' %':'';
 };
 const now=new Date();
 for(const benefit of offers){
  if(!benefit||typeof benefit!=='object')continue;
  const title=String(benefit.title||'Beneficios BellaShop').slice(0,120);
  const items=Array.isArray(benefit.items)?benefit.items.slice(0,30):[];
  const article=document.createElement('article');article.className='selected-benefit-card';
  const head=document.createElement('h4');head.textContent=title;article.append(head);
  const list=document.createElement('ul');list.className='selected-benefit-list';
  for(const value of items){
   const item=String(value??'').trim();
   if(!item)continue;
   const li=document.createElement('li');
   // El administrador admite códigos y descripciones. No aplicar un 10% general
   // a las ofertas que explícitamente tienen porcentajes o descuentos distintos.
   const isSku=!/[\s%$]/.test(item)&&item.length<=48;
   li.textContent=isSku?
    item+' · '+formatPercent(benefit.percent_off)+' de descuento':
    item;
   list.append(li);
  }
  if(list.children.length)article.append(list);
  else{
   const p=document.createElement('p');p.textContent='Consulta en BellaShop las referencias participantes.';
   article.append(p);
  }
  if(benefit.terms){
   const terms=document.createElement('p');terms.className='selected-benefit-terms';
   terms.textContent=String(benefit.terms);article.append(terms);
  }
  const expires=new Date(benefit.ends_at||0);
  if(Number.isFinite(expires.getTime())&&expires>now){
   const date=document.createElement('p');date.className='selected-benefit-date';
   date.textContent='Válido hasta '+expires.toLocaleDateString('es-CO',{timeZone:'America/Bogota'});
   article.append(date);
  }
  container.append(article);
 }
}

form.addEventListener('submit',async event=>{
 event.preventDefault();notice.classList.add('hidden');
 if(!teacher)return;
 const fullName=document.getElementById('full-name').value.trim().replace(/\s+/g,' ');
 const phone=normalizePhone(document.getElementById('phone').value);
 const consent=document.getElementById('privacy-consent').checked;
 const socialFollowConfirmed=socialConsent.checked;
 const trap=document.getElementById('website').value;
 if(fullName.length<4||fullName.length>120||fullName.split(' ').length<2){showNotice(notice,'Escribe tu nombre y apellido completos.','error');return}
 if(!phone){showNotice(notice,'Escribe un celular colombiano válido de 10 dígitos.','error');return}
 if(!socialStepsDone()){
  showNotice(notice,'Primero abre los enlaces de Instagram y TikTok y regresa a confirmar que ya nos sigues.','error');
  socialProgress.scrollIntoView({behavior:'smooth',block:'center'});
  return;
 }
 if(!socialFollowConfirmed){
  showNotice(notice,'Después de seguir ambas cuentas, marca la casilla de confirmación.','error');
  socialConsent.focus();return;
 }
 if(!consent){showNotice(notice,'Debes autorizar el tratamiento de datos.','error');return}
 if(trap)return;
 button.disabled=true;button.textContent='Registrando...';
 try{
  const token=window.turnstile&&captchaId!==null?window.turnstile.getResponse(captchaId):null;
  const result=await register({full_name:fullName,phone,teacher_slug:teacher.slug,consent:true,social_follow_confirmed:socialFollowConfirmed,policy_version:config().policyVersion||'2026-11-19-v1',turnstile_token:token,website:trap});
  renderRegistrationBenefits(result);
  form.classList.add('hidden');
  document.getElementById('form-title').classList.add('hidden');
  document.querySelector('.register-panel .subheading')?.classList.add('hidden');
  document.getElementById('success').classList.remove('hidden');
 }catch(err){
  console.error(err);
  const messages={
   CAPTCHA_REQUIRED:'Por favor, completa el control de seguridad.',
   rate_limited:'Se recibieron muchos registros. Intenta de nuevo en unos minutos.',
   campaign_closed:'Esta temporada de beneficios ha finalizado.',
   invalid_fields:'Revisa tu nombre, celular y autorización.',
   social_follow_required:'Es obligatorio seguir nuestras cuentas de Instagram y TikTok y marcar la confirmación.',
   register_unavailable:'No pudimos guardar tus datos. Intenta de nuevo en unos minutos.'
  };
  showNotice(notice,messages[err.message]||'No pudimos completar el registro. Intenta nuevamente.','error');
  if(window.turnstile&&captchaId!==null)window.turnstile.reset(captchaId);
 }finally{button.disabled=false;button.innerHTML='¡Quiero ser parte! <span>→</span>'}
});
document.getElementById('new-register').addEventListener('click',()=>location.reload());
loadCaptcha();start();