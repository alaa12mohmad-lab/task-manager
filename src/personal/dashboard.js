import { state } from '../core/state.js';
import { esc, initials, empById, isOverdue, todayStr } from '../core/utils.js';
import { statusLabels } from '../core/constants.js';
import { renderTasks } from './tasks.js';
import { renderEmps } from './employees.js';
import { renderCal } from './calendar.js';
import { renderStepsModal } from '../steps/steps.js';

const _today = new Date();

export function renderDash(){
  if(state.isAdmin){ renderAdminDash(); return; }

  const cnt={all:state.tasks.length,wip:0,done:0,pending:0,cancelled:0,overdue:0};state.tasks.forEach(t=>{cnt[t.status]++;if(isOverdue(t))cnt.overdue++;});
  document.getElementById('ds-all').textContent=cnt.all;document.getElementById('ds-wip').textContent=cnt.wip;document.getElementById('ds-done').textContent=cnt.done;document.getElementById('ds-overdue').textContent=cnt.overdue;
  const pct=s=>cnt.all?Math.round(cnt[s]/cnt.all*100):0;
  document.getElementById('dash-prog').innerHTML=[{label:'معلّقة',val:cnt.pending,pct:pct('pending'),color:'var(--pending)'},{label:'قيد التنفيذ',val:cnt.wip,pct:pct('wip'),color:'var(--wip)'},{label:'منتهية',val:cnt.done,pct:pct('done'),color:'var(--done)'},{label:'ملغية',val:cnt.cancelled,pct:pct('cancelled'),color:'var(--cancel)'}].map(b=>`<div class="prog-item"><div class="prog-label"><span>${b.label}</span><span>${b.val} (${b.pct}%)</span></div><div class="prog-track"><div class="prog-fill" style="width:${b.pct}%;background:${b.color}"></div></div></div>`).join('');
  const es=state.emps.map(e=>{const et=state.tasks.filter(t=>t.empId===e.id);return{e,done:et.filter(t=>t.status==='done').length,total:et.length};}).sort((a,b)=>b.done-a.done).slice(0,5);
  document.getElementById('dash-leaders').innerHTML=es.length?es.map((x,i)=>`<div class="leader-item"><span class="leader-rank">${i+1}</span><div class="leader-av" style="background:${x.e.color}">${initials(x.e.name)}</div><div class="leader-info"><div class="leader-name">${esc(x.e.name)}</div><div class="leader-tasks">${x.total} مهمة</div></div><span class="leader-done">${x.done} ✓</span></div>`).join(''):`<div class="empty" style="padding:20px"><div class="ei" style="font-size:1.5rem">👥</div><p style="font-size:.8rem">لا يوجد موظفون</p></div>`;
  const rec=[...state.tasks].sort((a,b)=>b.created-a.created).slice(0,5);
  document.getElementById('dash-recent').innerHTML=rec.length?rec.map(t=>{const emp=empById(t.empId);return`<div class="leader-item">${emp?`<div style="width:26px;height:26px;border-radius:50%;background:${emp.color};display:flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:700;color:#fff;flex-shrink:0">${initials(emp.name)}</div>`:`<div style="width:26px;height:26px;border-radius:50%;background:var(--s3);display:flex;align-items:center;justify-content:center;color:var(--muted)">؟</div>`}<div class="leader-info"><div class="leader-name" style="font-size:.8rem">${esc(t.title)}</div>${emp?`<div class="leader-tasks">${esc(emp.name)}</div>`:''}</div><span class="badge b-${t.status}" style="font-size:.65rem">${statusLabels[t.status]}</span></div>`;}).join(''):`<div class="empty" style="padding:20px"><div class="ei" style="font-size:1.5rem">📭</div><p style="font-size:.8rem">لا توجد مهام</p></div>`;
  const soon=state.tasks.filter(t=>t.due&&t.due>=todayStr()&&t.status!=='done'&&t.status!=='cancelled').sort((a,b)=>a.due<b.due?-1:1).slice(0,5);
  document.getElementById('dash-upcoming').innerHTML=soon.length?soon.map(t=>{const emp=empById(t.empId);const dl=Math.ceil((new Date(t.due)-_today)/(1000*86400));return`<div class="leader-item"><div style="width:42px;text-align:center;flex-shrink:0"><div style="font-size:.8rem;font-weight:900;color:${dl<=2?'var(--cancel)':'var(--text)'}">${dl}</div><div style="font-size:.62rem;color:var(--muted)">يوم</div></div><div class="leader-info"><div class="leader-name" style="font-size:.8rem">${esc(t.title)}</div>${emp?`<div class="leader-tasks">${esc(emp.name)}</div>`:`<div class="leader-tasks" style="color:var(--muted)">غير محدد</div>`}</div><span class="badge b-${t.status}" style="font-size:.65rem">${statusLabels[t.status]}</span></div>`;}).join(''):`<div class="empty" style="padding:20px"><div class="ei" style="font-size:1.5rem">🎉</div><p style="font-size:.8rem">لا توجد مهام قادمة</p></div>`;
}

