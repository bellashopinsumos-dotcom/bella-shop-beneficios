import {ready,config,privateRequest,signIn,session,logout,normalizePhone,escapeHtml,showNotice} from './api.js';

const $=id=>document.getElementById(id);
const e=value=>escapeHtml(value);
let teachers=[],benefits=[],campaign=null;
const studentsById=new Map();
const teacherById=id=>teachers.find(t=>t.id===id);
const teacherName=id=>teacherById(id)?.display_name||'Sin profesora';
const active=b=>b.active && new Date(b.starts_at)<=new Date() && new Date(b.ends_at)>=new Date();
const endOfDay=d=>new Date(d+'T23:59:59-05:00').toISOString();
const localDay=v=>v?new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v)):'';
const phoneOrNull=v=>normalizePhone(v);
const cleanCodes=value=>[...new Set(String(value).split(/[,;\n]/).map(s=>s.trim().toUpperCase()).filter(Boolean))];
function notify(message,type=''){showNotice($('admin-notice'),message,type)}
function view(ok){
 $('login-view').classList.toggle('hidden',ok);
 $('dashboard').classList.toggle('hidden',!ok);
 $('logout').classList.toggle('hidden',!ok);
}
function options(selected,includeDisabled=false){
 return teachers.filter(t=>includeDisabled||t.active).map(t=>'<option value="'+e(t.id)+'"'+(t.id===selected?' selected':'')+'>'+e(t.display_name)+'</option>').join('');
}
function alertError(err){
 let msg=String(err?.message||err);
 if(msg.includes('23505')||msg.includes('duplicate key')||msg.includes('409'))msg='Este número o código ya está registrado.';
 if(msg.includes('foreign key')||msg.includes('23503'))msg='Tiene registros asociados. Desactiva este elemento en lugar de eliminarlo.';
 notify(msg,'error');
}
async function authorize(){
 const rows=await privateRequest('admins?select=user_id,enabled&enabled=eq.true&limit=1');
 if(!rows?.length){logout();throw Error('Esta cuenta no tiene acceso de administrador.')}
}
async function initialize(){
 if(!ready()){showNotice($('login-notice'),'Falta configurar Supabase.','error');$('login-button').disabled=true;return}
 if(!session())return;
 try{await authorize();view(true);await reload()}catch(err){view(false);showNotice($('login-notice'),String(err.message),'error')}
}
$('login-form').addEventListener('submit',async event=>{
 event.preventDefault();
 const button=$('login-button');button.disabled=true;
 try{await signIn($('email').value.trim(),$('password').value);await authorize();$('password').value='';view(true);await reload()}
 catch(err){logout();showNotice($('login-notice'),String(err.message),'error')}
 finally{button.disabled=false}
});
$('logout').addEventListener('click',()=>{logout();view(false)});
document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b===button));
 ['students','benefits','teachers','campaign'].forEach(tab=>$('tab-'+tab).classList.toggle('hidden',tab!==button.dataset.tab));
}));
document.querySelectorAll('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>{
 $(button.dataset.closeDialog).close();
}));
async function reload(){
 try{
  const data=await Promise.all([
   privateRequest('teachers?select=id,display_name,slug,active&order=display_name.asc'),
   privateRequest('benefits?select=*&order=created_at.desc&limit=200'),
   privateRequest('campaign_settings?select=*&id=eq.1&limit=1')
  ]);
  teachers=data[0];benefits=data[1];campaign=data[2][0]||null;
  renderBenefits();renderTeachers();renderCampaign();
  $('new-student-teacher').innerHTML=options(null);
  $('edit-student-teacher').innerHTML=options(null,true);
  $('edit-benefit-teacher').innerHTML=options(null,true);
  await Promise.all([counts(),recents()]);
 }catch(err){notify('No fue posible actualizar los datos: '+String(err.message),'error')}
}
async function counts(){
 const results=await Promise.all([
  privateRequest('students?select=id',{method:'HEAD',headers:{Prefer:'count=exact'},countOnly:true}),
  privateRequest('students?select=id&status=eq.active',{method:'HEAD',headers:{Prefer:'count=exact'},countOnly:true})
 ]);
 $('total-students').textContent=results[0].toLocaleString('es-CO');
 $('active-students').textContent=results[1].toLocaleString('es-CO');
 $('active-benefits').textContent=benefits.filter(active).length.toLocaleString('es-CO');
}
function studentCard(s,withBenefits=false){
 const selected=s.status==='active'?benefits.filter(b=>b.teacher_id===s.teacher_id&&active(b)):[];
 return '<article class="student-card">'+
  '<div class="card-head"><h3>'+e(s.full_name)+'</h3><span class="status '+(s.status==='active'?'':'off')+'">'+(s.status==='active'?'Activa':'Suspendida')+'</span></div>'+
  '<p class="benefit-meta">'+e(s.phone)+' · '+e(teacherName(s.teacher_id))+' · '+new Date(s.created_at).toLocaleDateString('es-CO')+'</p>'+'<p class="benefit-meta">Redes: '+(s.social_follow_declared_at?'Confirmación declarada el '+new Date(s.social_follow_declared_at).toLocaleDateString('es-CO'):'Sin confirmación registrada')+'</p>'+
  (withBenefits?'<p class="benefit-meta"><b>Beneficios vigentes:</b> '+(selected.length?selected.map(b=>e(b.title)+' ('+Number(b.percent_off)+'%)').join(', '):'Ninguno')+'</p>':'')+
  '<div class="admin-actions">'+
  '<button type="button" class="tiny-button" data-action="student-edit" data-id="'+e(s.id)+'">Editar</button>'+
  '<button type="button" class="tiny-button" data-action="student-toggle" data-id="'+e(s.id)+'">'+(s.status==='active'?'Suspender':'Reactivar')+'</button>'+
  '<button type="button" class="tiny-button danger-button" data-action="student-delete" data-id="'+e(s.id)+'">Eliminar</button>'+
  '</div></article>';
}
function showStudents(rows,target,withBenefits=false){
 rows.forEach(s=>studentsById.set(s.id,s));
 $(target).innerHTML=rows.length?'<div class="student-grid">'+rows.map(s=>studentCard(s,withBenefits)).join('')+'</div>':'No hay registros para mostrar.';
}
async function recents(){
 const rows=await privateRequest('students?select=id,full_name,phone,teacher_id,status,social_follow_declared_at,created_at&order=created_at.desc&limit=30');
 showStudents(rows,'recent-students');
}
$('search-form').addEventListener('submit',async ev=>{
 ev.preventDefault();
 const value=$('search-phone').value.trim();
 const normalized=phoneOrNull(value);
 const cleaned=value.replace(/[^\p{L}\p{N}\s-]/gu,'').trim();
 if(!normalized && cleaned.length<2){notify('Escribe al menos 2 caracteres del nombre o el celular completo.','error');return}
 const filter=normalized?'phone=eq.'+encodeURIComponent(normalized):
  /^\d+$/.test(cleaned)?'phone=ilike.*'+encodeURIComponent(cleaned)+'*':'full_name=ilike.*'+encodeURIComponent(cleaned)+'*';
 $('search-results').textContent='Buscando…';
 try{
  const rows=await privateRequest('students?select=id,full_name,phone,teacher_id,status,created_at&'+filter+'&order=created_at.desc&limit=100');
  showStudents(rows,'search-results',true);
 }catch(err){$('search-results').textContent='No se pudo realizar la búsqueda.';alertError(err)}
});
$('student-create-form').addEventListener('submit',async ev=>{
 ev.preventDefault();
 const name=$('new-student-name').value.trim().replace(/\s+/g,' ');
 const phone=phoneOrNull($('new-student-phone').value);
 if(name.split(' ').length<2 || !phone){notify('Indica nombre y apellido y un celular colombiano válido.','error');return}
 if(!$('new-student-consent').checked){notify('Es indispensable la autorización de la estudiante.','error');return}
 try{
  await privateRequest('students',{method:'POST',headers:{Prefer:'return=minimal'},
   body:JSON.stringify({full_name:name,phone,teacher_id:$('new-student-teacher').value,status:'active',
    consented_at:new Date().toISOString(),policy_version:config().policyVersion||'2026-11-19-v1'})
  });
  $('student-create-form').reset();notify('Estudiante registrada y activa.');await reload();
 }catch(err){alertError(err)}
});
function openStudentEditor(s){
 $('edit-student-id').value=s.id;
 $('edit-student-name').value=s.full_name;
 $('edit-student-phone').value=s.phone;
 $('edit-student-teacher').innerHTML=options(s.teacher_id,true);
 $('edit-student-status').value=s.status;
 $('student-editor').showModal();
}
$('student-edit-form').addEventListener('submit',async ev=>{
 ev.preventDefault();
 const name=$('edit-student-name').value.trim().replace(/\s+/g,' ');
 const phone=phoneOrNull($('edit-student-phone').value);
 if(name.split(' ').length<2||!phone){notify('Revisa el nombre y el celular.','error');return}
 try{
  await privateRequest('students?id=eq.'+encodeURIComponent($('edit-student-id').value),
   {method:'PATCH',headers:{Prefer:'return=minimal'},
    body:JSON.stringify({full_name:name,phone,teacher_id:$('edit-student-teacher').value,status:$('edit-student-status').value})});
  $('student-editor').close();notify('Datos de la estudiante actualizados.');await reload();
  $('search-results').textContent='Los datos se actualizaron. Busca de nuevo para verlos.';
 }catch(err){alertError(err)}
});
function renderBenefits(){
 $('benefit-teacher').innerHTML=options(null);
 $('benefit-list').innerHTML=benefits.length?benefits.map(b=>
  '<article class="benefit-card"><div class="card-head"><h3>'+e(b.title)+' <span class="chip">'+Number(b.percent_off)+'%</span></h3><span class="status '+(active(b)?'':'off')+'">'+(active(b)?'Vigente':b.active?'Fuera de fecha':'Desactivado')+'</span></div>'+
  '<p class="benefit-meta">'+e(teacherName(b.teacher_id))+' · Hasta '+new Date(b.ends_at).toLocaleDateString('es-CO')+'</p>'+
  '<p class="benefit-meta">Códigos exactos: '+(b.product_codes||[]).map(e).join(', ')+'</p>'+
  '<p class="benefit-meta">'+e(b.terms||'Aplican condiciones de tienda.')+'</p>'+
  '<div class="admin-actions">'+
  '<button type="button" class="tiny-button" data-action="benefit-edit" data-id="'+e(b.id)+'">Editar</button>'+
  '<button type="button" class="tiny-button" data-action="benefit-toggle" data-id="'+e(b.id)+'">'+(b.active?'Desactivar':'Activar')+'</button>'+
  '<button type="button" class="tiny-button danger-button" data-action="benefit-delete" data-id="'+e(b.id)+'">Eliminar</button>'+
  '</div></article>').join(''):'Aún no hay beneficios creados.';
}
$('benefit-form').addEventListener('submit',async ev=>{
 ev.preventDefault();
 const codes=cleanCodes($('benefit-codes').value);
 const percent=Number($('benefit-percent').value);
 const end=$('benefit-end').value;
 if(!codes.length||percent<=0||percent>100||!end||endOfDay(end)<=new Date().toISOString()){
  notify('Revisa los códigos exactos, porcentaje y fecha futura.','error');return;
 }
 try{
  await privateRequest('benefits',{method:'POST',headers:{Prefer:'return=minimal'},
   body:JSON.stringify({teacher_id:$('benefit-teacher').value,title:$('benefit-title').value.trim(),
    percent_off:percent,product_codes:codes,ends_at:endOfDay(end),terms:$('benefit-terms').value.trim(),active:true})
  });
  $('benefit-form').reset();notify('Beneficio creado.');await reload();
 }catch(err){alertError(err)}
});
function openBenefitEditor(b){
 $('edit-benefit-id').value=b.id;
 $('edit-benefit-teacher').innerHTML=options(b.teacher_id,true);
 $('edit-benefit-title').value=b.title;
 $('edit-benefit-percent').value=b.percent_off;
 $('edit-benefit-end').value=localDay(b.ends_at);
 $('edit-benefit-codes').value=(b.product_codes||[]).join(', ');
 $('edit-benefit-terms').value=b.terms||'';
 $('edit-benefit-active').checked=b.active;
 $('benefit-editor').showModal();
}
$('benefit-edit-form').addEventListener('submit',async ev=>{
 ev.preventDefault();
 const codes=cleanCodes($('edit-benefit-codes').value);
 const percent=Number($('edit-benefit-percent').value);
 const end=$('edit-benefit-end').value;
 if(!codes.length||percent<=0||percent>100||!end){
  notify('Revisa la información del beneficio.','error');return;
 }
 try{
  await privateRequest('benefits?id=eq.'+encodeURIComponent($('edit-benefit-id').value),
   {method:'PATCH',headers:{Prefer:'return=minimal'},
    body:JSON.stringify({teacher_id:$('edit-benefit-teacher').value,
      title:$('edit-benefit-title').value.trim(),percent_off:percent,product_codes:codes,
      ends_at:endOfDay(end),terms:$('edit-benefit-terms').value.trim(),active:$('edit-benefit-active').checked})});
  $('benefit-editor').close();notify('Beneficio actualizado.');await reload();
 }catch(err){alertError(err)}
});
function renderTeachers(){
 $('teacher-list').innerHTML=teachers.map(t=>{
  const url=new URL('index.html?profe='+encodeURIComponent(t.slug),location.href).href;
  return '<article class="teacher-card">'+
   '<div class="card-head"><h3>'+e(t.display_name)+'</h3><span class="status '+(t.active?'':'off')+'">'+(t.active?'Activa':'Inactiva')+'</span></div>'+
   '<p class="benefit-meta">Enlace individual de registro</p>'+
   '<div class="teacher-link">'+e(url)+'</div>'+
   '<div class="teacher-tools">'+
   '<button type="button" class="tiny-button" data-action="teacher-copy" data-id="'+e(t.id)+'">Copiar enlace</button>'+
   '<button type="button" class="tiny-button" data-action="teacher-qr" data-id="'+e(t.id)+'">Ver QR</button>'+
   '<button type="button" class="tiny-button" data-action="teacher-edit" data-id="'+e(t.id)+'">Editar</button>'+
   '<button type="button" class="tiny-button" data-action="teacher-toggle" data-id="'+e(t.id)+'">'+(t.active?'Desactivar':'Activar')+'</button>'+
   '<button type="button" class="tiny-button danger-button" data-action="teacher-delete" data-id="'+e(t.id)+'">Eliminar</button>'+
   '</div><div class="qr-holder" id="qr-'+e(t.id)+'"></div></article>';
 }).join('');
}
$('teacher-create-form').addEventListener('submit',async ev=>{
 ev.preventDefault();
 const name=$('new-teacher-name').value.trim();
 const slug=$('new-teacher-slug').value.trim().toLowerCase();
 if(name.length<3||!/^[a-z0-9-]{2,80}$/.test(slug)){notify('Revisa el nombre y código QR de la profesora.','error');return}
 try{
  await privateRequest('teachers',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({display_name:name,slug,active:true})});
  $('teacher-create-form').reset();notify('Profesora creada. El QR ya está disponible.');await reload();
 }catch(err){alertError(err)}
});
function openTeacherEditor(t){
 $('edit-teacher-id').value=t.id;
 $('edit-teacher-name').value=t.display_name;
 $('edit-teacher-slug').value=t.slug;
 $('edit-teacher-active').checked=t.active;
 $('teacher-editor').showModal();
}
$('teacher-edit-form').addEventListener('submit',async ev=>{
 ev.preventDefault();
 const name=$('edit-teacher-name').value.trim();
 const slug=$('edit-teacher-slug').value.trim().toLowerCase();
 if(name.length<3||!/^[a-z0-9-]{2,80}$/.test(slug)){notify('Revisa el nombre y el código QR.','error');return}
 try{
  await privateRequest('teachers?id=eq.'+encodeURIComponent($('edit-teacher-id').value),
   {method:'PATCH',headers:{Prefer:'return=minimal'},
    body:JSON.stringify({display_name:name,slug,active:$('edit-teacher-active').checked})});
  $('teacher-editor').close();notify('Profesora actualizada. Si cambiaste su código, debes compartir el nuevo QR.');await reload();
 }catch(err){alertError(err)}
});
function renderCampaign(){
 if(!campaign)return;
 $('campaign-open').checked=campaign.registration_open;
 $('campaign-end').value=localDay(campaign.ends_at);
 const ended=!!campaign.ends_at&&new Date(campaign.ends_at)<=new Date();
 const open=campaign.registration_open&&!ended;
 showNotice($('campaign-state'),open?'Inscripciones abiertas: quien escanee el QR puede registrarse directamente.':
  'Inscripciones cerradas: se conservarán los registros previos. Los nuevos registros están bloqueados.',
  open?'success':'warning');
}
$('campaign-form').addEventListener('submit',async ev=>{
 ev.preventDefault();
 const open=$('campaign-open').checked;
 const end=$('campaign-end').value;
 if(open&&end&&new Date(endOfDay(end))<new Date()){notify('Para abrir el registro, selecciona una fecha de cierre futura.','error');return}
 try{
  await privateRequest('campaign_settings?id=eq.1',{method:'PATCH',headers:{Prefer:'return=minimal'},
   body:JSON.stringify({registration_open:open,ends_at:end?endOfDay(end):null,updated_at:new Date().toISOString()})});
  notify(open?'Temporada abierta: registro automático habilitado.':'Temporada cerrada: el QR ya no admitirá registros.');
  await reload();
 }catch(err){alertError(err)}
});
document.getElementById('dashboard').addEventListener('click',async ev=>{
 const btn=ev.target.closest('button[data-action]');
 if(!btn)return;
 const id=btn.dataset.id,action=btn.dataset.action;
 try{
  if(action.startsWith('student-')){
   const s=studentsById.get(id);if(!s)return;
   if(action==='student-edit'){openStudentEditor(s);return}
   if(action==='student-toggle'){
    if(!confirm('¿Cambiar el estado de '+s.full_name+'?'))return;
    await privateRequest('students?id=eq.'+encodeURIComponent(id),
     {method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:s.status==='active'?'suspended':'active'})});
    notify('Estado actualizado.');await reload();$('search-results').textContent='Estado cambiado. Realiza otra búsqueda para actualizar.';
   }
   if(action==='student-delete'){
    if(!confirm('¿ELIMINAR definitivamente a '+s.full_name+' y sus datos? Esta acción no se puede deshacer.'))return;
    await privateRequest('students?id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:{Prefer:'return=minimal'}});
    notify('Registro eliminado definitivamente.');await reload();$('search-results').textContent='Registro eliminado.';
   }
   return;
  }
  if(action.startsWith('benefit-')){
   const b=benefits.find(x=>x.id===id);if(!b)return;
   if(action==='benefit-edit'){openBenefitEditor(b);return}
   if(action==='benefit-toggle'){
    await privateRequest('benefits?id=eq.'+encodeURIComponent(id),
     {method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({active:!b.active})});
    notify('Beneficio actualizado.');await reload();
   }
   if(action==='benefit-delete'){
    if(!confirm('¿Eliminar definitivamente el beneficio "'+b.title+'"?'))return;
    await privateRequest('benefits?id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:{Prefer:'return=minimal'}});
    notify('Beneficio eliminado.');await reload();
   }
   return;
  }
  if(action.startsWith('teacher-')){
   const t=teacherById(id);if(!t)return;
   const url=new URL('index.html?profe='+encodeURIComponent(t.slug),location.href).href;
   if(action==='teacher-copy'){
    await navigator.clipboard.writeText(url);notify('Enlace copiado.');return;
   }
   if(action==='teacher-qr'){
    const slot=$('qr-'+id);slot.replaceChildren();
    if(typeof QRCode==='undefined'){slot.textContent='No se pudo generar el QR. Utiliza el enlace.';return}
    new QRCode(slot,{text:url,width:200,height:200,colorDark:'#8b6527',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H});
    return;
   }
   if(action==='teacher-edit'){openTeacherEditor(t);return}
   if(action==='teacher-toggle'){
    if(!confirm('¿Cambiar el estado de la profesora '+t.display_name+'?'))return;
    await privateRequest('teachers?id=eq.'+encodeURIComponent(id),
     {method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({active:!t.active})});
    notify('Profesora actualizada.');await reload();
   }
   if(action==='teacher-delete'){
    if(!confirm('¿Eliminar definitivamente a '+t.display_name+'? Si tiene registros, debes desactivarla.'))return;
    await privateRequest('teachers?id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:{Prefer:'return=minimal'}});
    notify('Profesora eliminada.');await reload();
   }
  }
 }catch(err){alertError(err)}
});
$('export-students').addEventListener('click',async()=>{
 const btn=$('export-students');btn.disabled=true;btn.textContent='Preparando archivo…';
 try{
  const rows=[];
  for(let offset=0;offset<50000;offset+=1000){
   const page=await privateRequest('students?select=full_name,phone,teacher_id,status,consented_at,social_follow_declared_at,created_at&order=created_at.desc&limit=1000&offset='+offset);
   rows.push(...page);if(page.length<1000)break;
  }
  const columns=['Nombre','Celular','Profesora','Estado','Fecha de autorización','Confirmación declarada de redes','Fecha de registro'];
  const csvField=value=>{let s=String(value??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
  const lines=[columns,...rows.map(s=>[s.full_name,s.phone,teacherName(s.teacher_id),s.status,s.consented_at,s.social_follow_declared_at,s.created_at])]
   .map(row=>row.map(csvField).join(';')).join('\r\n');
  const blob=new Blob(['\ufeff'+lines],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='Master_Viviana_Estudiantes_'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
  notify(rows.length+' estudiantes exportadas. Protege este archivo: contiene información personal.');
 }catch(err){alertError(err)}
 finally{btn.disabled=false;btn.textContent='Descargar estudiantes (CSV)'}
});
initialize();
