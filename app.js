import {ready,config,publicGet,register,normalizePhone,showNotice} from './api.js';
const form=document.getElementById('register-form');
const notice=document.getElementById('notice');
const button=document.getElementById('register-btn');
const teacherDisplay=document.getElementById('teacher-display');
const teacherReadonly=document.getElementById('teacher-readonly');
const slug=(new URLSearchParams(location.search).get('profe')||'viviana').trim().toLowerCase();
let teacher=null;let captchaId=null;
function lock(msg){button.disabled=true;showNotice(notice,msg,'warning')}
async function start(){
 if(!ready()){lock('Estamos preparando este beneficio. Aún no se reciben registros: falta conectar la base de datos.');return}
 if(!/^[a-z0-9-]{2,80}$/.test(slug)){lock('Enlace de profesora inválido.');return}
 try{
  const rows=await publicGet('teachers?select=id,display_name,slug&slug=eq.'+encodeURIComponent(slug)+'&active=eq.true&limit=1');
  if(!rows?.length){lock('Este enlace no está activo. Consulta en BellaShop.');return}
  teacher=rows[0];teacherDisplay.textContent=teacher.display_name;teacherReadonly.value=teacher.display_name;
  if(config().registrationEnabled!==true){lock('El registro estará disponible próximamente. BellaShop está finalizando la activación de los beneficios.');}
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
form.addEventListener('submit',async event=>{
 event.preventDefault();notice.classList.add('hidden');
 if(!teacher)return;
 const fullName=document.getElementById('full-name').value.trim().replace(/\s+/g,' ');
 const phone=normalizePhone(document.getElementById('phone').value);
 const consent=document.getElementById('privacy-consent').checked;
 const trap=document.getElementById('website').value;
 if(fullName.length<4||fullName.length>120||fullName.split(' ').length<2){showNotice(notice,'Escribe tu nombre y apellido completos.','error');return}
 if(!phone){showNotice(notice,'Escribe un celular colombiano válido de 10 dígitos.','error');return}
 if(!consent){showNotice(notice,'Debes autorizar el tratamiento de datos.','error');return}
 if(trap)return;
 button.disabled=true;button.textContent='Registrando...';
 try{
  const token=window.turnstile&&captchaId!==null?window.turnstile.getResponse(captchaId):null;
  await register({full_name:fullName,phone,teacher_slug:teacher.slug,consent:true,policy_version:config().policyVersion||'2026-11-19-v1',turnstile_token:token,website:trap});
  form.classList.add('hidden');document.getElementById('success').classList.remove('hidden');
 }catch(err){
  console.error(err);
  showNotice(notice,err.message==='CAPTCHA_REQUIRED'?'Completa el control de seguridad.':'No se pudo completar el registro. Consulta en BellaShop o intenta más tarde.','error');
  if(window.turnstile&&captchaId!==null)window.turnstile.reset(captchaId);
 }finally{button.disabled=false;button.innerHTML='Quiero registrarme <span>→</span>'}
});
document.getElementById('new-register').addEventListener('click',()=>location.reload());
loadCaptcha();start();