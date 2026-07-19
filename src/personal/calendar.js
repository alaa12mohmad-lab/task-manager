import { state } from '../core/state.js';
import { esc, todayStr } from '../core/utils.js';
import { arMonths } from '../core/constants.js';
import { openTaskModal, openTaskDetail } from './tasks.js';

export function changeMonth(d){state.calMonth+=d;if(state.calMonth>11){state.calMonth=0;state.calYear++;}if(state.calMonth<0){state.calMonth=11;state.calYear--;}renderCal();}
export function renderCal(){
  document.getElementById('cal-label').textContent=`${arMonths[state.calMonth]} ${state.calYear}`;
  const first=new Date(state.calYear,state.calMonth,1).getDay(),days=new Date(state.calYear,state.calMonth+1,0).getDate(),prev=new Date(state.calYear,state.calMonth,0).getDate();
  const tm={};state.tasks.forEach(t=>{if(t.due)(tm[t.due]=tm[t.due]||[]).push(t);});
  let html='';
  for(let i=0;i<42;i++){let day,m=state.calMonth,y=state.calYear,other=false;if(i<first){day=prev-first+i+1;m=state.calMonth-1;if(m<0){m=11;y--;}other=true;}else if(i-first>=days){day=i-first-days+1;m=state.calMonth+1;if(m>11){m=0;y++;}other=true;}else day=i-first+1;const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;const isT=ds===todayStr()&&!other;const dt=(tm[ds]||[]).slice(0,3);const more=(tm[ds]||[]).length>3?`<div class="cal-dot cd-pending">+${(tm[ds].length-3)} أخرى</div>`:'';html+=`<div class="cal-cell ${other?'other':''} ${isT?'today':''}" onclick="calClick('${ds}')"><div class="cal-num">${day}</div>${dt.map(t=>{const cls={pending:'cd-pending',wip:'cd-wip',done:'cd-done',cancelled:'cd-cancelled'};return`<div class="cal-dot ${cls[t.status]}" onclick="event.stopPropagation();openTaskDetail('${t.id}')">${esc(t.title)}</div>`;}).join('')}${more}</div>`;}
  document.getElementById('cal-body').innerHTML=html;
}
export function calClick(ds){openTaskModal(null,ds);}
