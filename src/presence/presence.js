import { db } from '../core/firebase.js';
import { state } from '../core/state.js';
import { uid } from '../core/utils.js';
import { SUPER_ADMIN } from '../core/constants.js';
import { startAdminListener } from '../admin/admin.js';

export async function updatePresence(online){
  if(!state.currentUser)return;
  try{
    const ref = db.collection('userProfiles').doc(state.currentUser.uid);
    const data={
      uid:state.currentUser.uid,
      email:state.currentUser.email,
      isOnline:online,
      lastSeen:Date.now()
    };
    if(online) data.lastLogin=Date.now();
    else        data.lastLogout=Date.now();
    // الاسم المعروض بيتحدد أول مرة بس (لما البروفايل يتعمل لأول مرة)؛ بعد كده بيفضل تحت
    // تحكم "بروفايلي" أو تعديل المدير حصرياً، من غير ما نظام تتبع الحضور يلمسه تاني.
    const existing = await ref.get();
    if(!existing.exists || existing.data().displayName===undefined){
      data.displayName = state.currentUser.displayName || state.currentUser.email;
    }
    await ref.set(data,{merge:true});
    // حفظ جلسة كاملة عند الدخول فقط
    if(online){
      const sId=uid();
      await db.collection('userProfiles').doc(state.currentUser.uid).collection('sessions').doc(sId).set({
        id:sId,action:'login',timestamp:Date.now(),
        email:state.currentUser.email,name:state.currentUser.displayName||state.currentUser.email
      });
    }
  }catch(e){console.warn('presence update failed:',e);}
}

export function startPresenceTracking(){
  updatePresence(true);
  // Heartbeat every 90 seconds
  state.presenceInterval=setInterval(()=>{if(state.currentUser)updatePresence(true);},90000);
  // Mark offline on page hide
  document.addEventListener('visibilitychange',()=>{
    if(!state.currentUser)return;
    if(document.visibilityState==='hidden') updatePresence(false);
    else updatePresence(true);
  },{once:false});
  // Mark offline on page unload
  window.addEventListener('beforeunload',()=>{
    if(state.currentUser) updatePresence(false);
  });
  // Start admin listener if super admin
  if(state.currentUser.email===SUPER_ADMIN) startAdminListener();
}

