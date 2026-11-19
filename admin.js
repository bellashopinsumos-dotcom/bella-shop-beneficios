import {ready,privateRequest,signIn,session,logout,normalizePhone,escapeHtml,showNotice} from './api.js';
const $=id=>document.getElementById(id);
let teachers=[],benefits=[];
const e=(x)=>escapeHtml(x);
const active=b=>b.active&&new Date(b.starts_at)<=new Date()&&new Date(b.ends_at)>=new Date();
const teacherName=id=>teachers.find(t=>t.id===id)?.display_name||'Sin profesora';
function notify(message,type=''){showNotice($('admin-notice'),message,type)}
function view(authed){$('login-view').classList.toggle('hidden',authed);$('dashboard').classList.toggle('hidden',!authed);$('logout').classList.toggle('hidden',!authed)}
async function authorize(){let rows=await privateRequest('admins?select=user_id,enabled&enabled=eq.true&limit=1');if(!rows?.length){logout();throw Error('Tu usuario no está autorizado para administrar BellaShop Beneficios.')}}
async function initialize(){
 if(!ready()){showNotice($('login-notice'),'Falta configurar el nuevo proyecto Supabase en config.js.','warning');$('login-button').disabled=true;return}
 if(!session())return;
 try{await authorize();view(true);await reload()}catch(err){view(false);showNotice($('login-notice'),err.message,'error')}
}
$('login-form').addEventListener('submit',async ev=>{
 ev.preventDefault();const b=$('login-button');b.disabled=true;
 try{await signIn($('email').value.trim(),$('password').value);await authorize();$('password').value='';view(true);await reload()}
 catch(err){logout();showNotice($('login-notice'),err.message,'error')}
 finally{b.disabled=false}
});
$('logout').addEventListener('click',()=>{logout();view(false)});
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
 document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));
 ['students','benefits','teachers'].forEach(tab=>$('tab-'+tab).classList.toggle('hidden',b.dataset.tab!==tab));
}));
async function reload(){
 try{
  teachers=await privateRequest('teachers?select=id,display_name,slug,active&order=display_name.asc');
  benefits=await privateRequest('benefits?select=*&order=created_at.desc&limit=100');
  renderBenefits();renderTeachers();await Promise.all([counts(),recents()]);
 }catch(err){notify('No se pudieron cargar los datos: '+err.message,'error')}
}
async function counts(){
 const [total,enabled]=await Promise.all([
  privateRequest('students?select=id',{method:'HEAD',headers:{Prefer:'count=exact'},countOnly:true}),
  privateRequest('students?select=id&status=eq.active',{method:'HEAD',headers:{Prefer:'count=exact'},countOnly:true})
 ]);
 $('total-students').textContent=total.toLocaleString('es-CO');
 $('active-students').textContent=enabled.toLocaleString('es-CO');
 $('active-benefits').textContent=benefits.filter(active).length;
}
async function recents(){
 const rows=await privateRequest('students?select=id,full_name,phone,teacher_id,status,created_at&order=created_at.desc&limit=12');
 $('recent-students').innerHTML=rows.length?
 '<table class="data-table"><thead><tr><th>Nombre</th><th>Celular</th><th>Profesora</th><th>Estado</th><th>Registro</th></tr></thead><tbody>'+
 rows.map(s=>'<tr><td>'+e(s.full_name)+'</td><td>'+e(s.phone)+'</td><td>'+e(teacherName(s.teacher_id))+'</td><td>'+e(s.status)+'</td><td>'+new Date(s.created_at).toLocaleDateString('es-CO')+'</td></tr>').join('')+
 '</tbody></table>':'Aún no hay estudiantes registradas.';
}
$('search-form').addEventListener('submit',async ev=>{
 ev.preventDefault();
 const phone=normalizePhone($('search-phone').value),node=$('search-results');
 if(!phone){node.textContent='Ingresa un celular colombiano válido.';return}
 node.textContent='Buscando...';
 try{
  const rows=await privateRequest('students?select=*&phone=eq.'+encodeURIComponent(phone)+'&limit=1');
  if(!rows?.length){node.textContent='No encontramos estudiantes con ese celular.';return}
  const s=rows[0],list=s.status==='active'?benefits.filter(b=>b.teacher_id===s.teacher_id&&active(b)):[];
  const fields=[['Nombre',s.full_name],['Celular',s.phone],['Profesora',teacherName(s.teacher_id)],['Estado',s.status==='active'?'Activa':'Suspendida'],['Fecha de registro',new Date(s.created_at).toLocaleDateString('es-CO')],['Beneficios vigentes',String(list.length)]];
  node.innerHTML='<div class="student-detail">'+fields.map(([k,v])=>'<div><span>'+e(k)+'</span><b>'+e(v)+'</b></div>').join('')+'</div>'+
  (list.length?list.map(b=>'<div class="benefit-card"><b>'+e(b.title)+' · '+Number(b.percent_off)+'%</b><p class="benefit-meta">Válido hasta '+new Date(b.ends_at).toLocaleDateString('es-CO')+'</p><p class="benefit-meta">Códigos exactos: '+(b.product_codes||[]).map(e).join(', ')+'</p><p class="benefit-meta">'+e(b.terms||'Aplican condiciones en tienda.')+'</p></div>').join(''):'<p class="benefit-meta">Sin descuentos vigentes para esta estudiante.</p>')+
  '<button type="button" id="toggle-student" class="tiny-button">'+(s.status==='active'?'Suspender':'Reactivar')+'</button>';
  $('toggle-student').addEventListener('click',async()=>{
   if(!confirm('¿Confirmas el cambio de estado de esta estudiante?'))return;
   try{
    await privateRequest('students?id=eq.'+encodeURIComponent(s.id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:s.status==='active'?'suspended':'active'})});
    notify('Estado actualizado.');$('search-form').requestSubmit();await Promise.all([counts(),recents()]);
   }catch(err){notify(err.message,'error')}
  });
 }catch(err){node.textContent='Error al consultar: '+err.message}
});
function renderBenefits(){
 $('benefit-teacher').innerHTML=teachers.filter(t=>t.active).map(t=>'<option value="'+e(t.id)+'">'+e(t.display_name)+'</option>').join('');
 $('benefit-list').innerHTML=benefits.length?benefits.map(b=>
  '<article class="benefit-card"><div class="card-head"><h3>'+e(b.title)+' <span class="chip">'+Number(b.percent_off)+'%</span></h3><span class="status '+(active(b)?'':'off')+'">'+(active(b)?'Vigente':b.active?'Fuera de fecha':'Desactivado')+'</span></div><p class="benefit-meta">'+e(teacherName(b.teacher_id))+' · Hasta '+new Date(b.ends_at).toLocaleDateString('es-CO')+'</p><p class="benefit-meta">Productos: '+(b.product_codes||[]).map(e).join(', ')+'</p><p class="benefit-meta">'+e(b.terms)+'</p><button class="tiny-button toggle-benefit" data-id="'+e(b.id)+'" data-active="'+String(b.active)+'">'+(b.active?'Desactivar':'Activar')+'</button></article>'
 ).join(''):'No hay beneficios creados.';
 document.querySelectorAll('.toggle-benefit').forEach(btn=>btn.addEventListener('click',async()=>{
  try{
   await privateRequest('benefits?id=eq.'+encodeURIComponent(btn.dataset.id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({active:btn.dataset.active!=='true'})});
   notify('Beneficio actualizado.');await reload();
  }catch(err){notify(err.message,'error')}
 }));
}
$('benefit-form').addEventListener('submit',async ev=>{
 ev.preventDefault();
 const codes=[...new Set($('benefit-codes').value.split(/[,;\n]/).map(x=>x.trim().toUpperCase()).filter(Boolean))];
 const percent=Number($('benefit-percent').value),end=$('benefit-end').value;
 if(!codes.length||percent<=0||percent>100||!end){notify('Revisa códigos, porcentaje y vigencia.','error');return}
 const endsAt=new Date(end+'T23:59:59-05:00');
 if(endsAt<=new Date()){notify('Elige una fecha futura.','error');return}
 try{
  await privateRequest('benefits',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({
   teacher_id:$('benefit-teacher').value,title:$('benefit-title').value.trim(),
   percent_off:percent,product_codes:codes,ends_at:endsAt.toISOString(),
   terms:$('benefit-terms').value.trim(),active:true
  })});
  $('benefit-form').reset();notify('Beneficio creado.');await reload();
 }catch(err){notify(err.message,'error')}
});
function renderTeachers(){
 $('teacher-list').innerHTML=teachers.map(t=>{
  const url=new URL('index.html?profe='+encodeURIComponent(t.slug),location.href).href;
  return '<article class="teacher-card"><div class="card-head"><h3>'+e(t.display_name)+'</h3><span class="status '+(t.active?'':'off')+'">'+(t.active?'Activa':'Inactiva')+'</span></div><p class="benefit-meta">Enlace QR para estudiantes</p><div class="teacher-link">'+e(url)+'</div><div class="teacher-tools"><button type="button" class="tiny-button copy-link" data-url="'+e(url)+'">Copiar enlace</button><button type="button" class="tiny-button generate-qr" data-id="'+e(t.id)+'" data-url="'+e(url)+'">Ver QR</button></div><div class="qr-holder" id="qr-'+e(t.id)+'"></div></article>';
 }).join('');
 document.querySelectorAll('.copy-link').forEach(b=>b.addEventListener('click',()=>{
  navigator.clipboard.writeText(b.dataset.url).then(()=>notify('Enlace copiado.')).catch(()=>notify('No se pudo copiar el enlace.','error'));
 }));
 document.querySelectorAll('.generate-qr').forEach(b=>b.addEventListener('click',()=>{
  const slot=$('qr-'+b.dataset.id);slot.replaceChildren();
  if(typeof QRCode==='undefined'){slot.textContent='No se pudo generar el QR, utiliza el enlace de arriba.';return}
  new QRCode(slot,{text:b.dataset.url,width:200,height:200,colorDark:'#8b6527',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H});
 }));
}
initialize();