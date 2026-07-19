import { db } from './firebase.js';
import { state } from './state.js';
import { SUPER_ADMIN } from './constants.js';

export function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export function initials(n) {
  return (n || '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '؟';
}
export function fmtDate(d) {
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}
export function fmtDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function isOverdue(t) {
  return t.due && t.due < todayStr() && t.status !== 'done' && t.status !== 'cancelled';
}
// todayStr is computed once when the app loads (kept here to avoid a circular import with state.js)
let _todayStrCache = null;
export function todayStr() {
  if (!_todayStrCache) _todayStrCache = fmtDateStr(new Date());
  return _todayStrCache;
}
export function empById(id) {
  return state.emps.find(e => e.id === id);
}
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
export function col(name) {
  return db.collection('users').doc(state.currentUser.uid).collection(name);
}
export function isSuperAdmin() {
  return state.currentUser?.email === SUPER_ADMIN;
}
export function myRoleInWs() {
  if (isSuperAdmin()) return 'owner';
  return state.wsMembers.find(m => m.uid === state.currentUser?.uid)?.role || 'member';
}
export function canManageWs() {
  return ['owner', 'manager'].includes(myRoleInWs());
}
