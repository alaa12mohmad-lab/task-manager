import { auth, db } from '../core/firebase.js';
import { state } from '../core/state.js';
import { SUPER_ADMIN } from '../core/constants.js';
import { initials, col } from '../core/utils.js';
import { setSyncStatus, setLoadText, hideLoading } from '../ui/toast.js';
import { setBtnLoading } from '../ui/formHelpers.js';
import { renderAll } from '../personal/dashboard.js';
import { startWsListeners } from '../workspaces/workspaces.js';
import { startNotifListener } from '../notifications/notifications.js';
import { startPresenceTracking, updatePresence } from '../presence/presence.js';
import { startAssignedTasksListener } from '../assigned/assignedTasks.js';
import { startChatListener } from '../chat/chat.js';
import { checkAndLoadAdminRole } from '../admin/admin.js';

// Wires Firebase auth state changes to the app's boot/teardown flow.
// Call this once from main.js at startup.
export function initAuth() {
  auth.onAuthStateChanged(user => {
    if (user) { state.currentUser = user; showApp(user); }
    else { state.currentUser = null; stopAllListeners(); showAuthScreen(); }
  });
}

export function showApp(user){
  const isSuper=user.email===SUPER_ADMIN;
  document.getElementById('su-name').textContent=user.displayName||'مستخدم';
  document.getElementById('su-role').innerHTML=isSuper?`<span class="admin-crown">👑 المدير الرئيسي</span>`:user.email;
  document.getElementById('su-av').textContent=initials(user.displayName||user.email);
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app').style.display='flex';
  setLoadText('جاري تحميل بياناتك...');
  state.tasksReady=false;state.empsReady=false;state.seeded=false;
  startPersonalListeners();
  startWsListeners();
  startNotifListener();
  startPresenceTracking();
  // إعداد الواجهة بناءً على دور المستخدم
  startAssignedTasksListener();
  startChatListener();
  checkAndLoadAdminRole(user);
}

export function showAuthScreen(){hideLoading();document.getElementById('app').style.display='none';document.getElementById('auth-screen').style.display='flex';}

export function stopAllListeners(){
  [()=>state.unsubTasks&&state.unsubTasks(),()=>state.unsubEmps&&state.unsubEmps(),()=>state.unsubWorkspaces&&state.unsubWorkspaces(),()=>state.unsubInvites&&state.unsubInvites(),()=>state.unsubWsMembers&&state.unsubWsMembers(),()=>state.unsubWsTasks&&state.unsubWsTasks(),()=>state.unsubNotifs&&state.unsubNotifs(),()=>state.unsubAdminUsers&&state.unsubAdminUsers(),()=>state.unsubAssigned&&state.unsubAssigned(),()=>state.unsubChat&&state.unsubChat()].forEach(f=>f()); if(state.presenceInterval){clearInterval(state.presenceInterval);state.presenceInterval=null;} updatePresence(false).catch(()=>{});
  state.tasks=[];state.emps=[];state.myWorkspaces=[];state.pendingInvites=[];state.wsMembers=[];state.wsTasks=[];
}

/* ══ PERSONAL LISTENERS ══ */
export function startPersonalListeners(){
  state.unsubEmps=col('employees').onSnapshot(snap=>{state.emps=snap.docs.map(d=>({...d.data(),id:d.id}));state.empsReady=true;checkSeeded();if(state.seeded){setSyncStatus('synced');renderAll();}},()=>setSyncStatus('error'));
  state.unsubTasks=col('tasks').orderBy('created','desc').onSnapshot(snap=>{state.tasks=snap.docs.map(d=>({...d.data(),id:d.id}));state.tasksReady=true;checkSeeded();if(state.seeded){setSyncStatus('synced');renderAll();}},()=>setSyncStatus('error'));
}
export function checkSeeded(){
  if(state.tasksReady&&state.empsReady){
    state.seeded=true;setSyncStatus('synced');hideLoading();renderAll();
  }
}

