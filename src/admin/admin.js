import { db } from '../core/firebase.js';
import { state } from '../core/state.js';
import { esc, initials, uid, col, isSuperAdmin } from '../core/utils.js';
import { COLORS, SUPER_ADMIN } from '../core/constants.js';
import { toast, setSyncStatus } from '../ui/toast.js';
import { timeAgo, createNotif } from '../notifications/notifications.js';
import { startPresenceTracking } from '../presence/presence.js';

export function startAdminListener(){
  if(state.unsubAdminUsers){state.unsubAdminUsers();state.unsubAdminUsers=null;}
  state.unsubAdminUsers=db.collection('userProfiles').onSnapshot(snap=>{
    state.allUserProfiles=snap.docs.map(d=>({...d.data(),uid:d.id}));
    const online=state.allUserProfiles.filter(u=>u.isOnline).length;
    // Update admin stat cards
    ['adm-online','adm-total'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=id==='adm-online'?online:state.allUserProfiles.length;});
    const nbOnline=document.getElementById('nb-online');if(nbOnline)nbOnline.textContent=online;
    document.getElementById('adm-ws').textContent=state.myWorkspaces.length;
    document.getElementById('adm-tasks').textContent=state.tasks.length;
    if(state.currentPage==='admin') renderAdminUsers();
    populateBroadcastSelect();
  },err=>console.warn('adminListener:',err));
}

/* ══ ADMIN PANEL RENDER ══ */
export function renderAdminPanel(){
  if(!isSuperAdmin()){document.getElementById('page-admin').innerHTML='<div class="empty"><div class="ei">🚫</div><p>غير مصرح</p></div>';return;}
  const online=state.allUserProfiles.filter(u=>u.isOnline).length;
  const el1=document.getElementById('adm-online');if(el1)el1.textContent=online;
  const el2=document.getElementById('adm-total');if(el2)el2.textContent=state.allUserProfiles.length;
  const el3=document.getElementById('adm-ws');if(el3)el3.textContent=state.myWorkspaces.length;
  const el4=document.getElementById('adm-tasks');if(el4)el4.textContent=state.tasks.length;
  renderAdminUsers();
  renderAdminSessions();
  populateBroadcastSelect();
}

export function renderAdminUsers(){
  const q=(document.getElementById('admin-search')?.value||'').toLowerCase();
  const list=document.getElementById('admin-users-list');
  if(!list)return;
  let users=state.allUserProfiles.filter(u=>u.uid!==state.currentUser.uid);
  if(q) users=users.filter(u=>(u.displayName+u.email).toLowerCase().includes(q));
  if(!users.length){list.innerHTML='<div class="empty" style="padding:30px"><div class="ei" style="font-size:1.8rem">👥</div><p style="font-size:.82rem">لا يوجد مستخدمون مسجلون</p></div>';return;}
  list.innerHTML=users.map(u=>{
    const color=u.color||COLORS[Math.abs(u.uid.charCodeAt(0))%COLORS.length];
    const onlineAgo=u.lastSeen?timeAgo(u.lastSeen):'';
    const loginTime=u.lastLogin?new Date(u.lastLogin).toLocaleString('ar-EG'):'—';
    const logoutTime=u.lastLogout?new Date(u.lastLogout).toLocaleString('ar-EG'):'—';
    // Find role in any shared workspace
    const wsRole=state.myWorkspaces.reduce((acc,ws)=>{
      if(ws.memberUids?.includes(u.uid)) acc.push(ws.name);
      return acc;
    },[]);
    return`<div class="admin-user-row">
      <div class="admin-user-av" style="background:${color}">
        ${initials(u.displayName||u.email)}
        <div class="presence-dot ${u.isOnline?'online':'offline'}"></div>
      </div>
      <div class="admin-user-info">
        <div class="admin-user-name">${esc(u.displayName||u.email)}</div>
        <div class="admin-user-email">${esc(u.email)}</div>
        <div class="admin-user-meta">
          <span>🔑 آخر دخول: ${loginTime}</span>
          ${u.lastLogout?`<span>🚪 آخر خروج: ${logoutTime}</span>`:''}
          ${wsRole.length?`<span>🏢 ${wsRole.join(', ')}</span>`:''}
        </div>
      </div>
      <div class="admin-user-actions">
        <span class="online-badge ${u.isOnline?'on':'off'}">${u.isOnline?'🟢 متصل':'⚫ غير متصل'}</span>
        ${u.isOnline?`<span style="font-size:.65rem;color:var(--muted)">${onlineAgo}</span>`:`<span style="font-size:.65rem;color:var(--muted)">${onlineAgo}</span>`}
        <button class="btn btn-ghost btn-sm" style="font-size:.72rem" onclick="quickNotifUser('${u.uid}','${esc(u.displayName||u.email)}')">🔔</button>
      </div>
    </div>`;
  }).join('');
}


