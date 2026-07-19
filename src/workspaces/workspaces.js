import { db } from '../core/firebase.js';
import { state } from '../core/state.js';
import { esc, initials, fmtDate, uid, isOverdue, isSuperAdmin, myRoleInWs, canManageWs } from '../core/utils.js';
import { COLORS, roleLabels, roleClass, wsStatusLabels, wsPriLabels } from '../core/constants.js';
import { toast, setSyncStatus } from '../ui/toast.js';
import { openModal, closeModal } from '../ui/modal.js';
import { setBtnLoading } from '../ui/formHelpers.js';
import { goPage } from '../ui/navigation.js';
import { openComments } from '../comments/comments.js';
import { openInviteModal } from './invitations.js';
import { openWsTaskModal, toggleWsTaskStatus, deleteWsTask } from './wsTasks.js';
import { changeMemberRole, removeMember } from './members.js';

export function startWsListeners(){
  // User's workspaces
  state.unsubWorkspaces=db.collection('workspaces').where('memberUids','array-contains',state.currentUser.uid).onSnapshot(snap=>{
    state.myWorkspaces=snap.docs.map(d=>({...d.data(),id:d.id}));
    document.getElementById('nb-ws').textContent=state.myWorkspaces.length;
    if(state.currentPage==='workspaces')renderWorkspacesPage();
    if(state.currentPage==='ws-detail'&&state.currentWs)renderWsDetail();
  });
  // Pending invitations for this email
  state.unsubInvites=db.collection('invitations').where('inviteeEmail','==',state.currentUser.email).where('status','==','pending').onSnapshot(snap=>{
    state.pendingInvites=snap.docs.map(d=>({...d.data(),id:d.id}));
    const n=state.pendingInvites.length;
    document.getElementById('nb-invites').textContent=n;
    document.getElementById('nav-invites').style.display=n>0?'flex':'none';
    if(state.currentPage==='workspaces')renderWorkspacesPage();
  });
}

export function openCreateWsModal(){
  document.getElementById('ws-name-input').value='';
  document.getElementById('ws-desc-input').value='';
  document.getElementById('ws-create-error').textContent='';
  document.getElementById('ws-create-error').classList.remove('show');
  openModal('ws-create-overlay');
  setTimeout(()=>document.getElementById('ws-name-input').focus(),200);
}
export async function createWorkspace(){
  const name=document.getElementById('ws-name-input').value.trim();
  const desc=document.getElementById('ws-desc-input').value.trim();
  const errEl=document.getElementById('ws-create-error');
  errEl.textContent=''; errEl.classList.remove('show');
  if(!name){errEl.textContent='يرجى إدخال اسم المساحة';errEl.classList.add('show');return;}
  setBtnLoading('ws-create-btn',true);
  setSyncStatus('syncing');
  try{
    const wsId=uid();
    const color=COLORS[Math.floor(Math.random()*COLORS.length)];
    const wsDoc={
      id:wsId,name,desc,
      ownerId:state.currentUser.uid,
      ownerEmail:state.currentUser.email,
      ownerName:state.currentUser.displayName||state.currentUser.email,
      memberUids:[state.currentUser.uid],
      createdAt:Date.now()
    };
    const memberData={
      uid:state.currentUser.uid,
      email:state.currentUser.email,
      displayName:state.currentUser.displayName||state.currentUser.email,
      role:'owner',
      joinedAt:Date.now(),
      color
    };
    // ── كتابتان منفصلتان: workspace أولاً، ثم member ──
    // بدون batch لأن قاعدة subcollection تحتاج الـ workspace موجوداً
    await db.collection('workspaces').doc(wsId).set(wsDoc);
    await db.collection('workspaces').doc(wsId).collection('members').doc(state.currentUser.uid).set(memberData);
    closeModal('ws-create-overlay');
    toast('تم إنشاء المساحة بنجاح ✓','ok');
    setSyncStatus('synced');
  }catch(e){
    console.error('createWorkspace error:',e);
    errEl.textContent='خطأ: '+e.message;
    errEl.classList.add('show');
    setSyncStatus('error');
  }
  finally{setBtnLoading('ws-create-btn',false,'🏢 إنشاء المساحة');}
}

