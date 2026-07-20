import { db } from '../core/firebase.js';
import { state } from '../core/state.js';
import { esc, initials, fmtDate, isOverdue } from '../core/utils.js';
import { COLORS } from '../core/constants.js';

export function renderKpiPage(){
  const wrap = document.getElementById('kpi-page-content');
  if(!wrap)return;
  if(!state.isAdmin){wrap.innerHTML='<div class="empty"><div class="ei">🚫</div><p>غير مصرح</p></div>';return;}

  // Aggregate by employee
  const empStats = state.allUserProfiles.filter(u=>u.uid!==state.currentUser.uid).map(u=>{
    const myTasks = state.assignedTasks.filter(t=>t.assignedToUid===u.uid);
    const done  = myTasks.filter(t=>t.status==='done').length;
    const wip   = myTasks.filter(t=>t.status==='wip').length;
    const over  = myTasks.filter(t=>isOverdue(t)).length;
    const total = myTasks.length;
    const pct   = total?Math.round(done/total*100):0;
    const color = u.color||COLORS[0];
    return{u,myTasks,done,wip,over,total,pct,color};
  }).sort((a,b)=>b.pct-a.pct);

  const totTasks = state.assignedTasks.length;
  const totDone  = state.assignedTasks.filter(t=>t.status==='done').length;
  const totOver  = state.assignedTasks.filter(t=>isOverdue(t)).length;
  const totWip   = state.assignedTasks.filter(t=>t.status==='wip').length;

  let html = `
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
    <div style="font-size:.85rem;color:var(--muted)">مؤشرات أداء ${empStats.length} موظف</div>
    <button class="btn btn-primary" onclick="openAssignModal()">📌 إسناد مهمة جديدة</button>
  </div>
  <div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-num">${totTasks}</div><div class="kpi-label">إجمالي المهام المُسندة</div></div>
    <div class="kpi-card"><div class="kpi-num" style="color:var(--done)">${totDone}</div><div class="kpi-label">منتهية</div>
      <div class="kpi-bar-wrap"><div class="prog-track" style="margin-top:6px"><div class="prog-fill" style="width:${totTasks?Math.round(totDone/totTasks*100):0}%;background:var(--done)"></div></div></div>
    </div>
    <div class="kpi-card"><div class="kpi-num" style="color:var(--wip)">${totWip}</div><div class="kpi-label">قيد التنفيذ</div></div>
    <div class="kpi-card"><div class="kpi-num" style="color:var(--cancel)">${totOver}</div><div class="kpi-label">متأخرة ⚠️</div></div>
  </div>`;

  if(!empStats.length){
    html += `<div class="empty"><div class="ei">👥</div><p>لا يوجد موظفون مسجلون</p></div>`;
  } else {
    html += empStats.map(({u,myTasks,done,wip,over,total,pct,color})=>`
    <div class="emp-kpi-row" onclick="toggleEmpTasks('${u.uid}')">
      <div class="emp-kpi-top">
        <div style="width:42px;height:42px;border-radius:12px;background:${color};display:flex;align-items:center;justify-content:center;font-size:.95rem;font-weight:700;color:#fff;flex-shrink:0;position:relative">
          ${initials(u.displayName||u.email)}
          <div style="position:absolute;bottom:-2px;right:-2px;width:12px;height:12px;border-radius:50%;border:2px solid var(--s1);background:${u.isOnline?'var(--done)':'var(--muted)'}"></div>
        </div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:.92rem">${esc(u.displayName||u.email)}</div>
          <div style="font-size:.72rem;color:var(--muted)">${u.email}</div>
        </div>
        <div style="text-align:left">
          <div style="font-size:1.4rem;font-weight:900;color:${pct>=80?'var(--done)':pct>=50?'var(--wip)':'var(--cancel)'}">${pct}%</div>
          <div style="font-size:.65rem;color:var(--muted)">الإنجاز</div>
        </div>
      </div>
      <div class="emp-kpi-stats">
        <div class="emp-kpi-stat"><div class="n">${total}</div><div class="l">مهام</div></div>
        <div class="emp-kpi-stat"><div class="n" style="color:var(--done)">${done}</div><div class="l">منتهية</div></div>
        <div class="emp-kpi-stat"><div class="n" style="color:var(--wip)">${wip}</div><div class="l">تنفيذ</div></div>
        <div class="emp-kpi-stat"><div class="n" style="color:var(--cancel)">${over}</div><div class="l">متأخرة</div></div>
      </div>
      <div style="margin-top:10px">
        <div class="prog-track"><div class="prog-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>
      <div id="emp-tasks-${u.uid}" style="display:none;margin-top:12px">
        ${myTasks.length?myTasks.map(t=>{
          const sL={pending:'معلّقة',wip:'قيد التنفيذ',done:'منتهية',cancelled:'ملغية'};
          const dc=isOverdue(t)?'task-date overdue':'task-date';
          const dl=t.due?`${isOverdue(t)?'⚠️ ':'📅 '}${fmtDate(t.due)}`:'';          return `<div style="background:var(--s2);border:1px solid var(--border);border-radius:9px;padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px">
            <span class="badge b-${t.status}" style="flex-shrink:0">${sL[t.status]}</span>
            <div style="flex:1;font-size:.83rem;font-weight:600">${esc(t.title)}</div>
            ${dl?`<span class="${dc}" style="font-size:.7rem">${dl}</span>`:''}
            <button class="icon-btn" onclick="event.stopPropagation();openAssignModal('${t.id}')">✏️</button>
          </div>`;}).join('')
        :'<div style="text-align:center;padding:14px;font-size:.78rem;color:var(--muted)">لا توجد مهام مُسندة لهذا الموظف</div>'}
        <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:6px" onclick="event.stopPropagation();openAssignModal()">+ إسناد مهمة جديدة</button>
        <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:6px" onclick="event.stopPropagation();viewEmployeePersonalTasks('${u.uid}','${esc(u.displayName||u.email)}')">👁 مهامه الشخصية</button>
      </div>
    </div>`).join('');
  }
  wrap.innerHTML = html;
}

