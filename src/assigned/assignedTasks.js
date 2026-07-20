import { db } from '../core/firebase.js';
import { state } from '../core/state.js';
import { esc, initials, fmtDate, uid, isOverdue } from '../core/utils.js';
import { COLORS } from '../core/constants.js';
import { toast, setSyncStatus } from '../ui/toast.js';
import { openModal, closeModal } from '../ui/modal.js';
import { createNotif } from '../notifications/notifications.js';
import { openComments } from '../comments/comments.js';
import { renderKpiPage } from '../kpi/kpi.js';
import { renderDash } from '../personal/dashboard.js';
import { logTaskCompletion } from '../history/history.js';

export function startAssignedTasksListener(){
  if(state.unsubAssigned){state.unsubAssigned();state.unsubAssigned=null;}
  if(!state.currentUser)return;
  if(state.isAdmin){
    state.unsubAssigned = db.collection('assignedTasks').orderBy('createdAt','desc').onSnapshot(snap=>{
      state.assignedTasks = snap.docs.map(d=>({...d.data(),id:d.id}));
      updateAssignedBadgeAndRerender();
    }, err=>console.warn('assignedTasks listener:',err));
  } else {
    // الموظف العادي: يشوف بس المهام المُسندة إليه أو التي أنشأها هو
    let byAssignedTo={}, byAssignedBy={};
    const rerender=()=>{
      const merged={...byAssignedTo,...byAssignedBy};
      state.assignedTasks=Object.values(merged).sort((a,b)=>b.createdAt-a.createdAt);
      updateAssignedBadgeAndRerender();
    };
    const unsub1=db.collection('assignedTasks').where('assignedToUid','==',state.currentUser.uid).onSnapshot(snap=>{
      byAssignedTo={};snap.docs.forEach(d=>byAssignedTo[d.id]={...d.data(),id:d.id});
      rerender();
    }, err=>console.warn('assignedTasks (to) listener:',err));
    const unsub2=db.collection('assignedTasks').where('assignedByUid','==',state.currentUser.uid).onSnapshot(snap=>{
      byAssignedBy={};snap.docs.forEach(d=>byAssignedBy[d.id]={...d.data(),id:d.id});
      rerender();
    }, err=>console.warn('assignedTasks (by) listener:',err));
    state.unsubAssigned=()=>{unsub1();unsub2();};
  }
}

function updateAssignedBadgeAndRerender(){
  const myPending = state.assignedTasks.filter(t=>t.assignedToUid===state.currentUser.uid&&t.status!=='done'&&t.status!=='cancelled').length;
  const nb = document.getElementById('nb-assigned');
  if(nb) nb.textContent = state.isAdmin ? state.assignedTasks.length : myPending;
  if(state.currentPage==='assigned') renderAssignedPage();
  if(state.currentPage==='kpi') renderKpiPage();
  if(state.currentPage==='dash' && state.isAdmin) renderDash();
}

/* ══ OPEN/SAVE ASSIGNED TASK MODAL ══ */
export function openAssignModal(id=null){
  if(!state.isAdmin){toast('ليس لديك صلاحية إسناد مهام','err');return;}
  state.editAssignedId = id;
  // Populate employees
  const sel = document.getElementById('at-employee');
  sel.innerHTML = '<option value="">— اختر موظفاً —</option>' +
    state.allUserProfiles.filter(u=>u.uid!==state.currentUser.uid)
      .map(u=>`<option value="${u.uid}">${esc(u.displayName||u.email)}</option>`).join('');
  if(id){
    const t = state.assignedTasks.find(x=>x.id===id);
    document.getElementById('at-icon').textContent = '✏️';
    document.getElementById('at-title').textContent = 'تعديل مهمة مُسندة';
    document.getElementById('at-title-input').value = t.title;
    document.getElementById('at-desc').value = t.desc||'';
    document.getElementById('at-employee').value = t.assignedToUid||'';
    document.getElementById('at-cat').value = t.cat||'';
    document.getElementById('at-priority').value = t.priority;
    document.getElementById('at-due').value = t.due||'';
    document.getElementById('at-status').value = t.status;
    document.getElementById('at-notes').value = t.notes||'';
  } else {
    document.getElementById('at-icon').textContent = '📌';
    document.getElementById('at-title').textContent = 'إسناد مهمة لموظف';
    ['at-title-input','at-desc','at-cat','at-notes'].forEach(i=>document.getElementById(i).value='');
    document.getElementById('at-employee').value='';
    document.getElementById('at-priority').value='medium';
    document.getElementById('at-due').value='';
    document.getElementById('at-status').value='pending';
  }
  openModal('assign-overlay');
  setTimeout(()=>document.getElementById('at-title-input').focus(),200);
}

