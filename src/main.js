import './style.css';

import { state } from './core/state.js';
import { initAuth } from './auth/auth.js';
import { canManageWs } from './core/utils.js';

// ── UI ──
import { closeModal, handleOvClick } from './ui/modal.js';
import { toggleSidebar, closeSidebar, goPage, quickFilter, setFilter } from './ui/navigation.js';

// ── Auth ──
import {
  doLogin, doRegister, doReset, doLogout,
  switchTab, showReset, hideReset, togglePw, checkStrength
} from './auth/auth.js';

// ── Personal: tasks / employees / calendar ──
import { openTaskModal, saveTask, openTaskDetail, quickStatus, deleteTask, toggleStatus, renderTasks } from './personal/tasks.js';
import { openEmpModal, selectColor, saveEmp, deleteEmp, empTaskFilter } from './personal/employees.js';
import { changeMonth, calClick } from './personal/calendar.js';

// ── Workspaces ──
import { openCreateWsModal, createWorkspace, openWs, switchWsTab } from './workspaces/workspaces.js';
import { openInviteModal, sendInvitation, acceptInvite, rejectInvite } from './workspaces/invitations.js';
import { changeMemberRole, removeMember } from './workspaces/members.js';
import { openWsTaskModal, saveWsTask, deleteWsTask, toggleWsTaskStatus } from './workspaces/wsTasks.js';

// ── Notifications ──
import { toggleNotifPanel, closeNotifPanel, handleNotifClick, markAllRead } from './notifications/notifications.js';

// ── Admin ──
import {
  renderAdminUsers, addBroadcastTarget, removeBroadcastTarget, selectAllBroadcast,
  clearBroadcastTargets, sendBroadcast, quickNotifUser, adminSetWsRole,
  clearAllDefaultData, promoteToAdmin, revokeAdmin,
  generateRegCode, copyRegCode, revokeRegCode,
  suspendUser, unsuspendUser, openEditUserModal, selectUserEditColor, saveUserEdit
} from './admin/admin.js';

// ── Assigned tasks ──
import { openAssignModal, saveAssignedTask, deleteAssignedTask, toggleAssignedStatus, filterAssignedByEmployee } from './assigned/assignedTasks.js';

// ── KPI ──
import { toggleEmpTasks } from './kpi/kpi.js';

// ── Chat ──
import { loadChatRoom, sendChatMsg, chatKeydown, autoResizeChatInput } from './chat/chat.js';

// ── Comments ──
import { openComments, sendComment, commentKeydown } from './comments/comments.js';

// ── History ──
import { filterHistoryByEmployee } from './history/history.js';

// ── Profile ──
import { saveMyProfile, selectMyProfileColor } from './profile/profile.js';

// index.html still uses plain onclick="functionName(...)" attributes (unchanged from the
// original single-file app), so every function those attributes reference has to exist on
// window. This is the one place in the codebase where that global surface is assembled.
Object.assign(window, {
  closeModal, handleOvClick,
  toggleSidebar, closeSidebar, goPage, quickFilter, setFilter,
  doLogin, doRegister, doReset, doLogout, switchTab, showReset, hideReset, togglePw, checkStrength,
  openTaskModal, saveTask, openTaskDetail, quickStatus, deleteTask, toggleStatus, renderTasks,
  openEmpModal, selectColor, saveEmp, deleteEmp, empTaskFilter,
  changeMonth, calClick,
  openCreateWsModal, createWorkspace, openWs, switchWsTab,
  openInviteModal, sendInvitation, acceptInvite, rejectInvite,
  changeMemberRole, removeMember,
  openWsTaskModal, saveWsTask, deleteWsTask, toggleWsTaskStatus,
  toggleNotifPanel, closeNotifPanel, handleNotifClick, markAllRead,
  renderAdminUsers, addBroadcastTarget, removeBroadcastTarget, selectAllBroadcast,
  clearBroadcastTargets, sendBroadcast, quickNotifUser, adminSetWsRole,
  clearAllDefaultData, promoteToAdmin, revokeAdmin,
  generateRegCode, copyRegCode, revokeRegCode,
  suspendUser, unsuspendUser, openEditUserModal, selectUserEditColor, saveUserEdit,
  openAssignModal, saveAssignedTask, deleteAssignedTask, toggleAssignedStatus, filterAssignedByEmployee,
  toggleEmpTasks,
  loadChatRoom, sendChatMsg, chatKeydown, autoResizeChatInput,
  openComments, sendComment, commentKeydown,
  filterHistoryByEmployee,
  saveMyProfile, selectMyProfileColor,
});

// ── Global keyboard shortcuts ──
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') ['task-overlay', 'emp-overlay', 'detail-overlay', 'ws-create-overlay', 'invite-overlay', 'ws-task-overlay'].forEach(id => closeModal(id));
  if (document.getElementById('auth-screen').style.display !== 'none' && e.key === 'Enter') {
    if (document.getElementById('auth-reset-card').style.display !== 'none') doReset();
    else if (document.getElementById('panel-login').classList.contains('active')) doLogin();
    else doRegister();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    if (state.currentPage === 'ws-detail' && canManageWs()) openWsTaskModal();
    else openTaskModal();
  }
});

// ── Boot ──
initAuth();
