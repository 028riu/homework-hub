import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig, { name: "homework-hub-class-schedule" });
const db = getFirestore(app);
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const clean = value => String(value ?? "").trim();

const slots = [
  { key:"p1", label:"Tiết 1" }, { key:"p2", label:"Tiết 2" }, { key:"p3", label:"Tiết 3" },
  { key:"p4", label:"Tiết 4" }, { key:"lunch", label:"🍱 Nghỉ trưa" },
  { key:"p5", label:"Tiết 5" }, { key:"p6", label:"Tiết 6" }, { key:"p7", label:"Tiết 7" }
];

function pad(n){ return String(n).padStart(2,"0"); }
function dateKey(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function today(){ const d = new Date(); d.setHours(12,0,0,0); return d; }

// Hỗ trợ cả dữ liệu mới và dữ liệu cũ để không còn hiện "undefined".
function normalize(raw, id, slotFromId = "") {
  const x = raw || {};
  const slot = clean(x.slot || x.period || x.lessonSlot || slotFromId);
  const subject = clean(x.subject || x.subjectName || x.course || x.courseName || x.mon || x.monHoc || x.name);
  const lesson = clean(x.lesson || x.content || x.description || x.topic || x.noiDung || x.noi_dung);
  const teacher = clean(x.teacher || x.teacherName || x.tutor || x.giaoVien || x.giao_vien);
  const note = clean(x.note || x.notes || x.reminder || x.dặnDò || x.danDo || x.dan_do);
  return { ...x, id, slot, subject, lesson, teacher, note };
}

function todayItems(map){
  const date = dateKey(today());
  return slots
    .map(s => normalize(map.get(`${date}_${s.key}`), `${date}_${s.key}`, s.key))
    .filter(x => x.subject || x.lesson || x.teacher || x.note);
}

function subjectLabel(x){
  return x.subject ? esc(x.subject) : "Chưa ghi tên môn";
}

function renderStudent(map){
  const list = $("classScheduleTodayList");
  if(!list) return;
  const items = todayItems(map);
  if(!items.length){
    list.innerHTML = '<div class="schedule-no-data">📭 Chưa có nội dung học trên lớp cho hôm nay.</div>';
    return;
  }
  list.innerHTML = items.map(x => `
    <article class="schedule-today-card">
      <div class="schedule-slot">${esc(x.slot ? (slots.find(s=>s.key===x.slot)?.label || x.slot) : "Tiết học")}</div>
      <div class="schedule-body">
        <div class="schedule-subject-label">MÔN HỌC</div>
        <h3 class="schedule-subject">📚 ${subjectLabel(x)}</h3>
        ${x.lesson ? `<p><strong>📖 Nội dung:</strong> ${esc(x.lesson)}</p>` : ""}
        ${x.teacher ? `<small>👨‍🏫 Thầy cô: ${esc(x.teacher)}</small>` : ""}
        ${x.note ? `<small>💬 Dặn dò: ${esc(x.note)}</small>` : ""}
      </div>
    </article>`).join("");
}

function renderBme(map){
  const box = $("bmeClassScheduleList");
  if(!box) return;
  const items = todayItems(map);
  if(!items.length){
    box.innerHTML = '<div class="schedule-no-data">📭 Chưa có dữ liệu học trên lớp hôm nay.</div>';
    return;
  }
  box.innerHTML = items.map(x => `
    <article class="bme-class-row">
      <div class="bme-class-meta">
        <b>${esc(x.slot ? (slots.find(s=>s.key===x.slot)?.label || x.slot) : "Tiết học")}</b>
        <span>📚 Môn học: <strong>${subjectLabel(x)}</strong></span>
      </div>
      <section>
        ${x.lesson ? `<p><strong>📖 Nội dung:</strong> ${esc(x.lesson)}</p>` : ""}
        ${x.teacher ? `<p><strong>👨‍🏫 Thầy cô:</strong> ${esc(x.teacher)}</p>` : ""}
        ${x.note ? `<p><strong>💬 Dặn dò:</strong> ${esc(x.note)}</p>` : ""}
      </section>
    </article>`).join("");
}

function initStudent(){
  const launcher = $("classScheduleLauncher"), dialog = $("classScheduleDialog");
  if(!launcher || !dialog) return;
  launcher.addEventListener("pointerdown", e => {
    launcher.dataset.dragging = "0"; launcher._sx=e.clientX; launcher._sy=e.clientY;
    launcher._sl=parseFloat(getComputedStyle(launcher).left)||82; launcher._st=parseFloat(getComputedStyle(launcher).top)||72;
    launcher.setPointerCapture?.(e.pointerId);
  });
  launcher.addEventListener("pointermove", e => {
    if(launcher._sx==null) return;
    const dx=e.clientX-launcher._sx, dy=e.clientY-launcher._sy;
    if(Math.abs(dx)+Math.abs(dy)>8){
      launcher.dataset.dragging="1";
      launcher.style.left=Math.max(2,Math.min(96,launcher._sl+dx/innerWidth*100))+"%";
      launcher.style.top=Math.max(8,Math.min(90,launcher._st+dy/innerHeight*100))+"%";
    }
  });
  launcher.addEventListener("pointerup",()=>{ if(launcher.dataset.dragging!=="1") dialog.showModal(); launcher._sx=null; });
  launcher.addEventListener("pointercancel",()=>{ launcher._sx=null; });
  $("closeClassSchedule")?.addEventListener("click",()=>dialog.close());
}

const map = new Map();
onSnapshot(collection(db,"class_schedule"), snap => {
  map.clear();
  snap.docs.forEach(d => map.set(d.id, normalize(d.data(), d.id, d.data()?.slot)));
  renderStudent(map);
  renderBme(map);
}, err => {
  console.error("Homework Hub class schedule:", err);
  const html = '<div class="schedule-no-data">❌ Không thể tải nội dung học trên lớp.</div>';
  if($("classScheduleTodayList")) $("classScheduleTodayList").innerHTML=html;
  if($("bmeClassScheduleList")) $("bmeClassScheduleList").innerHTML=html;
});

initStudent();
