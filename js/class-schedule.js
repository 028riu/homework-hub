import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig, {name:"homework-hub-class-schedule"});
const db = getFirestore(app);
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slots=[
  {key:'p1',label:'Tiết 1'}, {key:'p2',label:'Tiết 2'}, {key:'p3',label:'Tiết 3'},
  {key:'p4',label:'Tiết 4'}, {key:'lunch',label:'🍱 Nghỉ trưa'},
  {key:'p5',label:'Tiết 5'}, {key:'p6',label:'Tiết 6'}, {key:'p7',label:'Tiết 7'}
];
function pad(n){return String(n).padStart(2,'0')}
function dateKey(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function monday(d){const x=new Date(d);x.setHours(12,0,0,0);const day=x.getDay();x.setDate(x.getDate()+(day===0?-6:1-day));return x}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function today(){const x=new Date();x.setHours(12,0,0,0);return x}
function slotTitle(key){return slots.find(x=>x.key===key)?.label||key}
function todayItems(map){const date=dateKey(today());return slots.map(s=>({slot:s,...(map.get(`${date}_${s.key}`)||{})})).filter(x=>x.subject||x.lesson||x.teacher||x.note)}
function renderStudent(map){
  const list=$('classScheduleTodayList'); if(!list)return;
  const items=todayItems(map);
  if(!items.length){list.innerHTML='<div class="schedule-no-data">📭 Chưa có nội dung học trên lớp cho hôm nay.</div>';return;}
  list.innerHTML=items.map(x=>`<article class="schedule-today-card"><div class="schedule-slot">${x.slot.label}</div><div class="schedule-body"><b>${esc(x.subject||'Chưa ghi môn')}</b>${x.lesson?`<p>${esc(x.lesson)}</p>`:''}${x.teacher?`<small>👨‍🏫 ${esc(x.teacher)}</small>`:''}${x.note?`<small>💬 ${esc(x.note)}</small>`:''}</div></article>`).join('');
}
function renderBme(map){
  const box=$('bmeClassScheduleList');if(!box)return;
  const items=todayItems(map);
  box.innerHTML=items.length?items.map(x=>`<article class="bme-class-row"><div><b>${esc(x.slot.label)}</b><span>${esc(x.subject||'')}</span></div><section>${x.lesson?`<p><strong>📖 Nội dung:</strong> ${esc(x.lesson)}</p>`:''}${x.teacher?`<p><strong>👨‍🏫 Thầy cô:</strong> ${esc(x.teacher)}</p>`:''}${x.note?`<p><strong>💬 Dặn dò:</strong> ${esc(x.note)}</p>`:''}</section></article>`).join(''):'<div class="schedule-no-data">📭 Chưa có dữ liệu học trên lớp hôm nay.</div>';
}
function initStudent(){
  const launcher=$('classScheduleLauncher'),dialog=$('classScheduleDialog');
  if(!launcher||!dialog)return;
  launcher.addEventListener('pointerdown',e=>{launcher.dataset.dragging='0';launcher._sx=e.clientX;launcher._sy=e.clientY;launcher._sl=parseFloat(getComputedStyle(launcher).left)||82;launcher._st=parseFloat(getComputedStyle(launcher).top)||72;launcher.setPointerCapture?.(e.pointerId)});
  launcher.addEventListener('pointermove',e=>{if(launcher._sx==null)return;const dx=e.clientX-launcher._sx,dy=e.clientY-launcher._sy;if(Math.abs(dx)+Math.abs(dy)>8){launcher.dataset.dragging='1';launcher.style.left=Math.max(2,Math.min(96,launcher._sl+dx/innerWidth*100))+'%';launcher.style.top=Math.max(8,Math.min(90,launcher._st+dy/innerHeight*100))+'%';}});
  launcher.addEventListener('pointerup',()=>{if(launcher.dataset.dragging==='1'){launcher._sx=null;return;}launcher._sx=null;dialog.showModal();});
  $('closeClassSchedule')?.addEventListener('click',()=>dialog.close());
}
const map=new Map();
onSnapshot(collection(db,'class_schedule'),snap=>{map.clear();snap.docs.forEach(d=>map.set(d.id,{id:d.id,...d.data()}));renderStudent(map);renderBme(map);},err=>{console.error('Homework Hub class schedule:',err);$('classScheduleTodayList')?.replaceChildren(Object.assign(document.createElement('div'),{className:'schedule-no-data',textContent:'❌ Không thể tải nội dung học trên lớp.'}));$('bmeClassScheduleList')?.replaceChildren(Object.assign(document.createElement('div'),{className:'schedule-no-data',textContent:'❌ Không thể tải nội dung học trên lớp.'}));});
initStudent();
