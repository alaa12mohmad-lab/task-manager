import { db } from '../core/firebase.js';
import { state } from '../core/state.js';
import { esc, uid } from '../core/utils.js';
import { openWs } from '../workspaces/workspaces.js';

export function startNotifListener(){
  if(state.unsubNotifs){state.unsubNotifs();state.unsubNotifs=null;}
  state.unsubNotifs=db.collection('users').doc(state.currentUser.uid).collection('notifications')
    .orderBy('createdAt','desc').limit(50)
    .onSnapshot(snap=>{
      state.notifications=snap.docs.map(d=>({...d.data(),id:d.id}));
      updateNotifBadge();
      if(state.notifPanelOpen) renderNotifPanel();
    },err=>console.warn('notif listener:',err));
}

export function updateNotifBadge(){
  const unread=state.notifications.filter(n=>!n.read).length;
  const btn=document.getElementById('notif-btn');
  const cnt=document.getElementById('notif-count');
  if(btn&&cnt){
    if(unread>0){cnt.textContent=unread>99?'99+':unread;cnt.style.display='flex';btn.classList.add('has-new');}
    else{cnt.style.display='none';btn.classList.remove('has-new');}
  }
  // Bottom nav badge
  const bb=document.getElementById('bnav-badge-notif');
  if(bb){if(unread>0){bb.textContent=unread>99?'99+':unread;bb.classList.add('show');}else{bb.classList.remove('show');}}
  // WS badge
  const wb=document.getElementById('bnav-badge-ws');
  if(wb){const n=state.pendingInvites.length;if(n>0){wb.textContent=n;wb.classList.add('show');}else wb.classList.remove('show');}
}

export function toggleNotifPanel(){
  state.notifPanelOpen=!state.notifPanelOpen;
  document.getElementById('notif-panel-wrap').style.display=state.notifPanelOpen?'block':'none';
  const panel=document.getElementById('notif-panel');
  panel.style.display=state.notifPanelOpen?'flex':'none';
  if(state.notifPanelOpen) renderNotifPanel();
}

export function closeNotifPanel(){
  state.notifPanelOpen=false;
  document.getElementById('notif-panel-wrap').style.display='none';
  document.getElementById('notif-panel').style.display='none';
}

export function renderNotifPanel(){
  const panel=document.getElementById('notif-panel');
  panel.className='notif-panel';
  const unread=state.notifications.filter(n=>!n.read).length;
  const items=state.notifications.length?state.notifications.map(n=>{
    const icons={task_assigned:'📋',task_status:'🔄',task_updated:'📝',ws_invite:'🏢'};
    const bgs={task_assigned:'rgba(79,142,247,.15)',task_status:'rgba(0,200,150,.15)',task_updated:'rgba(247,162,62,.15)',ws_invite:'rgba(124,92,228,.15)'};
    const ago=timeAgo(n.createdAt);
    return`<div class="notif-item ${n.read?'':'unread'}" onclick="handleNotifClick('${n.id}')">
      ${!n.read?'<div class="unread-dot"></div>':'<div style="width:7px;flex-shrink:0"></div>'}
      <div class="notif-ico" style="background:${bgs[n.type]||'rgba(79,142,247,.15)'}">${icons[n.type]||'🔔'}</div>
      <div class="notif-content">
        <div class="notif-ntitle">${esc(n.title)}</div>
        <div class="notif-nbody">${esc(n.body)}</div>
        <div class="notif-ntime">${ago}</div>
      </div>
    </div>`;
  }).join(''):`<div class="notif-empty-state"><div class="nei">🔔</div><p>لا توجد إشعارات</p></div>`;

  panel.innerHTML=`
    <div class="notif-head">
      <span class="notif-head-title">الإشعارات ${unread>0?`<span style="font-size:.7rem;color:var(--muted);font-weight:400">(${unread} غير مقروء)</span>`:''}
      </span>
      ${unread>0?`<button class="notif-mark-all" onclick="markAllRead()">قراءة الكل ✓</button>`:''}
    </div>
    <div class="notif-body">${items}</div>`;
}

export async function handleNotifClick(id){
  const n=state.notifications.find(x=>x.id===id);
  if(!n)return;
  // Mark as read
  if(!n.read){
    try{await db.collection('users').doc(state.currentUser.uid).collection('notifications').doc(id).update({read:true});}
    catch(e){}
  }
  // Navigate
  if(n.link?.wsId){
    const ws=state.myWorkspaces.find(w=>w.id===n.link.wsId);
    if(ws){closeNotifPanel();openWs(n.link.wsId);}
  }
  closeNotifPanel();
}

export async function markAllRead(){
  const unreadIds=state.notifications.filter(n=>!n.read).map(n=>n.id);
  if(!unreadIds.length)return;
  try{
    const batch=db.batch();
    unreadIds.forEach(id=>batch.update(db.collection('users').doc(state.currentUser.uid).collection('notifications').doc(id),{read:true}));
    await batch.commit();
  }catch(e){console.warn('markAllRead:',e);}
}

// Helper: create notification for another user
export async function createNotif(targetUid, {type,title,body,link={}}){
  if(!targetUid||targetUid===state.currentUser.uid)return; // لا ترسل لنفسك
  try{
    const id=uid();
    await db.collection('users').doc(targetUid).collection('notifications').doc(id).set({
      id,type,title,body,link,read:false,
      createdAt:Date.now(),
      fromUid:state.currentUser.uid,
      fromName:state.currentUser.displayName||state.currentUser.email
    });
  }catch(e){console.warn('createNotif failed:',e);}
}

// Helper: relative time
export function timeAgo(ts){
  const diff=Date.now()-ts;
  const m=Math.floor(diff/60000);
  const h=Math.floor(diff/3600000);
  const d=Math.floor(diff/86400000);
  if(m<1)return'الآن';
  if(m<60)return`منذ ${m} دقيقة`;
  if(h<24)return`منذ ${h} ساعة`;
  if(d<7)return`منذ ${d} أيام`;
  return new Date(ts).toLocaleDateString('ar-EG');
}