export async function renderAdminSessions(){
  const list=document.getElementById('admin-sessions-list');
  if(!list)return;
  try{
    // Get last 20 sessions across all users (each user's subcollection - we load from all profiles)
    let sessions=[];
    for(const u of state.allUserProfiles.slice(0,20)){
      try{
        const snap=await db.collection('userProfiles').doc(u.uid).collection('sessions').orderBy('timestamp','desc').limit(3).get();
        snap.docs.forEach(d=>sessions.push({...d.data(),userEmail:u.email,userName:u.displayName||u.email,userColor:u.color||COLORS[0]}));
      }catch(e){}
    }
    sessions.sort((a,b)=>b.timestamp-a.timestamp);
    sessions=sessions.slice(0,30);
    if(!sessions.length){list.innerHTML='<div class="empty" style="padding:20px"><p style="font-size:.8rem">لا توجد جلسات بعد</p></div>';return;}
    list.innerHTML=sessions.map(s=>`
      <div class="session-row">
        <span class="si">🔑</span>
        <div style="font-size:.72rem;font-weight:700;width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.userName)}</div>
        <div style="font-size:.68rem;color:var(--muted);flex:1">${new Date(s.timestamp).toLocaleString('ar-EG')}</div>
        <span style="font-size:.65rem;color:var(--muted)">${timeAgo(s.timestamp)}</span>
      </div>`).join('');
  }catch(e){list.innerHTML='<div class="empty" style="padding:20px"><p style="font-size:.75rem;color:var(--cancel)">خطأ في تحميل الجلسات</p></div>';}
}

/* ══ BROADCAST NOTIFICATIONS ══ */
export function populateBroadcastSelect(){
  const sel=document.getElementById('broadcast-user-select');
  if(!sel)return;
  const cur=sel.value;
  sel.innerHTML=`<option value="">+ إضافة مستخدم...</option>`+
    state.allUserProfiles.filter(u=>u.uid!==state.currentUser.uid&&!state.broadcastTargets.find(t=>t.uid===u.uid))
      .map(u=>`<option value="${u.uid}">${esc(u.displayName||u.email)}</option>`).join('');
}

export function addBroadcastTarget(sel){
  const uid=sel.value;
  if(!uid){return;}
  const u=state.allUserProfiles.find(x=>x.uid===uid);
  if(!u||state.broadcastTargets.find(t=>t.uid===uid))return;
  state.broadcastTargets.push({uid:u.uid,name:u.displayName||u.email,color:u.color||COLORS[0]});
  renderBroadcastChips();
  sel.value='';
  populateBroadcastSelect();
}

export function removeBroadcastTarget(uid){
  state.broadcastTargets=state.broadcastTargets.filter(t=>t.uid!==uid);
  renderBroadcastChips();
  populateBroadcastSelect();
}

export function selectAllBroadcast(){
  state.broadcastTargets=state.allUserProfiles.filter(u=>u.uid!==state.currentUser.uid).map(u=>({uid:u.uid,name:u.displayName||u.email,color:u.color||COLORS[0]}));
  renderBroadcastChips();
  populateBroadcastSelect();
}

export function clearBroadcastTargets(){
  state.broadcastTargets=[];
  renderBroadcastChips();
  populateBroadcastSelect();
}

export function renderBroadcastChips(){
  const wrap=document.getElementById('broadcast-targets');
  if(!wrap)return;
  const sel=document.getElementById('broadcast-user-select');
  wrap.innerHTML='';
  state.broadcastTargets.forEach(t=>{
    const chip=document.createElement('div');
    chip.className='target-chip';
    chip.style.background=t.color;
    chip.innerHTML=`<span>${esc(t.name)}</span><span class="tc-remove" onclick="removeBroadcastTarget('${t.uid}')">✕</span>`;
    wrap.appendChild(chip);
  });
  wrap.appendChild(sel||document.createElement('select'));
}

export async function sendBroadcast(){
  if(!state.broadcastTargets.length){toast('اختر مستخدماً على الأقل','err');return;}
  const title=document.getElementById('broadcast-title').value.trim();
  const msg=document.getElementById('broadcast-msg').value.trim();
  if(!title||!msg){toast('يرجى إدخال العنوان والنص','err');return;}
  setSyncStatus('syncing');
  try{
    const batch=db.batch();
    state.broadcastTargets.forEach(t=>{
      const nId=uid();
      batch.set(db.collection('users').doc(t.uid).collection('notifications').doc(nId),{
        id:nId,type:'admin_broadcast',
        title:`📣 ${title}`,body:msg,
        link:{},read:false,createdAt:Date.now(),
        fromUid:state.currentUser.uid,fromName:'المدير العام 👑'
      });
    });
    await batch.commit();
    document.getElementById('broadcast-title').value='';
    document.getElementById('broadcast-msg').value='';
    clearBroadcastTargets();
    toast(`تم إرسال الإشعار لـ ${state.broadcastTargets.length||'الكل'} مستخدم ✓`,'ok');
    setSyncStatus('synced');
  }catch(e){toast('خطأ في الإرسال: '+e.message,'err');setSyncStatus('error');}
}