/* ══ AUTH UI ══ */
export function switchTab(t){
  document.querySelectorAll('.auth-tab').forEach((b,i)=>b.classList.toggle('active',i===(t==='login'?0:1)));
  document.getElementById('panel-login').classList.toggle('active',t==='login');
  document.getElementById('panel-register').classList.toggle('active',t==='register');
  clearAuthErrors();
}
export function showAuthErr(id,msg){const el=document.getElementById(id);el.textContent=msg;el.classList.add('show');}
export function clearAuthErrors(){['login-error','reg-error','reset-error','reset-info'].forEach(id=>{const el=document.getElementById(id);if(el){el.textContent='';el.classList.remove('show');}});}
export function togglePw(id,btn){const inp=document.getElementById(id);const s=inp.type==='password';inp.type=s?'text':'password';btn.textContent=s?'🙈':'👁';}
export function showReset(){document.getElementById('auth-main-card').style.display='none';document.getElementById('auth-reset-card').style.display='block';clearAuthErrors();}
export function hideReset(){document.getElementById('auth-reset-card').style.display='none';document.getElementById('auth-main-card').style.display='block';}
export function checkStrength(){
  const pw=document.getElementById('reg-pw').value;
  const bars=['bar1','bar2','bar3','bar4'];
  bars.forEach(b=>document.getElementById(b).className='pw-bar');
  if(!pw){document.getElementById('pw-hint').textContent='أدخل كلمة مرور';return;}
  let s=0;if(pw.length>=8)s++;if(/[A-Z]/.test(pw))s++;if(/[0-9]/.test(pw))s++;if(/[^A-Za-z0-9]/.test(pw))s++;
  const cls=['weak','weak','ok','strong'];const lbs=['ضعيفة جداً','ضعيفة','متوسطة','قوية'];
  for(let i=0;i<s;i++)document.getElementById(bars[i]).className='pw-bar '+cls[s-1];
  document.getElementById('pw-hint').textContent='القوة: '+lbs[s-1];
}

/* ══ AUTH ACTIONS ══ */
export async function doLogin(){
  const email=document.getElementById('login-email').value.trim();
  const pw=document.getElementById('login-pw').value;
  clearAuthErrors();
  if(!email||!pw){showAuthErr('login-error','يرجى ملء جميع الحقول');return;}
  setBtnLoading('login-btn',true);
  try{await auth.signInWithEmailAndPassword(email,pw);}
  catch(e){
    const m={'auth/user-not-found':'البريد غير مسجل','auth/wrong-password':'كلمة المرور غير صحيحة','auth/invalid-credential':'البريد أو كلمة المرور غير صحيحة','auth/too-many-requests':'كثير من المحاولات'};
    showAuthErr('login-error',m[e.code]||'خطأ في تسجيل الدخول');
    setBtnLoading('login-btn',false,'<span>🔑</span> دخول');
  }
}
export async function doRegister(){
  const name=document.getElementById('reg-name').value.trim();
  const email=document.getElementById('reg-email').value.trim();
  const pw=document.getElementById('reg-pw').value;
  const pw2=document.getElementById('reg-pw2').value;
  clearAuthErrors();
  if(!name||!email||!pw||!pw2){showAuthErr('reg-error','يرجى ملء جميع الحقول');return;}
  if(pw!==pw2){showAuthErr('reg-error','كلمتا المرور غير متطابقتين');return;}
  if(pw.length<8){showAuthErr('reg-error','كلمة المرور يجب أن تكون 8 أحرف على الأقل');return;}
  setBtnLoading('reg-btn',true);
  try{const c=await auth.createUserWithEmailAndPassword(email,pw);await c.user.updateProfile({displayName:name});}
  catch(e){
    const m={'auth/email-already-in-use':'هذا البريد مسجل مسبقاً','auth/invalid-email':'البريد غير صالح','auth/weak-password':'كلمة المرور ضعيفة'};
    showAuthErr('reg-error',m[e.code]||'خطأ في إنشاء الحساب');
    setBtnLoading('reg-btn',false,'<span>✨</span> إنشاء حساب');
  }
}
export async function doReset(){
  const email=document.getElementById('reset-email').value.trim();
  clearAuthErrors();
  if(!email){showAuthErr('reset-error','أدخل البريد الإلكتروني');return;}
  setBtnLoading('reset-btn',true);
  try{
    await auth.sendPasswordResetEmail(email);
    const i=document.getElementById('reset-info');i.textContent='✅ تم إرسال رابط الاستعادة على بريدك';i.classList.add('show');
  }catch(e){
    const m={'auth/user-not-found':'هذا البريد غير مسجل','auth/invalid-email':'البريد غير صالح'};
    showAuthErr('reset-error',m[e.code]||'خطأ في إرسال البريد');
  }finally{setBtnLoading('reset-btn',false,'<span>📧</span> إرسال رابط الاستعادة');}
}
export async function doLogout(){if(!confirm('هل تريد تسجيل الخروج؟'))return;stopAllListeners();await auth.signOut();}
