import { COLORS } from './constants.js';

const _today = new Date();


export const state = {
  // auth
  currentUser: null,

  // personal data
  tasks: [],
  emps: [],
  editTaskId: null,
  editEmpId: null,
  currentFilter: 'all',
  currentPage: 'dash',
  selectedColor: COLORS[0],

  // calendar
  calYear: _today.getFullYear(),
  calMonth: _today.getMonth(),

  // listener handles / sync flags
  unsubTasks: null,
  unsubEmps: null,
  unsubWorkspaces: null,
  unsubInvites: null,
  unsubWsMembers: null,
  unsubWsTasks: null,
  unsubNotifs: null,
  tasksReady: false,
  empsReady: false,
  seeded: false,

  // workspaces
  myWorkspaces: [],
  pendingInvites: [],
  currentWs: null,
  wsMembers: [],
  wsTasks: [],
  wsCurrentTab: 'tasks',
  editWsTaskId: null,
  inviteWsId: null,

  // notifications
  notifications: [],
  notifPanelOpen: false,

  // presence
  presenceInterval: null,

  // admin
  unsubAdminUsers: null,
  allUserProfiles: [],
  broadcastTargets: [],
  isAdmin: false,
  allAdmins: [],
  unsubRegCodes: null,
  regCodes: [],
  editUserUid: null,
  editUserColor: null,

  // assigned tasks
  unsubAssigned: null,
  assignedTasks: [],
  assignedTasksForEmp: {},
  editAssignedId: null,

  // chat
  unsubChat: null,
  currentChatRoom: null,
  chatRooms: [],
  chatMessages: [],
  unsubChatMsg: null,

  // comments
  commentsTaskId: null,
  commentsWsId: null,
  unsubComments: null,
  commentsList: [],

  // task completion history
  unsubHistory: null,
  history: [],
  historyEmployeeFilter: null, // admin: filter history by a specific employee uid (null = everyone)
};
