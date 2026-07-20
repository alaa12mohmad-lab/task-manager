import { db } from '../core/firebase.js';
import { state } from '../core/state.js';
import { esc, initials } from '../core/utils.js';
import { COLORS } from '../core/constants.js';
import { toast } from '../ui/toast.js';

export function buildChatRooms(){
  const rooms = [{id:'general',name:'عام 🌐',icon:'🌐',color:'#4f8ef7',desc:'مجموعة العمل'}];
  // غرفة خاصة مع كل شخص (DM)
  state.allUserProfiles.filter(u=>u.uid!==state.currentUser.uid).forEach(u=>{
    rooms.push({id:'dm_'+[state.currentUser.uid,u.uid].sort().join('_'),name:u.displayName||u.email,icon:null,color:u.color||COLORS[0],isPrivate:true,otherUid:u.uid,otherName:u.displayName||u.email});
  });
  state.chatRooms = rooms;
}

export function startChatListener(){
  // Real-time للغرفة العامة فقط للبدء
  // نضيف listener حسب الغرفة المفتوحة
}

export function renderChatRooms(){
  buildChatRooms();
  const list = document.getElementById('chat-rooms-list');
  if(!list) return;
  list.innerHTML = state.chatRooms.map(r=>`
    <div class="chat-room-item ${state.currentChatRoom===r.id?'active':''}" onclick="loadChatRoom('${r.id}')">
      <div class="chat-room-av" style="background:${r.color}">${r.icon||initials(r.name)}</div>
      <div class="chat-room-info">
        <div class="chat-room-name">${esc(r.name)}</div>
        <div class="chat-room-preview">${r.isPrivate?'محادثة خاصة':'مجموعة'}</div>
      </div>
    </div>`).join('');
  // Auto-open general if nothing open
  if(!state.currentChatRoom) loadChatRoom('general');
}

export function closeChatRoom(){
  document.getElementById('chat-layout')?.classList.remove('room-open');
}

export function loadChatRoom(roomId){
  state.currentChatRoom = roomId;
  const room = state.chatRooms.find(r=>r.id===roomId);
  // Update head
  const head = document.getElementById('chat-head');
  if(head && room) head.innerHTML = `<button class="chat-back-btn" onclick="closeChatRoom()">◀</button><div class="chat-room-av" style="background:${room.color};width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;color:#fff;flex-shrink:0">${room.icon||initials(room.name)}</div><div class="chat-head-name">${esc(room.name)}</div>`;
  // على الموبايل: نظهر نافذة الرسائل بس ونخبي قائمة المحادثات (بدل ما يتزنقوا جنب بعض)
  document.getElementById('chat-layout')?.classList.add('room-open');
  // Show input
  const inp = document.getElementById('chat-input-row');
  if(inp) inp.style.display='flex';
  // Re-render rooms to update active
  const items = document.querySelectorAll('.chat-room-item');
  items.forEach((el,i)=>{el.classList.toggle('active', state.chatRooms[i]?.id===roomId);});
  // Unsubscribe old
  if(state.unsubChatMsg){state.unsubChatMsg();state.unsubChatMsg=null;}
  // Subscribe to messages
  const msgs = document.getElementById('chat-messages');
  if(msgs) msgs.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:.8rem">جاري التحميل...</div>';
  state.unsubChatMsg = db.collection('chats').doc(roomId).collection('messages')
    .orderBy('createdAt','asc').limit(100)
    .onSnapshot(snap=>{
      state.chatMessages = snap.docs.map(d=>({...d.data(),id:d.id}));
      renderChatMessages();
    }, err=>{if(msgs) msgs.innerHTML='<div class="empty"><div class="ei">❌</div><p style="font-size:.8rem">خطأ في تحميل الرسائل</p></div>';});
}

export function renderChatMessages(){
  const wrap = document.getElementById('chat-messages');
  if(!wrap) return;
  if(!state.chatMessages.length){wrap.innerHTML='<div class="empty" style="margin:auto"><div class="ei">💬</div><p>لا توجد رسائل بعد</p><small>كن أول من يكتب!</small></div>';return;}
  let lastDate = '';
  wrap.innerHTML = state.chatMessages.map(m=>{
    const isMe = m.senderUid === state.currentUser.uid;
    const color= m.senderColor||COLORS[2];
    const d = new Date(m.createdAt);
    const dateStr = d.toLocaleDateString('ar-EG');
    let sep = '';
    if(dateStr!==lastDate){sep=`<div class="chat-date-sep">${dateStr}</div>`;lastDate=dateStr;}
    return sep+`<div class="chat-msg ${isMe?'me':''}">
      ${!isMe?`<div class="chat-msg-av" style="background:${color}">${initials(m.senderName)}</div>`:''}
      <div>
        ${!isMe?`<div style="font-size:.65rem;color:${color};font-weight:700;margin-bottom:3px">${esc(m.senderName)}</div>`:''}
        <div class="chat-bubble">${esc(m.text)}</div>
        <div class="chat-msg-time">${d.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}</div>
      </div>
      ${isMe?`<div class="chat-msg-av" style="background:${color}">${initials(m.senderName)}</div>`:''}
    </div>`;
  }).join('');
  wrap.scrollTop = wrap.scrollHeight;
}

export async function sendChatMsg(){
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if(!text||!state.currentChatRoom) return;
  const btn = document.getElementById('chat-send-btn');
  btn.disabled=true;
  const myProfile = state.allUserProfiles.find(u=>u.uid===state.currentUser.uid);
  try{
    await db.collection('chats').doc(state.currentChatRoom).collection('messages').add({
      text,
      senderUid:state.currentUser.uid,
      senderName:state.currentUser.displayName||state.currentUser.email,
      senderColor:myProfile?.color||COLORS[3],
      createdAt:Date.now()
    });
    input.value='';
    input.style.height='auto';
  }catch(e){toast('خطأ في الإرسال','err');}
  finally{btn.disabled=false;}
}

export function chatKeydown(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChatMsg();}}
export function autoResizeChatInput(ta){ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,110)+'px';}