// المدير/مدير النظام: الداشبورد يعرض بيانات النظام كله (كل الموظفين عن طريق نظام "المهام المُسندة")
// بدل قائمته الشخصية الفاضية أصلاً — لأنه مش بيستخدم نظام المهام الشخصية زي موظف عادي
function renderAdminDash(){
  const tasks = state.assignedTasks;
  const cnt={all:tasks.length,wip:0,done:0,pending:0,cancelled:0,overdue:0};tasks.forEach(t=>{cnt[t.status]++;if(isOverdue(t))cnt.overdue++;});
  document.getElementById('ds-all').textContent=cnt.all;document.getElementById('ds-wip').textContent=cnt.wip;document.getElementById('ds-done').textContent=cnt.done;document.getElementById('ds-overdue').textContent=cnt.overdue;
  const pct=s=>cnt.all?Math.round(cnt[s]/cnt.all*100):0;
  document.getElementById('dash-prog').innerHTML=[{label:'معلّقة',val:cnt.pending,pct:pct('pending'),color:'var(--pending)'},{label:'قيد التنفيذ',val:cnt.wip,pct:pct('wip'),color:'var(--wip)'},{label:'منتهية',val:cnt.done,pct:pct('done'),color:'var(--done)'},{label:'ملغية',val:cnt.cancelled,pct:pct('cancelled'),color:'var(--cancel)'}].map(b=>`<div class="prog-item"><div class="prog-label"><span>${b.label}</span><span>${b.val} (${b.pct}%)</span></div><div class="prog-track"><div class="prog-fill" style="width:${b.pct}%;background:${b.color}"></div></div></div>`).join('');

  // أكثر الموظفين إنجازاً (حسب المهام المُسندة الحقيقية بين كل الموظفين)
  const byEmp = {};
  tasks.forEach(t=>{
    if(!t.assignedToUid) return;
    if(!byEmp[t.assignedToUid]) byEmp[t.assignedToUid]={name:t.assignedToName,uid:t.assignedToUid,done:0,total:0};
    byEmp[t.assignedToUid].total++;
    if(t.status==='done') byEmp[t.assignedToUid].done++;
  });
  const es = Object.values(byEmp).sort((a,b)=>b.done-a.done).slice(0,5);
  document.getElementById('dash-leaders').innerHTML=es.length?es.map((x,i)=>{
    const prof=state.allUserProfiles.find(u=>u.uid===x.uid);
    const color=prof?.color||'#4f8ef7';
    return `<div class="leader-item"><span class="leader-rank">${i+1}</span><div class="leader-av" style="background:${color}">${initials(x.name)}</div><div class="leader-info"><div class="leader-name">${esc(x.name)}</div><div class="leader-tasks">${x.total} مهمة</div></div><span class="leader-done">${x.done} ✓</span></div>`;
  }).join(''):`<div class="empty" style="padding:20px"><div class="ei" style="font-size:1.5rem">👥</div><p style="font-size:.8rem">لا توجد مهام مُسندة بعد</p></div>`;

  // آخر المهام المُسندة المضافة (نظام الشركة كله)
  const rec=[...tasks].sort((a,b)=>b.createdAt-a.createdAt).slice(0,5);
  document.getElementById('dash-recent').innerHTML=rec.length?rec.map(t=>{
    const prof=state.allUserProfiles.find(u=>u.uid===t.assignedToUid);
    const color=prof?.color||'#4f8ef7';
    return `<div class="leader-item"><div style="width:26px;height:26px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:700;color:#fff;flex-shrink:0">${initials(t.assignedToName||'؟')}</div><div class="leader-info"><div class="leader-name" style="font-size:.8rem">${esc(t.title)}</div><div class="leader-tasks">${esc(t.assignedToName||'')}</div></div><span class="badge b-${t.status}" style="font-size:.65rem">${statusLabels[t.status]}</span></div>`;
  }).join(''):`<div class="empty" style="padding:20px"><div class="ei" style="font-size:1.5rem">📭</div><p style="font-size:.8rem">لا توجد مهام مُسندة بعد</p></div>`;

  // مهام تستحق قريباً (النظام كله)
  const soon=tasks.filter(t=>t.due&&t.due>=todayStr()&&t.status!=='done'&&t.status!=='cancelled').sort((a,b)=>a.due<b.due?-1:1).slice(0,5);
  document.getElementById('dash-upcoming').innerHTML=soon.length?soon.map(t=>{
    const dl=Math.ceil((new Date(t.due)-_today)/(1000*86400));
    return `<div class="leader-item"><div style="width:42px;text-align:center;flex-shrink:0"><div style="font-size:.8rem;font-weight:900;color:${dl<=2?'var(--cancel)':'var(--text)'}">${dl}</div><div style="font-size:.62rem;color:var(--muted)">يوم</div></div><div class="leader-info"><div class="leader-name" style="font-size:.8rem">${esc(t.title)}</div><div class="leader-tasks">${esc(t.assignedToName||'غير محدد')}</div></div><span class="badge b-${t.status}" style="font-size:.65rem">${statusLabels[t.status]}</span></div>`;
  }).join(''):`<div class="empty" style="padding:20px"><div class="ei" style="font-size:1.5rem">🎉</div><p style="font-size:.8rem">لا توجد مهام قادمة</p></div>`;
}