// Open workspace detail
export function openWs(wsId){
  state.currentWs=state.myWorkspaces.find(w=>w.id===wsId);
  if(!state.currentWs)return;
  state.wsMembers=[];state.wsTasks=[];state.editWsTaskId=null;
  // Stop previous listeners
  if(state.unsubWsMembers){state.unsubWsMembers();state.unsubWsMembers=null;}
  if(state.unsubWsTasks){state.unsubWsTasks();state.unsubWsTasks=null;}
  // Start new listeners
  state.unsubWsMembers=db.collection('workspaces').doc(wsId).collection('members').onSnapshot(snap=>{
    state.wsMembers=snap.docs.map(d=>({...d.data(),uid:d.id}));
    if(state.currentPage==='ws-detail')renderWsDetail();
  });
  state.unsubWsTasks=db.collection('workspaces').doc(wsId).collection('tasks').orderBy('created','desc').onSnapshot(snap=>{
    state.wsTasks=snap.docs.map(d=>({...d.data(),id:d.id}));
    if(state.currentPage==='ws-detail')renderWsDetail();
  });
  state.wsCurrentTab='tasks';
  document.getElementById('page-title').textContent=state.currentWs.name;
  goPage('ws-detail');
}

export function renderWorkspacesPage(){
  // Pending invitations section
  const invSec=document.getElementById('pending-invites-section');
  if(state.pendingInvites.length>0){
    invSec.innerHTML=`<div class="ws-section-title" style="margin-bottom:12px">🔔 دعوات معلّقة (${state.pendingInvites.length})</div>`+
      state.pendingInvites.map(inv=>`
        <div class="inv-card">
          <div class="inv-avatar">🏢</div>
          <div class="inv-info">
            <div class="inv-title">${esc(inv.workspaceName)}</div>
            <div class="inv-sub">دعوة من: ${esc(inv.invitedByName)}</div>
          </div>
          <div class="inv-actions">
            <button class="btn btn-success btn-sm" onclick="acceptInvite('${inv.id}')">✓ قبول</button>
            <button class="btn btn-danger btn-sm" onclick="rejectInvite('${inv.id}')">✕ رفض</button>
          </div>
        </div>`).join('');
    invSec.style.marginBottom='24px';
  }else{
    invSec.innerHTML='';
    invSec.style.marginBottom='0';
  }
  // Workspace grid
  const grid=document.getElementById('ws-grid');
  if(!state.myWorkspaces.length){
    grid.innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="ei">🏢</div><p>لا توجد مساحات مشتركة</p><small>أنشئ مساحة أو انتظر دعوة</small></div>`;
    return;
  }
  grid.innerHTML=state.myWorkspaces.map(ws=>{
    const myMember=ws.memberUids?.includes(state.currentUser.uid);
    // We don't have members count here easily, show what we can
    return`<div class="ws-card" onclick="openWs('${ws.id}')">
      <div class="ws-card-name">${esc(ws.name)}</div>
      ${ws.desc?`<div style="font-size:.75rem;color:var(--muted);margin-bottom:8px">${esc(ws.desc)}</div>`:''}
      <div class="ws-card-meta">
        <span>👤 ${esc(ws.ownerName||ws.ownerEmail)}</span>
      </div>
      <div style="font-size:.72rem;color:var(--muted);margin-bottom:12px">📅 ${new Date(ws.createdAt).toLocaleDateString('ar-EG')}</div>
    </div>`;
  }).join('');
}

/* ══ WORKSPACE TAB SWITCH ══ */
export function switchWsTab(tab){
  state.wsCurrentTab=tab;
  document.getElementById('wstab-tasks').classList.toggle('active',tab==='tasks');
  document.getElementById('wstab-members').classList.toggle('active',tab==='members');
  document.getElementById('ws-tasks-panel').style.display=tab==='tasks'?'':'none';
  document.getElementById('ws-members-panel').style.display=tab==='members'?'':'none';
}

/* ══ RENDER WORKSPACE DETAIL ══ */

export function renderWsDetail(){
  if(!state.currentWs)return;
  document.getElementById('page-title').textContent=state.currentWs.name;
  document.getElementById('ws-detail-name').textContent=state.currentWs.name;
  document.getElementById('ws-detail-sub').textContent=`${state.wsMembers.length} أعضاء • ${state.wsTasks.length} مهمة`;
  
  const role=myRoleInWs();
  const canManage=canManageWs();
  
  // Header actions
  document.getElementById('ws-detail-actions').innerHTML=
    `<div style="display:flex;gap:8px;align-items:center">
      <span class="ws-role-badge ${roleClass[role]}">${roleLabels[role]||roleLabels['member']}</span>
      ${canManage?`<button class="btn btn-ghost btn-sm" onclick="openInviteModal()">✉️ دعوة عضو</button>
      <button class="btn btn-primary btn-sm" onclick="openWsTaskModal()">＋ إضافة مهمة</button>`:''}
    </div>`;

  // ── Tasks Panel ──
  let list=state.wsTasks;
  // If member (not manager), show only assigned tasks
  if(!canManage){list=state.wsTasks.filter(t=>t.assignedToUid===state.currentUser.uid);}
  
  const tp=document.getElementById('ws-tasks-panel');
  if(!list.length){
    tp.innerHTML=`<div class="empty"><div class="ei">📋</div><p>${canManage?'لا توجد مهام في هذه المساحة':'لا توجد مهام مسندة إليك'}</p><small>${canManage?'أضف مهمة وعيّنها لأحد الأعضاء':''}</small></div>`;
  }else{
    // Manager: show member progress summary
    let summary='';
    if(canManage&&state.wsMembers.length>0){
      summary=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin-bottom:18px">
        ${state.wsMembers.map(m=>{
          const mt=state.wsTasks.filter(t=>t.assignedToUid===m.uid);
          const md=mt.filter(t=>t.status==='done').length;
          const pct=mt.length?Math.round(md/mt.length*100):0;
          return`<div style="background:var(--s1);border:1px solid var(--border);border-radius:10px;padding:12px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <div style="width:28px;height:28px;border-radius:50%;background:${m.color||'var(--accent)'};display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;color:#fff;flex-shrink:0">${initials(m.displayName||m.email)}</div>
              <div style="flex:1;min-width:0"><div style="font-size:.78rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.displayName||m.email)}</div>
              <div style="font-size:.65rem;color:var(--muted)">${mt.length} مهام • ${md} منتهية</div></div>
            </div>
            <div class="prog-track"><div class="prog-fill" style="width:${pct}%;background:${m.color||'var(--accent)'}"></div></div>
            <div style="font-size:.65rem;color:var(--muted);margin-top:3px;text-align:left">${pct}%</div>
          </div>`;
        }).join('')}
      </div>`;
    }
    tp.innerHTML=summary+'<div class="tasks-list">'+list.map(t=>{
      const ck=t.status==='done'?'✓':t.status==='cancelled'?'✕':t.status==='wip'?'►':'';
      const dc=isOverdue(t)?'task-date overdue':'task-date';
      const dl=t.due?`${isOverdue(t)?'⚠️ ':'📅 '}${fmtDate(t.due)}`:'';
      const assignee=state.wsMembers.find(m=>m.uid===t.assignedToUid);
      const av=assignee?`<div style="width:32px;height:32px;border-radius:50%;background:${assignee.color||'var(--accent)'};display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;color:#fff;flex-shrink:0;border:2px solid var(--border2)">${initials(assignee.displayName||assignee.email)}</div>`
        :`<div style="width:32px;height:32px;border-radius:50%;background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:.8rem;color:var(--muted);flex-shrink:0;border:2px solid var(--border)">؟</div>`;
      const chip=assignee?`<span style="display:flex;align-items:center;gap:4px;font-size:.72rem;color:${assignee.color||'var(--accent)'};background:${(assignee.color||'#4f8ef7')}18;border:1px solid ${(assignee.color||'#4f8ef7')}40;border-radius:20px;padding:2px 8px 2px 4px"><span style="background:${assignee.color||'var(--accent)'};width:14px;height:14px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:.5rem;font-weight:700;color:#fff">${initials(assignee.displayName||assignee.email)}</span>${esc(assignee.displayName||assignee.email)}</span>`:'';
      // Can edit/delete: manager always, member only their status
      const canEditThis=canManage||(t.assignedToUid===state.currentUser.uid);
      return`<div class="task-card" data-s="${t.status}">
        <div class="task-check" onclick="toggleWsTaskStatus('${t.id}')">${ck}</div>
        ${av}
        <div class="task-body">
          <div class="task-title">${esc(t.title)}</div>
          ${t.desc?`<div class="task-desc">${esc(t.desc)}</div>`:''}
          <div class="task-meta">
            <span class="badge b-${t.status}">${wsStatusLabels[t.status]}</span>
            <span class="badge b-${t.priority}">${wsPriLabels[t.priority]}</span>
            ${chip}${dl?`<span class="${dc}">${dl}</span>`:''}
            ${t.cat?`<span class="task-cat">🏷 ${esc(t.cat)}</span>`:''}
          </div>
        </div>
        <div class="task-actions">
          <button class="icon-btn" title="التعليقات" onclick="openComments('${t.id}','${state.currentWs.id}','${esc(t.title).slice(0,40)}')">💬</button>
          ${canManage?`<button class="icon-btn" onclick="openWsTaskModal('${t.id}')">✏️</button><button class="icon-btn del" onclick="deleteWsTask('${t.id}')">🗑</button>`:''}
        </div>
      </div>`;
    }).join('')+'</div>';
  }

  // ── Members Panel ──
  const mp=document.getElementById('ws-members-panel');
  const canAdmin=isSuperAdmin()||(state.wsMembers.find(m=>m.uid===state.currentUser.uid)?.role==='owner');
  mp.innerHTML=state.wsMembers.map(m=>{
    const isMe=m.uid===state.currentUser.uid;
    const isOwner=m.role==='owner';
    return`<div class="member-row">
      <div class="member-av" style="background:${m.color||'var(--accent)'}">${initials(m.displayName||m.email)}</div>
      <div class="member-info">
        <div class="member-name">${esc(m.displayName||m.email)}${isMe?' (أنت)':''}</div>
        <div class="member-email">${esc(m.email)}</div>
      </div>
      <div class="member-actions">
        <span class="ws-role-badge ${roleClass[m.role]||roleClass['member']}">${roleLabels[m.role]||roleLabels['member']}</span>
        ${canAdmin&&!isMe&&!isOwner?`
          <select class="fselect" style="font-size:.72rem;padding:3px 8px" onchange="changeMemberRole('${m.uid}',this.value)">
            <option value="manager" ${m.role==='manager'?'selected':''}>مدير</option>
            <option value="member" ${m.role==='member'?'selected':''}>عضو</option>
          </select>
          <button class="icon-btn del btn-sm" onclick="removeMember('${m.uid}')" title="إزالة">✕</button>`:''}
      </div>
    </div>`;
  }).join('')||`<div class="empty"><div class="ei">👥</div><p>لا يوجد أعضاء</p></div>`;
  
  // Ensure correct tab shown
  switchWsTab(state.wsCurrentTab);
}

/* ══ PERSONAL TASK MODAL ══ */
