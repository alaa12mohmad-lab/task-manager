import { db, firebase } from '../core/firebase.js';
import { state } from '../core/state.js';
import { toast, setSyncStatus } from '../ui/toast.js';

export async function changeMemberRole(uid,newRole){
  setSyncStatus('syncing');
  try{await db.collection('workspaces').doc(state.currentWs.id).collection('members').doc(uid).update({role:newRole});toast('تم تغيير الدور ✓','ok');setSyncStatus('synced');}
  catch(e){toast('خطأ في تغيير الدور','err');setSyncStatus('error');}
}

// Remove member
export async function removeMember(uid){
  if(!confirm('إزالة هذا العضو من المساحة؟'))return;
  setSyncStatus('syncing');
  try{
    const batch=db.batch();
    batch.delete(db.collection('workspaces').doc(state.currentWs.id).collection('members').doc(uid));
    batch.update(db.collection('workspaces').doc(state.currentWs.id),{memberUids:firebase.firestore.FieldValue.arrayRemove(uid)});
    await batch.commit();
    toast('تم إزالة العضو','err');setSyncStatus('synced');
  }catch(e){toast('خطأ','err');setSyncStatus('error');}
}
