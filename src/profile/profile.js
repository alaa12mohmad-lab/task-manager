import { db } from '../core/firebase.js';
import { state } from '../core/state.js';
import { esc, initials } from '../core/utils.js';
import { COLORS } from '../core/constants.js';
import { toast } from '../ui/toast.js';

export function renderProfilePage(){
  const wrap = document.getElementById('profile-page-content');
  if(!wrap || !state.currentUser) return;
  // نجيب النسخة المُخزّنة الحالية من userProfiles لو موجودة (allUserProfiles بيتحدث لأي مستخدم مسجّل دخول)
  const mine = state.allUserProfiles.find(u=>u.uid===state.currentUser.uid);
  const currentName = mine?.displayName || state.currentUser.displayName || state.currentUser.email;
  if(state.myProfileColor===null) state.myProfileColor = mine?.color || COLORS[0];

  wrap.innerHTML = `
    <div style="max-width:420px">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:22px">
        <div style="width:60px;height:60px;border-radius:50%;background:${state.myProfileColor};display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:700;color:#fff" id="profile-av-preview">${initials(currentName)}</div>
        <div>
          <div style="font-weight:700;font-size:1rem">${esc(currentName)}</div>
          <div style="font-size:.78rem;color:var(--muted)">${esc(state.currentUser.email)}</div>
        </div>
      </div>
      <div class="fg"><label>الاسم المعروض</label><input class="fi" id="my-profile-name" type="text" value="${esc(currentName)}"></div>
      <div class="fg"><label>اللون المميز</label><div class="color-row" id="my-profile-color-row"></div></div>
      <div style="font-size:.72rem;color:var(--muted);margin:10px 0 18px">البريد الإلكتروني مربوط بحساب الدخول ومينفعش يتغيّر من هنا.</div>
      <button class="btn btn-primary" onclick="saveMyProfile()">💾 حفظ التعديلات</button>
    </div>`;
  buildMyProfileColorRow();
}

export function buildMyProfileColorRow(){
  const row = document.getElementById('my-profile-color-row');
  if(!row) return;
  row.innerHTML = COLORS.map(c=>`<div class="color-opt ${c===state.myProfileColor?'selected':''}" style="background:${c}" onclick="selectMyProfileColor('${c}')"></div>`).join('');
}

export function selectMyProfileColor(c){
  state.myProfileColor = c;
  buildMyProfileColorRow();
  const preview = document.getElementById('profile-av-preview');
  if(preview) preview.style.background = c;
}

export async function saveMyProfile(){
  const name = document.getElementById('my-profile-name').value.trim();
  if(!name){ toast('يرجى إدخال اسم', 'err'); return; }
  try{
    await db.collection('userProfiles').doc(state.currentUser.uid).set({
      displayName: name, color: state.myProfileColor
    }, { merge: true });
    const suName=document.getElementById('su-name');
    const suAv=document.getElementById('su-av');
    if(suName) suName.textContent=name;
    if(suAv){ suAv.textContent=initials(name); suAv.style.background=state.myProfileColor; }
    toast('تم حفظ بياناتك ✓', 'ok');
  }catch(e){ toast('خطأ: '+e.message, 'err'); }
}