export async function saveAssignedTask(){
  const title    = document.getElementById('at-title-input').value.trim();
  const desc     = document.getElementById('at-desc').value.trim();
  const empUid   = document.getElementById('at-employee').value;
  const cat      = document.getElementById('at-cat').value.trim();
  const priority = document.getElementById('at-priority').value;
  const due      = document.getElementById('at-due').value;
  const status   = document.getElementById('at-status').value;
  const notes    = document.getElementById('at-notes').value.trim();
  if(!title){toast('يرجى إدخال عنوان المهمة','err');return;}
  if(!empUid){toast('يرجى اختيار الموظف','err');return;}
  const empProfile = state.allUserProfiles.find(u=>u.uid===empUid);
  const btn = document.getElementById('at-save-btn');
  btn.disabled=true; btn.textContent='⏳ جاري الإسناد...';
  setSyncStatus('syncing');
  try{
    if(state.editAssignedId){
      const prev = state.assignedTasks.find(t=>t.id===state.editAssignedId);
      await db.collection('assignedTasks').doc(state.editAssignedId).update({
        title,desc,assignedToUid:empUid,
        assignedToName:empProfile?.displayName||empProfile?.email||'',
        cat,priority,due,status,notes,
        updatedAt:Date.now()
      });
      // إشعار إذا تغيّر الموظف
      if(empUid!==prev?.assignedToUid){
        await createNotif(empUid,{type:'task_assigned',
          title:'📌 مهمة جديدة مُسندة إليك',
          body:`"${title}"${due?' — الموعد: '+fmtDate(due):''}`,link:{}});
      }
      toast('تم تحديث المهمة ✓','ok');
    } else {
      const id = uid();
      await db.collection('assignedTasks').doc(id).set({
        id,title,desc,
        assignedToUid:empUid,
        assignedToName:empProfile?.displayName||empProfile?.email||'',
        assignedByUid:state.currentUser.uid,
        assignedByName:state.currentUser.displayName||state.currentUser.email,
        cat,priority,due,status,notes,
        createdAt:Date.now()
      });
      // إشعار فوري للموظف
      await createNotif(empUid,{type:'task_assigned',
        title:'📌 مهمة جديدة مُسندة إليك',
        body:`"${title}"${due?' — الموعد: '+fmtDate(due):''}`,link:{}});
      toast(`تم إسناد المهمة لـ ${empProfile?.displayName||empProfile?.email} ✓`,'ok');
    }
    closeModal('assign-overlay');
    setSyncStatus('synced');
  }catch(e){
    toast('خطأ في الحفظ: '+e.message,'err');
    setSyncStatus('error');
  }finally{
    btn.disabled=false;btn.innerHTML='📌 إسناد المهمة';
  }
}

export async function deleteAssignedTask(id){
  if(!state.isAdmin){toast('غير مصرح','err');return;}
  if(!confirm('حذف هذه المهمة نهائياً؟'))return;
  setSyncStatus('syncing');
  try{await db.collection('assignedTasks').doc(id).delete();toast('تم الحذف','inf');setSyncStatus('synced');}
  catch(e){toast('خطأ','err');setSyncStatus('error');}
}

