import { state } from '../core/state.js';
import { esc, fmtDate, col, uid, isOverdue, isSuperAdmin } from '../core/utils.js';
import { statusLabels, priWeight, priLabels } from '../core/constants.js';
import { toast, setSyncStatus } from '../ui/toast.js';
import { openModal, closeModal } from '../ui/modal.js';
import { quickFilter } from '../ui/navigation.js';
import { openComments } from '../comments/comments.js';
import { logTaskCompletion } from '../history/history.js';

export function openTaskModal(id = null, prefillDate = null) {
  state.editTaskId = id;
  const isEdit = !!id;
  document.getElementById('tm-icon').textContent = isEdit ? '✏️' : '✦';
  document.getElementById('tm-title').textContent = isEdit ? 'تعديل المهمة' : 'إضافة مهمة جديدة';
  if (isEdit) {
    const t = state.tasks.find(x => x.id === id);
    document.getElementById('f-title').value = t.title;
    document.getElementById('f-desc').value = t.desc || '';
    document.getElementById('f-cat').value = t.cat || '';
    document.getElementById('f-status').value = t.status;
    document.getElementById('f-priority').value = t.priority;
    document.getElementById('f-due').value = t.due || '';
    document.getElementById('f-notes').value = t.notes || '';
  } else {
    ['f-title', 'f-desc', 'f-cat', 'f-notes'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('f-status').value = 'pending';
    document.getElementById('f-priority').value = 'medium';
    document.getElementById('f-due').value = prefillDate || '';
  }
  openModal('task-overlay');
  setTimeout(() => document.getElementById('f-title').focus(), 200);
}

export async function saveTask() {
  const title = document.getElementById('f-title').value.trim();
  const desc = document.getElementById('f-desc').value.trim();
  const cat = document.getElementById('f-cat').value.trim();
  const status = document.getElementById('f-status').value;
  const priority = document.getElementById('f-priority').value;
  const due = document.getElementById('f-due').value;
  const notes = document.getElementById('f-notes').value.trim();
  if (!title) { toast('يرجى إدخال عنوان المهمة', 'err'); return; }
  const btn = document.getElementById('save-task-btn');
  btn.disabled = true; btn.textContent = '⏳ جاري الحفظ...'; setSyncStatus('syncing');
  try {
    if (state.editTaskId) {
      await col('tasks').doc(state.editTaskId).update({ title, desc, cat, status, priority, due, notes });
      toast('تم تحديث المهمة ✓', 'ok');
    } else {
      const id = uid();
      await col('tasks').doc(id).set({ id, title, desc, cat, status, priority, due, notes, created: Date.now() });
      toast('تمت إضافة المهمة ✓', 'ok');
    }
    closeModal('task-overlay');
  } catch (e) { toast('خطأ في الحفظ', 'err'); setSyncStatus('error'); }
  finally { btn.disabled = false; btn.innerHTML = '💾 حفظ المهمة'; }
}

export function openTaskDetail(id) {
  const t = state.tasks.find(x => x.id === id);
  const sL = { pending: 'معلّقة', wip: 'قيد التنفيذ', done: 'منتهية', cancelled: 'ملغية' };
  const pL = { high: 'عالية 🔴', medium: 'متوسطة 🟡', low: 'منخفضة 🟢' };
  const sBg = '#4f8ef7';
  const rows = [
    ['الحالة', `<span class="badge b-${t.status}">${sL[t.status]}</span>`],
    ['الأولوية', `<span class="badge b-${t.priority}">${pL[t.priority]}</span>`],
    ['تاريخ الاستحقاق', t.due ? fmtDate(t.due) : '—'],
    ['الفئة', t.cat || '—'],
    ['الوصف', t.desc || '—'],
    ['الملاحظات', t.notes || '—'],
    ['تاريخ الإضافة', new Date(t.created).toLocaleDateString('ar-EG')]
  ];
  document.getElementById('detail-body').innerHTML = `<div class="detail-header"><div class="detail-av" style="background:${sBg}20;color:${sBg};font-size:1.4rem">📋</div><div><div class="detail-title">${esc(t.title)}</div></div></div>${rows.map(([k, v]) => `<div class="detail-row"><span class="detail-key">${k}</span><span class="detail-val">${v}</span></div>`).join('')}<div style="margin-top:16px;font-size:.8rem;color:var(--muted);font-weight:700">تغيير الحالة بسرعة:</div><div class="status-btns"><button class="status-btn s-pending" onclick="quickStatus('${id}','pending')">🔵 معلّقة</button><button class="status-btn s-wip" onclick="quickStatus('${id}','wip')">🟠 قيد التنفيذ</button><button class="status-btn s-done" onclick="quickStatus('${id}','done')">🟢 منتهية</button><button class="status-btn s-cancel" onclick="quickStatus('${id}','cancelled')">🔴 ملغية</button></div>`;
  document.getElementById('detail-foot').innerHTML =
    `<button class="btn btn-ghost" onclick="closeModal('detail-overlay')">إغلاق</button>` +
    (isSuperAdmin() ? `<button class="btn btn-danger" onclick="deleteTask('${id}');closeModal('detail-overlay')">🗑 حذف</button>` : '') +
    `<button class="btn btn-primary" onclick="closeModal('detail-overlay');openTaskModal('${id}')">✏️ تعديل</button>`;
  openModal('detail-overlay');
}

export async function quickStatus(id, status) {
  setSyncStatus('syncing');
  try {
    await col('tasks').doc(id).update({ status });
    if (status === 'done') {
      const t = state.tasks.find(x => x.id === id);
      if (t) logTaskCompletion({ taskId: id, taskTitle: t.title, sourceType: 'personal' });
    }
    closeModal('detail-overlay'); toast('تم تغيير الحالة ✓', 'ok');
  }
  catch (e) { toast('خطأ', 'err'); setSyncStatus('error'); }
}
export async function deleteTask(id) {
  if (!confirm('حذف هذه المهمة نهائياً؟')) return;
  setSyncStatus('syncing');
  try { await col('tasks').doc(id).delete(); toast('تم الحذف', 'err'); }
  catch (e) { toast('خطأ', 'err'); setSyncStatus('error'); }
}
export async function toggleStatus(id) {
  const t = state.tasks.find(x => x.id === id);
  const cycle = { pending: 'wip', wip: 'done', done: 'pending', cancelled: 'pending' };
  const newStatus = cycle[t.status];
  setSyncStatus('syncing');
  try {
    await col('tasks').doc(id).update({ status: newStatus });
    if (newStatus === 'done') logTaskCompletion({ taskId: id, taskTitle: t.title, sourceType: 'personal' });
  }
  catch (e) { setSyncStatus('error'); }
}

export function renderTasks() {
  const search = document.getElementById('search-input').value.toLowerCase();
  const sort = document.getElementById('sort-sel').value;
  let list = state.tasks.filter(t => {
    if (state.currentFilter === 'overdue') return isOverdue(t);
    if (state.currentFilter !== 'all' && t.status !== state.currentFilter) return false;
    if (search) {
      return t.title.toLowerCase().includes(search) || (t.desc || '').toLowerCase().includes(search) || (t.cat || '').toLowerCase().includes(search);
    }
    return true;
  });
  list.sort((a, b) => {
    if (sort === 'created') return b.created - a.created;
    if (sort === 'due') return (a.due || '9999') < (b.due || '9999') ? -1 : 1;
    if (sort === 'priority') return priWeight[a.priority] - priWeight[b.priority];
    return 0;
  });
  const oc = state.tasks.filter(isOverdue).length;
  document.getElementById('overdue-banner').innerHTML = oc > 0 && state.currentFilter !== 'overdue' ? `<div class="overdue-banner">⚠️ <strong>${oc} مهمة متأخرة</strong> تجاوزت تاريخ الاستحقاق <button class="btn btn-danger" style="margin-right:auto;padding:4px 10px;font-size:.75rem" onclick="quickFilter('overdue')">عرضها</button></div>` : '';
  const c = document.getElementById('tasks-container');
  if (!list.length) { c.innerHTML = `<div class="empty"><div class="ei">📭</div><p>لا توجد مهام</p><small>أضف مهمة جديدة أو غيّر الفلتر</small></div>`; return; }
  c.innerHTML = list.map(t => {
    const av = `<div style="width:32px;height:32px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:.8rem;color:#fff;flex-shrink:0;border:2px solid var(--border2)">📋</div>`;
    const ck = t.status === 'done' ? '✓' : t.status === 'cancelled' ? '✕' : t.status === 'wip' ? '►' : '';
    const dc = isOverdue(t) ? 'task-date overdue' : 'task-date';
    const dl = t.due ? `${isOverdue(t) ? '⚠️ ' : '📅 '}${fmtDate(t.due)}` : '';
    return `<div class="task-card" data-s="${t.status}"><div class="task-check" onclick="toggleStatus('${t.id}')">${ck}</div>${av}<div class="task-body"><div class="task-title">${esc(t.title)}</div>${t.desc ? `<div class="task-desc">${esc(t.desc)}</div>` : ''}<div class="task-meta"><span class="badge b-${t.status}">${statusLabels[t.status]}</span><span class="badge b-${t.priority}">${priLabels[t.priority]}</span>${dl ? `<span class="${dc}">${dl}</span>` : ''}${t.cat ? `<span class="task-cat">🏷 ${esc(t.cat)}</span>` : ''}</div></div><div class="task-actions"><button class="icon-btn" title="التعليقات" onclick="openComments('${t.id}',null,'${esc(t.title).slice(0, 40)}')">💬</button><button class="icon-btn" onclick="openTaskDetail('${t.id}')">👁</button><button class="icon-btn" onclick="openTaskModal('${t.id}')">✏️</button>${isSuperAdmin() ? `<button class="icon-btn del" onclick="deleteTask('${t.id}')">🗑</button>` : ''}</div></div>`;
  }).join('');
}