// Quick notify single user from user list
export function quickNotifUser(targetUid,targetName){
  state.broadcastTargets=[{uid:targetUid,name:targetName,color:COLORS[2]}];
  renderBroadcastChips();
  document.getElementById('broadcast-title').focus();
  // Scroll to broadcast section
  document.querySelector('#page-admin .admin-section').scrollIntoView({behavior:'smooth'});
}

// Change role in workspace from admin panel
export async function adminSetWsRole(wsId,memberUid,newRole){
  setSyncStatus('syncing');
  try{
    await db.collection('workspaces').doc(wsId).collection('members').doc(memberUid).update({role:newRole});
    toast('تم تغيير الدور ✓','ok');setSyncStatus('synced');
  }catch(e){toast('خطأ','err');setSyncStatus('error');}
}

/* ══ CLEAR DEFAULT DATA ══ */
export async function clearAllDefaultData(){
  if(!isSuperAdmin()){toast('غير مصرح','err');return;}
  if(!confirm('⚠️ هل أنت متأكد؟ سيتم حذف كل الموظفين والمهام الشخصية نهائياً.'))return;
  if(!confirm('تأكيد أخير: هذه العملية لا يمكن التراجع عنها!'))return;

  setSyncStatus('syncing');
  let deleted=0;
  try{
    // حذف كل الموظفين
    const empsSnap=await col('employees').get();
    for(const d of empsSnap.docs){await d.ref.delete();deleted++;}

    // حذف كل المهام الشخصية
    const tasksSnap=await col('tasks').get();
    for(const d of tasksSnap.docs){await d.ref.delete();deleted++;}

    toast(`تم مسح ${deleted} سجل بنجاح ✓`,'ok');
    setSyncStatus('synced');
  }catch(e){
    toast('خطأ أثناء المسح: '+e.message,'err');
    setSyncStatus('error');
  }
}

/* ══ ADMIN ROLE SYSTEM ══ */

// فحص دور المستخدم وتهيئة الواجهة

export async function checkAndLoadAdminRole(user){
  const isSA = user.email === SUPER_ADMIN;
  state.isAdmin = isSA;
  try{
    const adminDoc = await db.collection('admins').doc(user.uid).get();
    if(adminDoc.exists && adminDoc.data().active) state.isAdmin = true;
  }catch(e){}

  // واجهة المالك الكاملة
  if(isSA){
    ['admin-nav-hr','admin-nav-label','nav-admin',
     'btn-add-emp','btn-add-emp2','nav-kpi'].forEach(id=>{
      const el=document.getElementById(id);if(el)el.style.display='';
    });
  }
  // واجهة المدير المعيَّن
  if(state.isAdmin && !isSA){
    ['nav-kpi','btn-add-emp','btn-add-emp2'].forEach(id=>{
      const el=document.getElementById(id);if(el)el.style.display='';
    });
  }
  // تحديث label مهام الموظف
  const lbl = document.getElementById('nav-assigned-label');
  if(lbl) lbl.textContent = state.isAdmin ? 'مهام الموظفين' : 'مهامي المُسندة';

  // تحميل بيانات المديرين
  db.collection('admins').onSnapshot(snap=>{
    state.allAdmins = snap.docs.filter(d=>d.data().active).map(d=>d.id);
    if(isSA && state.currentPage==='admin') renderAdminPanel();
  });

  if(isSA) startAdminListener();
  startPresenceTracking();
}

/* ══ ASSIGNED TASKS LISTENER ══ */

export async function promoteToAdmin(targetUid, targetName){
  if(!isSuperAdmin()){toast('غير مصرح','err');return;}
  if(!confirm(`منح "${targetName}" صلاحيات المدير الكاملة؟`)) return;
  setSyncStatus('syncing');
  try{
    await db.collection('admins').doc(targetUid).set({uid:targetUid,name:targetName,addedBy:state.currentUser.uid,addedAt:Date.now(),active:true});
    await createNotif(targetUid,{type:'admin_broadcast',title:'👑 تمت ترقيتك إلى مدير',body:'لديك الآن صلاحيات إدارة الموظفين وإسناد المهام',link:{}});
    toast(`تمت ترقية ${targetName} إلى مدير ✓`,'ok');
    setSyncStatus('synced');
  }catch(e){toast('خطأ: '+e.message,'err');setSyncStatus('error');}
}

export async function revokeAdmin(targetUid, targetName){
  if(!isSuperAdmin()){toast('غير مصرح','err');return;}
  if(!confirm(`إلغاء صلاحيات "${targetName}"؟`)) return;
  setSyncStatus('syncing');
  try{
    await db.collection('admins').doc(targetUid).update({active:false});
    toast(`تم إلغاء صلاحيات ${targetName}`,'inf');
    setSyncStatus('synced');
  }catch(e){toast('خطأ','err');setSyncStatus('error');}
}

/* Override openComments for assigned tasks (use separate collection) */
