import { db } from '../core/firebase.js';
import { state } from '../core/state.js';
import { esc, fmtDate, uid } from '../core/utils.js';
import { toast, setSyncStatus } from '../ui/toast.js';
import { openModal, closeModal } from '../ui/modal.js';
import { createNotif } from '../notifications/notifications.js';

export function openWsTaskModal(id=null){
  state.editWsTaskId=id;
  document.getElementById('wt-icon').textContent=id?'✏️':'✦';
  document.getElementById('wt-title').textContent=id?'تعديل المهمة':'إضافة مهمة للمساحة';
  // Populate assignee dropdown
  const sel=document.getElementById('wt-assignee');
  sel.innerHTML='<option value="">— اختر عضواً —</option>'+state.wsMembers.map(m=>`<option value="${m.uid}">${esc(m.displayName||m.email)}</option>`).join('');
  if(id){
    const t=state.wsTasks.find(t=>t.id===id);
    document.getElementById('wt-title-input').value=t.title;
    document.getElementById('wt-desc').value=t.desc||'';
    document.getElementById('wt-assignee').value=t.assignedToUid||'';
    document.getElementById('wt-cat').value=t.cat||'';
    document.getElementById('wt-status').value=t.status;
    document.getElementById('wt-priority').value=t.priority;
    document.getElementById('wt-due').value=t.due||'';
    document.getElementById('wt-notes').value=t.notes||'';
  }else{
    ['wt-title-input','wt-desc','wt-cat','wt-notes'].forEach(i=>document.getElementById(i).value='');
    document.getElementById('wt-assignee').value='';
    document.getElementById('wt-status').value='pending';
    document.getElementById('wt-priority').value='medium';
    document.getElementById('wt-due').value='';
  }
  openModal('ws-task-overlay');
  setTimeout(()=>document.getElementById('wt-title-input').focus(),200);
}
export async function saveWsTask(){
  const title=document.getElementById('wt-title-input').value.trim();
  const desc=document.getElementById('wt-desc').value.trim();
  const assignedToUid=document.getElementById('wt-assignee').value;
  const cat=document.getElementById('wt-cat').value.trim();
  const status=document.getElementById('wt-status').value;
  const priority=document.getElementById('wt-priority').value;
  const due=document.getElementById('wt-due').value;
  const notes=document.getElementById('wt-notes').value.trim();
  if(!title){toast('يرجى إدخال عنوان المهمة','err');return;}
  const assignedMember=state.wsMembers.find(m=>m.uid===assignedToUid);
  const assignedToName=assignedMember?.displayName||assignedMember?.email||'';
  const btn=document.getElementById('wt-save-btn');
  btn.disabled=true;btn.textContent='⏳ جاري الحفظ...';
  setSyncStatus('syncing');
  try{
    if(state.editWsTaskId){
      // تحقق من تغيير الشخص المسند
      const prevTask=state.wsTasks.find(t=>t.id===state.editWsTaskId);
      await db.collection('workspaces').doc(state.currentWs.id).collection('tasks').doc(state.editWsTaskId).update({title,desc,assignedToUid,assignedToName,cat,status,priority,due,notes});
      // إشعار لو تغيّر الشخص المسند
      if(assignedToUid && assignedToUid!==prevTask?.assignedToUid){
        await createNotif(assignedToUid,{
          type:'task_assigned',
          title:'📋 تم إسناد مهمة إليك',
          body:`"${title}" في مساحة ${state.currentWs.name}`,
          link:{wsId:state.currentWs.id,taskId:state.editWsTaskId}
        });
      }
      // إشعار لو تغيّر الإسناد للشخص القديم
      if(prevTask?.assignedToUid && prevTask.assignedToUid!==assignedToUid && prevTask.assignedToUid!==state.currentUser.uid){
        await createNotif(prevTask.assignedToUid,{
          type:'task_updated',
          title:'📝 تم تعديل مهمتك',
          body:`"${title}" — تم إعادة الإسناد`,
          link:{wsId:state.currentWs.id,taskId:state.editWsTaskId}
        });
      }
      toast('تم تحديث المهمة ✓','ok');
    }else{
      const id=uid();
      await db.collection('workspaces').doc(state.currentWs.id).collection('tasks').doc(id).set({id,title,desc,assignedToUid,assignedToName,cat,status,priority,due,notes,createdByUid:state.currentUser.uid,createdByName:state.currentUser.displayName||state.currentUser.email,created:Date.now()});
      // إشعار للموظف المُسند إليه
      if(assignedToUid && assignedToUid!==state.currentUser.uid){
        await createNotif(assignedToUid,{
          type:'task_assigned',
          title:'📋 مهمة جديدة مسندة إليك',
          body:`"${title}" في مساحة ${state.currentWs.name}${due?' — الموعد: '+fmtDate(due):''}`,
          link:{wsId:state.currentWs.id,taskId:id}
        });
      }
      toast('تمت إضافة المهمة ✓','ok');
    }
    closeModal('ws-task-overlay');
  }catch(e){toast('خطأ في الحفظ','err');setSyncStatus('error');}
  finally{btn.disabled=false;btn.innerHTML='💾 حفظ المهمة';}
}

export async function deleteWsTask(id){
  if(!confirm('حذف هذه المهمة؟'))return;
  setSyncStatus('syncing');
  try{await db.collection('workspaces').doc(state.currentWs.id).collection('tasks').doc(id).delete();toast('تم الحذف','err');setSyncStatus('synced');}
  catch(e){toast('خطأ','err');setSyncStatus('error');}
}

export async function toggleWsTaskStatus(id){
  const t=state.wsTasks.find(x=>x.id===id);
  const cycle={pending:'wip',wip:'done',done:'pending',cancelled:'pending'};
  const newStatus=cycle[t.status];
  const statusAr={pending:'معلّقة',wip:'قيد التنفيذ',done:'منتهية',cancelled:'ملغية'};
  setSyncStatus('syncing');
  try{
    await db.collection('workspaces').doc(state.currentWs.id).collection('tasks').doc(id).update({status:newStatus});
    // إشعار: لو الشخص الذي يغيّر ليس هو المُسند إليه → أشعر المسند إليه
    if(t.assignedToUid && t.assignedToUid!==state.currentUser.uid){
      await createNotif(t.assignedToUid,{
        type:'task_status',
        title:'🔄 تغيّرت حالة مهمتك',
        body:`"${t.title}" → ${statusAr[newStatus]}`,
        link:{wsId:state.currentWs.id,taskId:id}
      });
    }
    // إشعار: لو الموظف هو من غيّر → أشعر من أسند المهمة (لو مختلف)
    if(t.assignedToUid===state.currentUser.uid && t.createdByUid && t.createdByUid!==state.currentUser.uid){
      await createNotif(t.createdByUid,{
        type:'task_status',
        title:'✅ موظف حدّث مهمة',
        body:`"${t.title}" → ${statusAr[newStatus]} بواسطة ${state.currentUser.displayName||state.currentUser.email}`,
        link:{wsId:state.currentWs.id,taskId:id}
      });
    }
    setSyncStatus('synced');
  }
  catch(e){setSyncStatus('error');}
}

/* ══ RENDER WORKSPACES PAGE ══ */
