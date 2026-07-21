import { db } from '../core/firebase.js';
import { state } from '../core/state.js';
import { esc, uid, col } from '../core/utils.js';
import { toast } from '../ui/toast.js';
import { openModal, closeModal } from '../ui/modal.js';

function findTask(sourceType, taskId){
  if(sourceType==='personal') return state.tasks.find(t=>t.id===taskId);
  if(sourceType==='workspace') return state.wsTasks.find(t=>t.id===taskId);
  if(sourceType==='assigned') return state.assignedTasks.find(t=>t.id===taskId);
}
function getDocRef(sourceType, taskId, wsId){
  if(sourceType==='personal') return col('tasks').doc(taskId);
  if(sourceType==='workspace') return db.collection('workspaces').doc(wsId).collection('tasks').doc(taskId);
  if(sourceType==='assigned') return db.collection('assignedTasks').doc(taskId);
}

// عدد الخطوات المطلوب على الأقل قبل السماح بنقل مهمة لحالة "قيد التنفيذ"
export function hasRequiredSteps(task){
  return (task.steps||[]).length > 0;
}

export function openStepsModal(sourceType, taskId, wsId, title){
  state.stepsCtx = { sourceType, taskId, wsId };
  document.getElementById('steps-modal-title').textContent = `☑️ خطوات: ${title}`;
  renderStepsModal();
  openModal('steps-overlay');
  setTimeout(()=>document.getElementById('step-input')?.focus(), 200);
}

export function renderStepsModal(){
  const ctx = state.stepsCtx;
  if(!ctx) return;
  const task = findTask(ctx.sourceType, ctx.taskId);
  const body = document.getElementById('steps-list-body');
  const addRow = document.getElementById('steps-add-row');
  if(!task || !body) return;
  const steps = task.steps || [];
  const locked = task.status === 'done';
  addRow.style.display = locked ? 'none' : 'block';
  if(!steps.length){
    body.innerHTML = `<div class="empty" style="padding:16px"><div class="ei" style="font-size:1.4rem">📝</div><p style="font-size:.8rem">${locked?'لا توجد خطوات مسجّلة':'لسه مفيش خطوات — أضف أول خطوة تحت'}</p></div>`;
  } else {
    const done = steps.filter(s=>s.done).length;
    body.innerHTML = `<div style="font-size:.75rem;color:var(--muted);margin-bottom:10px">${done} من ${steps.length} خطوة منجزة</div>` +
      steps.map(s=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
        <div class="task-check" style="width:20px;height:20px;flex-shrink:0;${s.done?'background:var(--done);border-color:var(--done)':''}" ${locked?'':`onclick="toggleStep('${s.id}')"`}>${s.done?'✓':''}</div>
        <div style="flex:1;font-size:.83rem;${s.done?'text-decoration:line-through;color:var(--muted)':''}">${esc(s.text)}</div>
        ${locked?'':`<button class="icon-btn del" style="width:24px;height:24px" onclick="deleteStep('${s.id}')">✕</button>`}
      </div>`).join('');
  }
}

export async function addStep(){
  const ctx = state.stepsCtx;
  if(!ctx) return;
  const input = document.getElementById('step-input');
  const text = input.value.trim();
  if(!text) return;
  const task = findTask(ctx.sourceType, ctx.taskId);
  if(!task) return;
  const steps = [...(task.steps||[]), { id: uid(), text, done: false, createdAt: Date.now() }];
  try{
    await getDocRef(ctx.sourceType, ctx.taskId, ctx.wsId).update({ steps });
    input.value = '';
  }catch(e){ toast('خطأ: '+e.message, 'err'); }
}

export async function toggleStep(stepId){
  const ctx = state.stepsCtx;
  if(!ctx) return;
  const task = findTask(ctx.sourceType, ctx.taskId);
  if(!task) return;
  const steps = (task.steps||[]).map(s=>s.id===stepId?{...s,done:!s.done}:s);
  try{ await getDocRef(ctx.sourceType, ctx.taskId, ctx.wsId).update({ steps }); }
  catch(e){ toast('خطأ: '+e.message, 'err'); }
}

export async function deleteStep(stepId){
  const ctx = state.stepsCtx;
  if(!ctx) return;
  const task = findTask(ctx.sourceType, ctx.taskId);
  if(!task) return;
  const steps = (task.steps||[]).filter(s=>s.id!==stepId);
  try{ await getDocRef(ctx.sourceType, ctx.taskId, ctx.wsId).update({ steps }); }
  catch(e){ toast('خطأ: '+e.message, 'err'); }
}
