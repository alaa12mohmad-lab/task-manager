import { state } from '../core/state.js';
import { pageTitles } from '../core/constants.js';
import { renderTasks } from '../personal/tasks.js';
import { renderDash } from '../personal/dashboard.js';
import { renderEmps } from '../personal/employees.js';
import { renderCal } from '../personal/calendar.js';
import { renderWorkspacesPage, renderWsDetail } from '../workspaces/workspaces.js';
import { renderAdminPanel } from '../admin/admin.js';
import { renderAssignedPage } from '../assigned/assignedTasks.js';
import { renderKpiPage } from '../kpi/kpi.js';
import { renderChatRooms, loadChatRoom } from '../chat/chat.js';

export function toggleSidebar() {
  const sb = document.getElementById('app')?.querySelector('.sidebar');
  const ov = document.getElementById('sidebar-overlay');
  if (!sb) return;
  const open = sb.classList.toggle('open');
  ov.classList.toggle('open', open);
}
export function closeSidebar() {
  const sb = document.getElementById('app')?.querySelector('.sidebar');
  const ov = document.getElementById('sidebar-overlay');
  if (sb) sb.classList.remove('open');
  if (ov) ov.classList.remove('open');
}

export function goPage(p) {
  state.currentPage = p;
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.getElementById('page-' + p)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-' + p)?.classList.add('active');
  document.getElementById('page-title').textContent = pageTitles[p] || p;
  // Bottom nav sync
  document.querySelectorAll('.bnav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('bnav-' + p)?.classList.add('active');
  if (p === 'tasks') { state.currentFilter = 'all'; syncPills(); renderTasks(); }
  if (p === 'dash') renderDash();
  if (p === 'emps') renderEmps();
  if (p === 'cal') renderCal();
  if (p === 'workspaces') renderWorkspacesPage();
  if (p === 'ws-detail' && state.currentWs) renderWsDetail();
  if (p === 'admin') renderAdminPanel();
  if (p === 'assigned') renderAssignedPage();
  if (p === 'kpi') renderKpiPage();
  if (p === 'chat') { renderChatRooms(); if (state.currentChatRoom) loadChatRoom(state.currentChatRoom); }
}

export function quickFilter(f) {
  state.currentFilter = f;
  goPage('tasks');
  syncPills();
  document.getElementById('page-title').textContent = { all: 'مهامي', pending: 'المعلّقة', wip: 'قيد التنفيذ', done: 'المنتهية', cancelled: 'الملغية', overdue: 'المتأخرة' }[f] || 'مهامي';
}

export function setFilter(f) {
  state.currentFilter = f;
  syncPills();
  renderTasks();
}
export function syncPills() {
  document.querySelectorAll('.pill').forEach(el => {
    el.classList.remove('active');
    if (el.dataset.f === state.currentFilter) el.classList.add('active');
  });
}