export async function toggleAssignedStatus(id){
  const t = state.assignedTasks.find(x=>x.id===id);
  if(!t)return;
  // الموظف يقدر يغيّر حالة مهامه فقط
  if(!state.isAdmin && t.assignedToUid!==state.currentUser.uid){toast('ليس لديك صلاحية','err');return;}
  const cycle={pending:'wip',wip:'done',done:'pending',cancelled:'pending'};
  const newStatus = cycle[t.status];
  const statusAr={pending:'معلّقة',wip:'قيد التنفيذ',done:'منتهية',cancelled:'ملغية'};
  setSyncStatus('syncing');
  try{
    await db.collection('assignedTasks').doc(id).update({status:newStatus,updatedAt:Date.now()});
    if(newStatus==='done'){
      logTaskCompletion({
        taskId:id,taskTitle:t.title,sourceType:'assigned',
        employeeUid:t.assignedToUid,employeeName:t.assignedToName
      });
    }
    // إشعار المدير لو الموظف غيّر الحالة
    if(!state.isAdmin && t.assignedByUid && t.assignedByUid!==state.currentUser.uid){
      await createNotif(t.assignedByUid,{type:'task_status',
        title:`🔄 ${state.currentUser.displayName||state.currentUser.email} حدّث مهمة`,
        body:`"${t.title}" → ${statusAr[newStatus]}`,link:{}});
    }
    setSyncStatus('synced');
  }catch(e){setSyncStatus('error');}
}

/* ══ RENDER ASSIGNED TASKS PAGE ══ */
export function filterAssignedByEmployee(uid){
  state.assignedPageEmployeeFilter=uid||null;
  renderAssignedPage();
}

export function renderAssignedPage(){
  const wrap = document.getElementById('assigned-page-content');
  if(!wrap)return;
  const sL={pending:'معلّقة',wip:'قيد التنفيذ',done:'منتهية',cancelled:'ملغية'};
  const pL={high:'عالية',medium:'متوسطة',low:'منخفضة'};

  if(state.isAdmin){
    // المدير: يرى كل الموظفين وما عليهم (أو موظف واحد بس لو اختار فلتر)
    const byEmp = {};
    state.assignedTasks.forEach(t=>{
      if(!byEmp[t.assignedToUid]) byEmp[t.assignedToUid]={name:t.assignedToName,tasks:[]};
      byEmp[t.assignedToUid].tasks.push(t);
    });
    let empUids = Object.keys(byEmp);
    if(state.assignedPageEmployeeFilter){
      empUids = empUids.filter(uid=>uid===state.assignedPageEmployeeFilter);
    }
    const filterOptions=state.allUserProfiles.filter(u=>u.uid!==state.currentUser.uid);
    const filterBar=`<div style="margin-bottom:14px">
      <select class="fselect" onchange="filterAssignedByEmployee(this.value)" style="width:100%;max-width:280px">
        <option value="">👥 كل الموظفين</option>
        ${filterOptions.map(u=>`<option value="${u.uid}" ${state.assignedPageEmployeeFilter===u.uid?'selected':''}>${esc(u.displayName||u.email)}</option>`).join('')}
      </select>
    </div>`;
    let html = filterBar+`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-size:.85rem;color:var(--muted)">${state.assignedTasks.length} مهمة مسندة لـ ${Object.keys(byEmp).length} موظف</div>
      <button class="btn btn-primary" onclick="openAssignModal()">📌 إسناد مهمة جديدة</button>
    </div>`;
    if(!empUids.length){
      html += state.assignedPageEmployeeFilter
        ?`<div class="empty"><div class="ei">📭</div><p>لا توجد مهام مُسندة لهذا الموظف</p></div>`
        :`<div class="empty"><div class="ei">📌</div><p>لا توجد مهام مُسندة بعد</p><small>أسند مهمة لأحد الموظفين</small></div>`;
    } else {
      html += empUids.map(uid=>{
        const g = byEmp[uid];
        const done = g.tasks.filter(t=>t.status==='done').length;
        const pct  = Math.round(done/g.tasks.length*100);
        const emp  = state.allUserProfiles.find(u=>u.uid===uid);
        const color= emp?.color||COLORS[0];
        return `<div style="margin-bottom:20px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;padding:10px 14px;background:var(--s1);border:1px solid var(--border);border-radius:var(--r)">
            <div style="width:36px;height:36px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;color:#fff">${initials(g.name)}</div>
            <div style="flex:1"><div style="font-weight:700;font-size:.9rem">${esc(g.name)}</div>
            <div style="font-size:.7rem;color:var(--muted)">${g.tasks.length} مهمة • ${done} منتهية</div></div>
            <span style="font-size:.8rem;font-weight:900;color:${color}">${pct}%</span>
          </div>
          ${g.tasks.map(t=>renderAssignedCard(t,sL,pL,true)).join('')}
        </div>`;
      }).join('');
    }
    wrap.innerHTML = html;
  } else {
    // الموظف: يرى فقط مهامه
    let html = `<div style="font-size:.85rem;color:var(--muted);margin-bottom:16px">المهام المُسندة إليك: ${state.assignedTasks.length}</div>`;
    if(!state.assignedTasks.length){
      html += `<div class="empty"><div class="ei">📌</div><p>لا توجد مهام مُسندة إليك</p><small>ستظهر هنا مهامك التي يسندها لك المدير</small></div>`;
    } else {
      html += state.assignedTasks.map(t=>renderAssignedCard(t,sL,pL,false)).join('');
    }
    wrap.innerHTML = html;
  }
}