export function renderCounts(){
  const cnt={all:state.tasks.length,pending:0,wip:0,done:0,cancelled:0,overdue:0};state.tasks.forEach(t=>{cnt[t.status]++;if(isOverdue(t))cnt.overdue++;});
  ['all','pending','wip','done','overdue'].forEach(k=>{const el=document.getElementById('nb-'+k);if(el)el.textContent=cnt[k];});
  document.getElementById('nb-emps').textContent=state.emps.length;
  // Bottom nav
  const bt=document.getElementById('bnav-badge-tasks');if(bt){if(cnt.all>0){bt.textContent=cnt.all;bt.classList.add('show');}else bt.classList.remove('show');}
  // assigned badge
  const myAssigned=state.assignedTasks.filter(t=>t.assignedToUid===state.currentUser?.uid&&t.status!=='done'&&t.status!=='cancelled').length;
  const ba=document.getElementById('bnav-badge-assigned');if(ba){if(myAssigned>0){ba.textContent=myAssigned;ba.classList.add('show');}else ba.classList.remove('show');}
  document.getElementById('nb-assigned')?.textContent!==undefined && (document.getElementById('nb-assigned').textContent=state.isAdmin?state.assignedTasks.length:myAssigned);
}

export function renderAll(){renderCounts();if(state.currentPage==='dash')renderDash();if(state.currentPage==='tasks')renderTasks();if(state.currentPage==='emps')renderEmps();if(state.currentPage==='cal')renderCal();if(state.stepsCtx?.sourceType==='personal')renderStepsModal();}
