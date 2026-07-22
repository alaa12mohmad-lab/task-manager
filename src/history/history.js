import { db } from '../core/firebase.js';
import { state } from '../core/state.js';
import { esc, uid, fmtDate } from '../core/utils.js';
import { toast } from '../ui/toast.js';

// Called from the task-completion toggle points (personal tasks, workspace tasks, assigned
// tasks) whenever a task's status transitions TO 'done'. Writes a standalone, immutable
// record — so the log survives even if the original task is later edited or deleted.
export async function logTaskCompletion({ taskId, taskTitle, sourceType, workspaceId = null, workspaceName = null, employeeUid = null, employeeName = null }) {
  if (!state.currentUser) return;
  const uidToLog = employeeUid || state.currentUser.uid;
  const nameToLog = employeeName || state.currentUser.displayName || state.currentUser.email;
  try {
    const id = uid();
    await db.collection('taskHistory').doc(id).set({
      id,
      employeeUid: uidToLog,
      employeeName: nameToLog,
      taskId, taskTitle, sourceType,
      workspaceId, workspaceName,
      completedAt: Date.now()
    });
  } catch (e) {
    console.warn('logTaskCompletion failed:', e);
    toast('تم تغيير حالة المهمة، لكن فشل تسجيلها في سجل الإنجاز: ' + (e.code || e.message || ''), 'err');
  }
}

export function startHistoryListener() {
  if (state.unsubHistory) { state.unsubHistory(); state.unsubHistory = null; }
  if (!state.currentUser) return;
  if (state.isAdmin) {
    state.unsubHistory = db.collection('taskHistory').orderBy('completedAt', 'desc').limit(300).onSnapshot(snap => {
      state.history = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      if (state.currentPage === 'history') renderHistoryPage();
    }, err => { console.warn('history listener:', err); if (state.currentPage === 'history') renderHistoryError(err); });
  } else {
    // مفيش orderBy هنا مع where عمداً — الاتنين مع بعض بيحتاجوا فهرس مركّب في Firestore،
    // فبدل ما نعتمد عليه، بنرتّب النتائج يدوياً في الجافاسكريبت بعد الجلب
    state.unsubHistory = db.collection('taskHistory').where('employeeUid', '==', state.currentUser.uid)
      .limit(300).onSnapshot(snap => {
        state.history = snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => b.completedAt - a.completedAt);
        if (state.currentPage === 'history') renderHistoryPage();
      }, err => { console.warn('history listener:', err); if (state.currentPage === 'history') renderHistoryError(err); });
  }
}

function renderHistoryError(err) {
  const wrap = document.getElementById('history-page-content');
  if (wrap) wrap.innerHTML = `<div class="empty"><div class="ei">🚫</div><p>تعذّر تحميل سجل الإنجاز</p><small>${err.code || err.message || ''}</small></div>`;
}

export function filterHistoryByEmployee(uid) {
  state.historyEmployeeFilter = uid || null;
  renderHistoryPage();
}

const sourceLabels = { personal: '👤 شخصية', workspace: '🏢 مساحة مشتركة', assigned: '📌 مُسندة' };

export function renderHistoryPage() {
  const wrap = document.getElementById('history-page-content');
  if (!wrap) return;

  let list = state.history;
  if (state.isAdmin && state.historyEmployeeFilter) {
    list = list.filter(h => h.employeeUid === state.historyEmployeeFilter);
  }

  let filterBar = '';
  if (state.isAdmin) {
    const employees = [...new Map(state.history.map(h => [h.employeeUid, h.employeeName])).entries()];
    filterBar = `<div style="margin-bottom:14px">
      <select class="fselect" onchange="filterHistoryByEmployee(this.value)" style="width:100%;max-width:280px">
        <option value="">كل الموظفين (${state.history.length} سجل)</option>
        ${employees.map(([empUid, name]) => `<option value="${empUid}" ${state.historyEmployeeFilter === empUid ? 'selected' : ''}>${esc(name)}</option>`).join('')}
      </select>
    </div>`;
  }

  if (!list.length) {
    wrap.innerHTML = filterBar + `<div class="empty"><div class="ei">📜</div><p>لا يوجد سجل إنجاز بعد</p><small>هيتسجل هنا أول ما تخلّص أي مهمة</small></div>`;
    return;
  }

  wrap.innerHTML = filterBar + '<div class="tasks-list">' + list.map(h => `
    <div class="task-card" data-s="done">
      <div class="task-check" style="cursor:default">✓</div>
      <div class="task-body">
        <div class="task-title">${esc(h.taskTitle)}</div>
        <div class="task-meta">
          <span class="badge b-done">${sourceLabels[h.sourceType] || h.sourceType}</span>
          ${h.workspaceName ? `<span class="task-cat">🏢 ${esc(h.workspaceName)}</span>` : ''}
          ${state.isAdmin ? `<span class="task-cat">👤 ${esc(h.employeeName)}</span>` : ''}
          <span class="task-date">📅 ${fmtDate(new Date(h.completedAt).toISOString().slice(0, 10))}</span>
        </div>
      </div>
    </div>`).join('') + '</div>';
}