export function renderAssignedCard(t,sL,pL,isManagerView){
  const ck=t.status==='done'?'✓':t.status==='cancelled'?'✕':t.status==='wip'?'►':'';
  const dc=isOverdue(t)?'task-date overdue':'task-date';
  const dl=t.due?`${isOverdue(t)?'⚠️ ':'📅 '}${fmtDate(t.due)}`:'';
  const byProfile = state.allUserProfiles.find(u=>u.uid===t.assignedByUid);
  const byColor   = byProfile?.color||COLORS[1];
  return `<div class="assigned-task-card" data-s="${t.status}">
    <div class="task-check" onclick="toggleAssignedStatus('${t.id}')" style="width:22px;height:22px;border-radius:7px;border:2px solid var(--border2);cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.7rem;color:var(--text)">${ck}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:.9rem;font-weight:700;${t.status==='done'?'text-decoration:line-through;opacity:.45':''}">${esc(t.title)}</div>
      ${t.desc?`<div style="font-size:.74rem;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.desc)}</div>`:''}
      <div style="display:flex;align-items:center;gap:7px;margin-top:5px;flex-wrap:wrap">
        <span class="badge b-${t.status}">${sL[t.status]}</span>
        <span class="badge b-${t.priority}">${pL[t.priority]}</span>
        ${dl?`<span class="${dc}">${dl}</span>`:''}
        ${t.cat?`<span style="font-size:.7rem;color:var(--muted)">🏷 ${esc(t.cat)}</span>`:''}
        ${!isManagerView?`<span style="font-size:.68rem;color:${byColor}">من: ${esc(t.assignedByName)}</span>`:''}
      </div>
      ${t.notes?`<div style="font-size:.7rem;color:var(--accent);margin-top:3px">💡 ${esc(t.notes)}</div>`:''}
    </div>
    <div class="task-actions">
      <button class="icon-btn" title="تعليقات" onclick="openComments('${t.id}','__assigned__','${esc(t.title).slice(0,40)}')">💬</button>
      ${state.isAdmin?`<button class="icon-btn" onclick="openAssignModal('${t.id}')">✏️</button>
      <button class="icon-btn del" onclick="deleteAssignedTask('${t.id}')">🗑</button>`:''}
    </div>
  </div>`;
}

/* ══ KPI / EMPLOYEE MONITORING PAGE ══ */
