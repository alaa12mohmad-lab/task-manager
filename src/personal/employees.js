import { state } from '../core/state.js';
import { esc, initials, col, uid, isSuperAdmin } from '../core/utils.js';
import { COLORS } from '../core/constants.js';
import { toast, setSyncStatus } from '../ui/toast.js';
import { openModal, closeModal } from '../ui/modal.js';
import { goPage } from '../ui/navigation.js';

export function openEmpModal(id=null){
  if(!isSuperAdmin()){toast('ليس لديك صلاحية إدارة الموظفين','err');return;}
  state.editEmpId=id;document.getElementById('em-icon').textContent=id?'✏️':'👤';document.getElementById('em-title').textContent=id?'تعديل موظف':'إضافة موظف جديد';
  if(id){const e=state.emps.find(x=>x.id===id);document.getElementById('ef-name').value=e.name;document.getElementById('ef-role').value=e.role||'';document.getElementById('ef-dept').value=e.dept||'';document.getElementById('ef-email').value=e.email||'';state.selectedColor=e.color||COLORS[0];}
  else{['ef-name','ef-role','ef-dept','ef-email'].forEach(i=>document.getElementById(i).value='');state.selectedColor=COLORS[Math.floor(Math.random()*COLORS.length)];}
  buildColorRow();openModal('emp-overlay');setTimeout(()=>document.getElementById('ef-name').focus(),200);
}
export function buildColorRow(){document.getElementById('color-row').innerHTML=COLORS.map(c=>`<div class="color-opt ${c===state.selectedColor?'selected':''}" style="background:${c}" onclick="selectColor('${c}')"></div>`).join('');}
export function selectColor(c){state.selectedColor=c;buildColorRow();}
export async function saveEmp(){
  const name=document.getElementById('ef-name').value.trim();const role=document.getElementById('ef-role').value.trim();const dept=document.getElementById('ef-dept').value.trim();const email=document.getElementById('ef-email').value.trim();
  if(!name){toast('يرجى إدخال اسم الموظف','err');return;}
  const btn=document.getElementById('save-emp-btn');btn.disabled=true;btn.textContent='⏳ جاري الحفظ...';setSyncStatus('syncing');
  try{
    if(state.editEmpId){await col('employees').doc(state.editEmpId).update({name,role,dept,email,color:state.selectedColor});toast('تم تحديث بيانات الموظف ✓','ok');}
    else{const id=uid();await col('employees').doc(id).set({id,name,role,dept,email,color:state.selectedColor});toast('تمت إضافة الموظف ✓','ok');}
    closeModal('emp-overlay');
  }catch(e){toast('خطأ في الحفظ','err');setSyncStatus('error');}
  finally{btn.disabled=false;btn.innerHTML='💾 حفظ الموظف';}
}
export async function deleteEmp(id){
  if(!isSuperAdmin()){toast('ليس لديك صلاحية حذف الموظفين','err');return;}
  if(!confirm('حذف هذا الموظف نهائياً؟'))return;
  setSyncStatus('syncing');
  try{await col('employees').doc(id).delete();toast('تم حذف الموظف','inf');}
  catch(e){toast('خطأ في الحذف','err');setSyncStatus('error');}
}

export function renderEmps(){
  const g=document.getElementById('emp-grid');
  if(!state.emps.length){g.innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="ei">👥</div><p>لا يوجد موظفون</p><small>أضف موظفاً للبدء</small></div>`;return;}
  g.innerHTML=state.emps.map(e=>{const et=state.tasks.filter(t=>t.empId===e.id);const done=et.filter(t=>t.status==='done').length;const wip=et.filter(t=>t.status==='wip').length;const total=et.length;const pct=total?Math.round(done/total*100):0;return`<div class="emp-card"><div class="emp-card-top"><div class="emp-av-lg" style="background:${e.color}25;color:${e.color}">${initials(e.name)}</div><div><div class="emp-name">${esc(e.name)}</div><div class="emp-role">${esc(e.role||'—')}</div>${e.dept?`<div class="emp-dept"><span>${esc(e.dept)}</span></div>`:''}</div></div><div class="emp-stats"><div class="emp-stat"><div class="emp-stat-num">${total}</div><div class="emp-stat-lbl">مهام</div></div><div class="emp-stat"><div class="emp-stat-num" style="color:var(--done)">${done}</div><div class="emp-stat-lbl">منتهية</div></div><div class="emp-stat"><div class="emp-stat-num" style="color:var(--wip)">${wip}</div><div class="emp-stat-lbl">تنفيذ</div></div></div><div style="display:flex;justify-content:space-between;font-size:.72rem;margin-bottom:4px"><span style="color:var(--muted)">نسبة الإنجاز</span><span style="color:${e.color};font-weight:700">${pct}%</span></div><div class="prog-track"><div class="prog-fill" style="width:${pct}%;background:${e.color}"></div></div>${e.email?`<div style="font-size:.72rem;color:var(--muted);margin-top:8px">📧 ${esc(e.email)}</div>`:''}<div class="emp-actions">${isSuperAdmin()?`<button class="icon-btn" onclick="openEmpModal('${e.id}')">✏️</button><button class="icon-btn del" onclick="deleteEmp('${e.id}')">🗑</button>`:''}</div></div>`;}).join('');
}

export function populateEmpSelect(id){const sel=document.getElementById(id);const cur=sel.value;sel.innerHTML=`<option value="">— اختر موظفاً —</option>`+state.emps.map(e=>`<option value="${e.id}" ${cur===e.id?'selected':''}>${esc(e.name)}${e.role?' — '+esc(e.role):''}</option>`).join('');}
