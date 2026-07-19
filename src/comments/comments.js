import { db } from '../core/firebase.js';
import { state } from '../core/state.js';
import { esc, initials, uid, col } from '../core/utils.js';
import { toast } from '../ui/toast.js';
import { openModal, onModalClose } from '../ui/modal.js';
import { createNotif, timeAgo } from '../notifications/notifications.js';

// wsId can be: null (personal task), a real workspace id, or '__assigned__' (assigned task)
function commentsCollectionRef(taskId, wsId) {
  if (wsId === '__assigned__') return db.collection('assignedTasks').doc(taskId).collection('comments');
  if (wsId) return db.collection('workspaces').doc(wsId).collection('tasks').doc(taskId).collection('comments');
  return col('tasks').doc(taskId).collection('comments');
}

export function openComments(taskId, wsId = null, taskTitle = '') {
  state.commentsTaskId = taskId; state.commentsWsId = wsId; state.commentsList = [];
  document.getElementById('comments-modal-title').innerHTML = `💬 التعليقات — <span style="font-size:.85rem;color:var(--muted);font-weight:600">${esc(taskTitle)}</span>`;
  document.getElementById('comment-input').value = '';
  document.getElementById('comment-list').innerHTML = '<div class="comment-empty">جاري التحميل...</div>';
  if (state.unsubComments) { state.unsubComments(); state.unsubComments = null; }
  state.unsubComments = commentsCollectionRef(taskId, wsId).orderBy('createdAt', 'asc').onSnapshot(snap => {
    state.commentsList = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    renderComments();
  }, () => { document.getElementById('comment-list').innerHTML = '<div class="comment-empty">خطأ في التحميل</div>'; });
  openModal('comments-overlay');
  setTimeout(() => document.getElementById('comment-input').focus(), 300);
}

export function renderComments() {
  const list = document.getElementById('comment-list');
  if (!state.commentsList.length) { list.innerHTML = '<div class="comment-empty">لا توجد تعليقات — كن أول من يعلّق! 💬</div>'; return; }
  const palette = ['#4f8ef7', '#7c5ce4', '#00c896', '#f7a23e', '#ff5c7a', '#fd79a8', '#a29bfe', '#38d9a9'];
  const colorMap = {}; let ci = 0;
  state.commentsList.forEach(c => {
    if (!colorMap[c.authorUid]) { const m = state.wsMembers.find(x => x.uid === c.authorUid); colorMap[c.authorUid] = m?.color || palette[ci++ % palette.length]; }
  });
  list.innerHTML = state.commentsList.map(c => {
    const isMe = c.authorUid === state.currentUser.uid;
    const color = colorMap[c.authorUid];
    return `<div class="comment-item ${isMe ? 'comment-mine' : ''}">
      ${isMe ? '' : `<div class="comment-av" style="background:${color}">${initials(c.authorName)}</div>`}
      <div class="comment-bubble">
        <div class="comment-meta">
          <span class="comment-author" style="color:${color}">${esc(isMe ? 'أنت' : c.authorName)}</span>
          <span class="comment-time">${timeAgo(c.createdAt)}</span>
        </div>
        <div class="comment-text">${esc(c.text)}</div>
      </div>
      ${isMe ? `<div class="comment-av" style="background:${color}">${initials(c.authorName)}</div>` : ''}
    </div>`;
  }).join('');
  list.scrollTop = list.scrollHeight;
}

export async function sendComment() {
  const input = document.getElementById('comment-input');
  const text = input.value.trim();
  if (!text) return;
  const btn = document.getElementById('comment-send-btn');
  btn.disabled = true;
  try {
    if (state.commentsWsId === '__assigned__') {
      await db.collection('assignedTasks').doc(state.commentsTaskId).collection('comments').add({
        id: uid(), text,
        authorUid: state.currentUser.uid,
        authorName: state.currentUser.displayName || state.currentUser.email,
        authorEmail: state.currentUser.email,
        createdAt: Date.now()
      });
      input.value = '';
      const task = state.assignedTasks.find(t => t.id === state.commentsTaskId);
      if (task) {
        const targets = [task.assignedToUid, task.assignedByUid].filter(u => u && u !== state.currentUser.uid);
        for (const tUid of targets) {
          await createNotif(tUid, { type: 'task_updated', title: `💬 تعليق على مهمة`, body: `"${task.title}": ${text.slice(0, 50)}`, link: {} });
        }
      }
    } else {
      const colRef = commentsCollectionRef(state.commentsTaskId, state.commentsWsId);
      await colRef.doc(uid()).set({ id: uid(), text, authorUid: state.currentUser.uid, authorName: state.currentUser.displayName || state.currentUser.email, authorEmail: state.currentUser.email, createdAt: Date.now() });
      input.value = '';
      // إشعارات التعليق للمهام المشتركة
      if (state.commentsWsId) {
        const task = state.wsTasks.find(t => t.id === state.commentsTaskId);
        if (task) {
          const snippet = text.slice(0, 50) + (text.length > 50 ? '...' : '');
          const notifBody = `"${task.title}" — ${state.currentUser.displayName || state.currentUser.email}: ${snippet}`;
          if (task.assignedToUid && task.assignedToUid !== state.currentUser.uid)
            await createNotif(task.assignedToUid, { type: 'task_updated', title: '💬 تعليق جديد على مهمتك', body: notifBody, link: { wsId: state.commentsWsId, taskId: state.commentsTaskId } });
          if (task.createdByUid && task.createdByUid !== state.currentUser.uid && task.createdByUid !== task.assignedToUid)
            await createNotif(task.createdByUid, { type: 'task_updated', title: '💬 تعليق على مهمة', body: notifBody, link: { wsId: state.commentsWsId, taskId: state.commentsTaskId } });
        }
      }
    }
  } catch (e) { toast('خطأ في إرسال التعليق', 'err'); }
  finally { btn.disabled = false; }
}

export function commentKeydown(e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); sendComment(); } }

// Cleanup: stop the Firestore listener when the comments modal closes.
// (Replaces the original app's approach of monkey-patching window.closeModal.)
onModalClose('comments-overlay', () => {
  if (state.unsubComments) { state.unsubComments(); state.unsubComments = null; }
});