export function toggleEmpTasks(uid){
  const el = document.getElementById('emp-tasks-'+uid);
  if(el) el.style.display = el.style.display==='none'?'block':'none';
}

export async function viewEmployeePersonalTasks(empUid, empName){
  const body = document.getElementById('emp-personal-tasks-body');
  const title = document.getElementById('emp-personal-tasks-title');
  if(!body) return;
  title.textContent = `📋 مهام ${empName} الشخصية`;
  body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:.85rem">جاري التحميل...</div>';
  document.getElementById('emp-personal-tasks-overlay').classList.add('open');
  try{
    const snap = await db.collection('users').doc(empUid).collection('tasks').orderBy('created','desc').get();
    const tasks = snap.docs.map(d=>({...d.data(),id:d.id}));
    if(!tasks.length){ body.innerHTML = '<div class="empty"><div class="ei">📭</div><p>لا توجد مهام شخصية لهذا الموظف</p></div>'; return; }
    const sL={pending:'معلّقة',wip:'قيد التنفيذ',done:'منتهية',cancelled:'ملغية'};
    body.innerHTML = tasks.map(t=>{
      const dc=isOverdue(t)?'task-date overdue':'task-date';
      const dl=t.due?`${isOverdue(t)?'⚠️ ':'📅 '}${fmtDate(t.due)}`:'';
      return `<div style="background:var(--s2);border:1px solid var(--border);border-radius:9px;padding:10px 12px;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span class="badge b-${t.status}">${sL[t.status]}</span>
          <span class="badge b-${t.priority}">${t.priority==='high'?'عالية':t.priority==='medium'?'متوسطة':'منخفضة'}</span>
          ${dl?`<span class="${dc}" style="font-size:.7rem">${dl}</span>`:''}
        </div>
        <div style="font-weight:700;font-size:.85rem">${esc(t.title)}</div>
        ${t.desc?`<div style="font-size:.75rem;color:var(--muted);margin-top:3px">${esc(t.desc)}</div>`:''}
      </div>`;
    }).join('');
  }catch(e){
    body.innerHTML = `<div class="empty"><div class="ei">🚫</div><p>تعذّر تحميل المهام</p><small>${esc(e.message)}</small></div>`;
  }
}

/* ══ MESSAGING SYSTEM ══ */

// غرف المحادثة الثابتة + دايركت ماسيج
