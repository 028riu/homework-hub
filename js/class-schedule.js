import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig, { name: "homework-hub-class-schedule" });
const db = getFirestore(app);
const $ = id => document.getElementById(id);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const clean = v => String(v ?? "").trim();
const days = ["Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6"];
const slots = [
  {key:"p1",label:"Tiết 1"},{key:"p2",label:"Tiết 2"},{key:"p3",label:"Tiết 3"},{key:"p4",label:"Tiết 4"},
  {key:"lunch",label:"🍱 Nghỉ trưa"},{key:"p5",label:"Tiết 5"},{key:"p6",label:"Tiết 6"},{key:"p7",label:"Tiết 7"}
];
function pad(n){return String(n).padStart(2,"0")}
function dateKey(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function today(){const d=new Date();d.setHours(12,0,0,0);return d}
function monday(input){const d=new Date(input);d.setHours(12,0,0,0);const day=d.getDay();d.setDate(d.getDate()+(day===0?-6:1-day));return d}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function normalize(raw,id="",slotFromId=""){
  const x=raw||{};
  return {...x,id,slot:clean(x.slot||x.period||x.lessonSlot||slotFromId),subject:clean(x.subject||x.subjectName||x.course||x.courseName||x.mon||x.monHoc||x.name),lesson:clean(x.lesson||x.content||x.description||x.topic||x.noiDung||x.noi_dung),teacher:clean(x.teacher||x.teacherName||x.tutor||x.giaoVien||x.giao_vien),note:clean(x.note||x.notes||x.reminder||x.dặnDò||x.danDo||x.dan_do)};
}
function meaningful(x){return !!(x?.subject||x?.lesson||x?.teacher||x?.note)}
function slotLabel(k){return slots.find(s=>s.key===k)?.label||k||"Tiết học"}
function dateText(d){return d.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"})}
function fullDate(d){return d.toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"})}
const map=new Map();
let weekStart=monday(new Date());
let selectedDate=dateKey(today());
function weekDates(){return days.map((_,i)=>addDays(weekStart,i))}
function itemsForDate(d){const key=dateKey(d);return slots.map(s=>normalize(map.get(`${key}_${s.key}`),`${key}_${s.key}`,s.key)).filter(meaningful)}
function cell(d,s){const x=normalize(map.get(`${dateKey(d)}_${s.key}`),"",s.key);return meaningful(x)?`<div class="schedule-week-cell filled"><b>${esc(x.subject||"Chưa ghi môn")}</b>${x.lesson?`<span>${esc(x.lesson)}</span>`:""}${x.teacher?`<small>👨‍🏫 ${esc(x.teacher)}</small>`:""}</div>`:`<div class="schedule-week-cell empty"><span>—</span></div>`}
function renderWeekly(){
  const box=$("classScheduleWeekly");if(!box)return;
  const dates=weekDates();
  box.innerHTML=`<div class="schedule-week-head"><button type="button" class="schedule-nav-btn" id="scheduleWeekPrev">‹</button><div><b>📅 Tuần ${dateText(dates[0])} — ${dateText(dates[4])}</b><small>Thời khóa biểu được lưu theo từng tuần</small></div><button type="button" class="schedule-nav-btn" id="scheduleWeekNext">›</button></div><div class="schedule-week-wrap"><table class="schedule-week-table"><thead><tr><th>Tiết</th>${dates.map((d,i)=>`<th class="${dateKey(d)===dateKey(today())?'is-today':''}">${days[i]}<small>${dateText(d)}</small></th>`).join("")}</tr></thead><tbody>${slots.map(s=>`<tr><th>${esc(s.label)}</th>${dates.map(d=>`<td>${cell(d,s)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  $("scheduleWeekPrev")?.addEventListener("click",()=>{weekStart=addDays(weekStart,-7);renderWeekly()});
  $("scheduleWeekNext")?.addEventListener("click",()=>{weekStart=addDays(weekStart,7);renderWeekly()});
}
function renderToday(){
  const items=itemsForDate(today());
  const html=items.length?items.map(x=>`<article class="schedule-today-card"><div class="schedule-slot">${esc(slotLabel(x.slot))}</div><div class="schedule-body"><div class="schedule-subject-label">MÔN HỌC</div><h3 class="schedule-subject">📚 ${esc(x.subject||"Chưa ghi tên môn")}</h3>${x.lesson?`<p><strong>📖 Nội dung:</strong> ${esc(x.lesson)}</p>`:""}${x.teacher?`<small>👨‍🏫 Thầy cô: ${esc(x.teacher)}</small>`:""}${x.note?`<small>💬 Dặn dò: ${esc(x.note)}</small>`:""}</div></article>`).join(""):"<div class=\"schedule-no-data\">📭 Chưa có nội dung học trên lớp cho hôm nay.</div>";
  if($("classScheduleTodayList"))$("classScheduleTodayList").innerHTML=html;
}
function renderBmeToday(){
  const box=$("bmeClassScheduleList");if(!box)return;
  const items=itemsForDate(today());
  box.innerHTML=items.length?items.map(x=>`<article class="bme-class-row"><div class="bme-class-meta"><b>${esc(slotLabel(x.slot))}</b><span>📚 ${esc(x.subject||"Chưa ghi tên môn")}</span></div><section>${x.lesson?`<p><strong>📖 Nội dung:</strong> ${esc(x.lesson)}</p>`:""}${x.teacher?`<p><strong>👨‍🏫 Thầy cô:</strong> ${esc(x.teacher)}</p>`:""}${x.note?`<p><strong>💬 Dặn dò:</strong> ${esc(x.note)}</p>`:""}</section></article>`).join(""):"<div class=\"schedule-no-data\">📭 Chưa có dữ liệu học trên lớp hôm nay.</div>";
}
function ensureWeeklyUI(){
  if($("classScheduleWeekly")) renderWeekly();
  const dialog=$("classScheduleDialog");
  if(dialog&&!$("classScheduleWeekly")){
    const inner=dialog.querySelector(".modal")||dialog;
    const weekly=document.createElement("section");weekly.className="schedule-week-section";weekly.innerHTML=`<div class="schedule-section-title"><div><p class="eyebrow">WEEKLY SCHEDULE</p><h3>📋 Thời khóa biểu</h3><p class="muted">Xem toàn bộ tuần, tuần trước và tuần sau.</p></div></div><div id="classScheduleWeekly"></div>`;inner.appendChild(weekly);
  }
  if($("classScheduleDialog")){
    $("classScheduleDialog").addEventListener("close",()=>{weekStart=monday(new Date());renderWeekly()});
  }
}
function initStudent(){
  const launcher=$("classScheduleLauncher"),dialog=$("classScheduleDialog");if(!launcher||!dialog)return;
  ensureWeeklyUI();
  let sx=null,sy=null,moved=false;
  launcher.addEventListener("pointerdown",e=>{sx=e.clientX;sy=e.clientY;moved=false;launcher.setPointerCapture?.(e.pointerId)});
  launcher.addEventListener("pointermove",e=>{if(sx==null)return;const dx=e.clientX-sx,dy=e.clientY-sy;if(Math.abs(dx)+Math.abs(dy)>8)moved=true});
  launcher.addEventListener("pointerup",()=>{if(!moved)dialog.showModal();sx=null});
  $("closeClassSchedule")?.addEventListener("click",()=>dialog.close());
}
onSnapshot(collection(db,"class_schedule"),snap=>{
  map.clear();snap.docs.forEach(d=>map.set(d.id,normalize(d.data(),d.id,d.data()?.slot)));
  renderToday();renderBmeToday();renderWeekly();
},err=>{
  console.error("Homework Hub class schedule:",err);
  const html='<div class="schedule-no-data">❌ Không thể tải nội dung học trên lớp.</div>';
  if($("classScheduleTodayList"))$("classScheduleTodayList").innerHTML=html;
  if($("bmeClassScheduleList"))$("bmeClassScheduleList").innerHTML=html;
});
ensureWeeklyUI();
initStudent();
