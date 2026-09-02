import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const $ = id => document.getElementById(id);

const slots = [
  {key:"p1",label:"Tiết 1"},{key:"p2",label:"Tiết 2"},{key:"p3",label:"Tiết 3"},{key:"p4",label:"Tiết 4"},
  {key:"lunch",label:"Nghỉ trưa"},{key:"p5",label:"Tiết 5"},{key:"p6",label:"Tiết 6"},{key:"p7",label:"Tiết 7"}
];
const days = ["Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6"];
const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const clean = v => String(v ?? "").trim();

function normalize(raw,id="") {
  const x = raw || {};
  return {
    id,
    date: clean(x.date || x.day || id.split("_")[0]),
    slot: clean(x.slot || x.period || x.tiet || id.split("_").slice(1).join("_")),
    subject: clean(x.subject || x.subjectName || x.course || x.courseName || x.mon || x.monHoc || x.name),
    lesson: clean(x.lesson || x.content || x.description || x.topic || x.noiDung || x.noi_dung),
    teacher: clean(x.teacher || x.teacherName || x.tutor || x.giaoVien || x.giao_vien),
    note: clean(x.note || x.notes || x.reminder || x.danDo || x.dan_do)
  };
}
function pad(n){return String(n).padStart(2,"0")}
function keyDate(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function monday(d){const x=new Date(d);x.setHours(12,0,0,0);const n=x.getDay();x.setDate(x.getDate()+(n===0?-6:1-n));return x}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function valid(x){return !!(x && (x.subject || x.lesson || x.teacher || x.note));}

const map = new Map();
let bmeWeek = monday(new Date());

function renderToday(){
  const today=keyDate(new Date());
  const arr=[...map.values()].filter(x=>x.date===today&&valid(x)).sort((a,b)=>{
    const ai=slots.findIndex(s=>s.key===a.slot),bi=slots.findIndex(s=>s.key===b.slot); return ai-bi;
  });
  const out=arr.length?arr.map(x=>`<article class="schedule-today-card"><div class="schedule-slot">${esc(slots.find(s=>s.key===x.slot)?.label||x.slot||"Tiết")}</div><div class="schedule-body"><div class="schedule-subject-label">MÔN HỌC</div><b>${esc(x.subject||"Chưa ghi môn")}</b>${x.lesson?`<p><strong>📖 Nội dung:</strong> ${esc(x.lesson)}</p>`:""}${x.teacher?`<p><strong>👨‍🏫 Thầy cô:</strong> ${esc(x.teacher)}</p>`:""}${x.note?`<p><strong>💬 Dặn dò:</strong> ${esc(x.note)}</p>`:""}</div></article>`).join(""):`<div class="schedule-no-data">📭 Hôm nay chưa có nội dung.</div>`;
  const student=$("classScheduleTodayList"); if(student) student.innerHTML=out;
  const b=$("bmeClassScheduleList"); if(b)b.innerHTML=out;
}

function weekTable(containerId,weekStart,compact=false){
  const c=$(containerId); if(!c)return;
  let html='<div class="schedule-table-wrap"><table class="class-schedule-table"><thead><tr><th>Ngày</th>'+slots.map(s=>`<th>${esc(s.label)}</th>`).join("")+'</tr></thead><tbody>';
  for(let i=0;i<5;i++){
    const d=addDays(weekStart,i),date=keyDate(d);
    html+=`<tr><th><b>${days[i]}</b><small>${esc(d.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"}))}</small></th>`;
    for(const sl of slots){
      const x=map.get(`${date}_${sl.key}`);
      html+=`<td>${valid(x)?`<div class="${compact?"bme-schedule-cell":"schedule-cell-view"}"><b>${esc(x.subject||"Chưa ghi môn")}</b>${x.lesson?`<span>📖 ${esc(x.lesson)}</span>`:""}${x.teacher?`<small>👨‍🏫 ${esc(x.teacher)}</small>`:""}${x.note?`<small class="note">💬 ${esc(x.note)}</small>`:""}</div>`:'<div class="schedule-cell-view"><span class="schedule-empty">—</span></div>'}</td>`;
    }
    html+='</tr>';
  }
  html+='</tbody></table></div>'; c.innerHTML=html;
}

function renderBme(){
  weekTable("bmeScheduleTable",bmeWeek,true);
  const label=$("bmeScheduleWeekLabel");
  if(label)label.textContent=`${bmeWeek.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"})} – ${addDays(bmeWeek,4).toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric"})}`;
}
function renderAll(){renderToday();renderBme();}
function showError(message){
  for(const id of ["classScheduleTodayList","bmeClassScheduleList","bmeScheduleTable"]){const c=$(id);if(c)c.innerHTML=`<div class="schedule-no-data">❌ ${esc(message)}</div>`;}
}

$("bmeSchedulePrev")?.addEventListener("click",()=>{bmeWeek=addDays(bmeWeek,-7);renderBme()});
$("bmeScheduleNext")?.addEventListener("click",()=>{bmeWeek=addDays(bmeWeek,7);renderBme()});
$("bmeScheduleToday")?.addEventListener("click",()=>{bmeWeek=monday(new Date());renderBme()});

renderAll();
try {
  onSnapshot(collection(db,"class_schedule"), snap => {
    map.clear();
    snap.forEach(docSnap => map.set(docSnap.id, normalize(docSnap.data(),docSnap.id)));
    renderAll();
  }, err => {
    console.error("Homework Hub class_schedule error",err);
    showError("Không thể tải thời khóa biểu. Hãy kiểm tra Firestore Rules.");
  });
} catch(err) {
  console.error("Homework Hub class_schedule init error",err);
  showError("Không thể khởi tạo thời khóa biểu.");
}
