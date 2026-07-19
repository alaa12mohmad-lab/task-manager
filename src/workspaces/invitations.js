import { db, firebase } from '../core/firebase.js';
import { state } from '../core/state.js';
import { uid } from '../core/utils.js';
import { COLORS } from '../core/constants.js';
import { toast, setSyncStatus } from '../ui/toast.js';
import { openModal } from '../ui/modal.js';
import { setBtnLoading } from '../ui/formHelpers.js';
import { createNotif } from '../notifications/notifications.js';

export function openInviteModal(){
  state.inviteWsId=state.currentWs?.id;
  document.getElementById('invite-email-input').value='';
  ['invite-error','invite-info'].forEach(id=>{const el=document.getElementById(id);el.textContent='';el.classList.remove('show');});
  openModal('invite-overlay');
  setTimeout(()=>document.getElementById('invite-email-input').focus(),200);
}
export async function sendInvitation(){
  const email=document.getElementById('invite-email-input').value.trim().toLowerCase();
  ['invite-error','invite-info'].forEach(id=>{const el=document.getElementById(id);el.textContent='';el.classList.remove('show');});
  if(!email){const el=document.getElementById('invite-error');el.textContent='يرجى إدخال البريد الإلكتروني';el.classList.add('show');return;}
  if(email===state.currentUser.email){const el=document.getElementById('invite-error');el.textContent='لا يمكنك دعوة نفسك';el.classList.add('show');return;}
  // Check already member
  if(state.wsMembers.some(m=>m.email===email)){const el=document.getElementById('invite-error');el.textContent='هذا المستخدم عضو بالفعل في المساحة';el.classList.add('show');return;}
  setBtnLoading('invite-btn',true);
  setSyncStatus('syncing');
  try{
    const invId=uid();
    // محاولة التحقق من الدعوات المكررة (قد تفشل بسبب قواعد Firestore - نتجاهل الخطأ)
    try{
      const existing=await db.collection('invitations')
        .where('workspaceId','==',state.inviteWsId)
        .where('inviteeEmail','==',email)
        .where('status','==','pending').get();
      if(!existing.empty){
        const el=document.getElementById('invite-error');
        el.textContent='تم إرسال دعوة لهذا البريد مسبقاً';
        el.classList.add('show');
        return;
      }
    }catch(readErr){
      // قواعد Firestore لا تسمح بالقراءة - نكمل الإرسال
      console.warn('Duplicate check skipped:', readErr.code);
    }
    await db.collection('invitations').doc(invId).set({
      id:invId,
      workspaceId:state.inviteWsId,
      workspaceName:state.currentWs.name,
      invitedByUid:state.currentUser.uid,
      invitedByName:state.currentUser.displayName||state.currentUser.email,
      inviteeEmail:email,
      status:'pending',
      createdAt:Date.now()
    });
    const el=document.getElementById('invite-info');
    el.textContent='✅ تم إرسال الدعوة بنجاح، سيراها عند دخوله التالي';
    el.classList.add('show');
    document.getElementById('invite-email-input').value='';
    toast('تم إرسال الدعوة ✓','ok');
    setSyncStatus('synced');
  }catch(e){
    console.error('sendInvitation error:',e);
    const el=document.getElementById('invite-error');
    el.textContent='خطأ: '+(e.code==='permission-denied'?'تأكد من إعدادات Firestore':e.message);
    el.classList.add('show');
    setSyncStatus('error');
  }
  finally{setBtnLoading('invite-btn',false,'✉️ إرسال الدعوة');}
}

// Accept invitation
export async function acceptInvite(invId){
  const inv=state.pendingInvites.find(i=>i.id===invId);
  if(!inv)return;

  // منع تكرار القبول
  const btn=document.querySelector(`[onclick="acceptInvite('${invId}')"]`);
  if(btn){btn.disabled=true;btn.textContent='⏳';}
  setSyncStatus('syncing');

  try{
    const color=COLORS[Math.floor(Math.random()*COLORS.length)];
    const memberData={
      uid:state.currentUser.uid,
      email:state.currentUser.email,
      displayName:state.currentUser.displayName||state.currentUser.email,
      role:'member',
      joinedAt:Date.now(),
      color
    };

    // ── الخطوة 1: إنشاء سجل العضو مباشرة (القاعدة: allow create if uid==memberId) ──
    await db.collection('workspaces')
      .doc(inv.workspaceId)
      .collection('members')
      .doc(state.currentUser.uid)
      .set(memberData);

    // ── الخطوة 2: إضافة uid لمصفوفة memberUids ──
    await db.collection('workspaces')
      .doc(inv.workspaceId)
      .update({ memberUids: firebase.firestore.FieldValue.arrayUnion(state.currentUser.uid) });

    // ── الخطوة 3: تحديث حالة الدعوة ──
    await db.collection('invitations').doc(invId).update({status:'accepted'});

    // ── الخطوة 4: إشعار للمُرسل ──
    await createNotif(inv.invitedByUid,{
      type:'ws_invite',
      title:`🎉 ${state.currentUser.displayName||state.currentUser.email} قبل الدعوة`,
      body:`انضم إلى مساحة "${inv.workspaceName}"`,
      link:{wsId:inv.workspaceId}
    });

    toast(`انضممت إلى "${inv.workspaceName}" بنجاح ✓`,'ok');
    setSyncStatus('synced');

  }catch(e){
    console.error('acceptInvite error:', e.code, e.message);
    let msg = 'خطأ في قبول الدعوة';
    if(e.code==='permission-denied'){
      msg = '⚠️ خطأ في الصلاحيات — راجع قواعد Firestore (انظر التعليمات)';
    }else if(e.code==='not-found'){
      msg = 'الدعوة أو المساحة غير موجودة';
    }
    toast(msg,'err');
    setSyncStatus('error');
    if(btn){btn.disabled=false;btn.textContent='✓ قبول';}
  }
}

// Reject invitation
export async function rejectInvite(invId){
  setSyncStatus('syncing');
  try{await db.collection('invitations').doc(invId).update({status:'rejected'});toast('تم رفض الدعوة','inf');}
  catch(e){toast('خطأ','err');}
}

// Change member role (super admin / workspace owner only)
