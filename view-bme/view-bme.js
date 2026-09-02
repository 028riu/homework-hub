import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "../js/firebase-config.js";

const app = initializeApp(firebaseConfig, { name: "homework-hub-bme" });
const db = getFirestore(app);
const $ = id => document.getElementById(id);

let data = [];
let subjects = [];
let search = "";

const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

function toDate(v) {
  try {
    if (!v) return null;
    if (typeof v.toDate === "function") return v.toDate();
    if (typeof v.seconds === "number") return new Date(v.seconds * 1000);
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch (_) { return null; }
}
function fmt(v) {
  const d = toDate(v);
  return d ? d.toLocaleString("vi-VN", { dateStyle:"medium", timeStyle:"short" }) : "";
}
function linksOf(h) {
  const raw = Array.isArray(h.links) ? h.links : (h.link ? [h.link] : (h.url ? [h.url] : []));
  return raw.map(x => String(x ?? "").trim()).filter(x => {
    try { const u = new URL(x); return u.protocol === "http:" || u.protocol === "https:"; }
    catch (_) { return false; }
  });
}
function render() {
  const q = search.trim().toLowerCase();
  const filtered = data
    .filter(h => {
      const s = subjects.find(x => x.id === h.subjectId);
      return `${h.title||""} ${h.content||""} ${s?.name||""}`.toLowerCase().includes(q);
    })
    .sort((a,b) => (toDate(b.createdAt)?.getTime()||0) - (toDate(a.createdAt)?.getTime()||0));

  const list = $("list"), empty = $("empty"), status = $("status"), count = $("count");
  if (!list || !empty || !status) return;
  count.textContent = `${filtered.length} bài tập`;
  status.className = "count";
  status.textContent = filtered.length ? "" : "📭 Chưa có bài tập.";
  empty.hidden = filtered.length !== 0;
  list.innerHTML = filtered.map(h => {
    const s = subjects.find(x => x.id === h.subjectId);
    const links = linksOf(h);
    const previewButtons = links.map((url,i) => `
      <button type="button" class="link-btn preview-link" data-url="${esc(url)}">👁 Xem trước ${i+1}</button>
      <a class="link-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">↗ Mở link ${i+1}</a>
    `).join("");
    return `<article class="card">
      <div class="top"><span class="subject">${esc(s?.icon || h.subjectIcon || "📚")} ${esc(s?.name || h.subjectName || "Bài tập")}</span><span class="date">${esc(fmt(h.createdAt || h.updatedAt))}</span></div>
      <h2>${esc(h.title || "Bài tập")}</h2>
      <div class="content">${esc(h.content || "")}</div>
      ${h.dueDate ? `<p class="due">⏰ Hạn nộp: ${esc(fmt(h.dueDate))}</p>` : ""}
      ${links.length ? `<div class="links">${previewButtons}</div>` : ""}
    </article>`;
  }).join("");
}
$("search")?.addEventListener("input", e => { search = e.target.value; render(); });

document.addEventListener("click", e => {
  const b = e.target.closest(".preview-link");
  if (!b) return;
  const url = b.dataset.url;
  let d = $("bmePreviewDialog");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "bmePreviewDialog";
    d.innerHTML = `<div class="modal"><div class="top"><h2>👁 Xem trước link</h2><button type="button" class="icon-btn" id="bmePreviewClose" aria-label="Đóng">×</button></div><iframe id="bmePreviewFrame" title="Xem trước nội dung link" style="width:100%;height:65vh;border:0;border-radius:14px;background:#fff"></iframe><p class="muted">Nếu website không cho phép nhúng, hãy dùng nút Mở link.</p></div>`;
    document.body.appendChild(d);
    d.querySelector("#bmePreviewClose").onclick = () => d.close();
  }
  $("bmePreviewFrame").src = url;
  d.showModal();
});

onSnapshot(collection(db, "subjects"), snap => {
  subjects = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  render();
}, err => {
  console.warn("BME subjects:", err);
  subjects = [];
  render();
});

onSnapshot(collection(db, "bme_homework"), snap => {
  data = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  render();
  $("loading")?.remove();
  console.log("Homework Hub BME: realtime", data.length);
}, err => {
  console.error("Homework Hub BME:", err);
  const status = $("status");
  if (status) { status.className = "error"; status.textContent = `❌ Không thể tải bài BME: ${err.code || ""} ${err.message || ""}`; }
});
render();


// ===== BME CLASS SCHEDULE — self-contained =====
const BME_SLOTS = [
  {key:"p1",label:"Tiết 1"},{key:"p2",label:"Tiết 2"},{key:"p3",label:"Tiết 3"},{key:"p4",label:"Tiết 4"},
  {key:"lunch",label:"Nghỉ trưa"},{key:"p5",label:"Tiết 5"},{key:"p6",label:"Tiết 6"},{key:"p7",label:"Tiết 7"}
];
const BME_DAYS = ["Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6"];
let bmeScheduleMap = new Map();
let bmeScheduleWeek = bmeMonday(new Date());
function bmePad(n){return String(n).padStart(2,"0")}
function bmeDateKey(d){return `${d.getFullYear()}-${bmePad(d.getMonth()+1)}-${bmePad(d.getDate())}`}
function bmeMonday(d){const x=new Date(d);x.setHours(12,0,0,0);const n=x.getDay();x.setDate(x.getDate()+(n===0?-6:1-n));return x}
function bmeAddDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function bmeClean(v){return String(v??"").trim()}
function bmeNorm(raw,id=""){const x=raw||{};return {id,date:bmeClean(x.date||x.day||id.split("_")[0]),slot:bmeClean(x.slot||x.period||x.tiet||id.split("_").slice(1).join("_")),subject:bmeClean(x.subject||x.subjectName||x.course||x.courseName||x.mon||x.monHoc||x.name),lesson:bmeClean(x.lesson||x.content||x.description||x.topic||x.noiDung||x.noi_dung),teacher:bmeClean(x.teacher||x.teacherName||x.tutor||x.giaoVien||x.giao_vien),note:bmeClean(x.note||x.notes||x.reminder||x.danDo||x.dan_do)}}
function bmeHas(x){return !!(x&&(x.subject||x.lesson||x.teacher||x.note))}
function bmeScheduleCell(x){if(!bmeHas(x))return '<div class="bme-schedule-cell"><span class="schedule-empty">—</span></div>';return `<div class="bme-schedule-cell"><b>${esc(x.subject||"Chưa ghi môn")}</b>${x.lesson?`<span>📖 ${esc(x.lesson)}</span>`:""}${x.teacher?`<small>👨‍🏫 ${esc(x.teacher)}</small>`:""}${x.note?`<small class="note">💬 ${esc(x.note)}</small>`:""}</div>`}
function renderBmeSchedule(){
  const table=$("bmeScheduleTable"), label=$("bmeScheduleWeekLabel"), today=$("bmeClassScheduleList");
  if(label) label.textContent=`${bmeScheduleWeek.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"})} – ${bmeAddDays(bmeScheduleWeek,4).toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric"})}`;
  if(table){let h='<div class="schedule-table-wrap"><table class="class-schedule-table"><thead><tr><th>Ngày</th>'+BME_SLOTS.map(s=>`<th>${s.label}</th>`).join("")+'</tr></thead><tbody>';for(let i=0;i<5;i++){const d=bmeAddDays(bmeScheduleWeek,i),date=bmeDateKey(d);h+=`<tr><th><b>${BME_DAYS[i]}</b><small>${d.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"})}</small></th>`;for(const sl of BME_SLOTS)h+=`<td>${bmeScheduleCell(bmeScheduleMap.get(`${date}_${sl.key}`))}</td>`;h+='</tr>'}h+='</tbody></table></div>';table.innerHTML=h}
  if(today){const date=bmeDateKey(new Date()),arr=[...bmeScheduleMap.values()].filter(x=>x.date===date&&bmeHas(x)).sort((a,b)=>BME_SLOTS.findIndex(s=>s.key===a.slot)-BME_SLOTS.findIndex(s=>s.key===b.slot));today.innerHTML=arr.length?arr.map(x=>`<article class="schedule-today-card"><div class="schedule-slot">${esc(BME_SLOTS.find(s=>s.key===x.slot)?.label||x.slot||"Tiết")}</div><div class="schedule-body"><div class="schedule-subject-label">MÔN HỌC</div><b>${esc(x.subject||"Chưa ghi môn")}</b>${x.lesson?`<p><strong>📖 Nội dung:</strong> ${esc(x.lesson)}</p>`:""}${x.teacher?`<p><strong>👨‍🏫 Thầy cô:</strong> ${esc(x.teacher)}</p>`:""}${x.note?`<p><strong>💬 Dặn dò:</strong> ${esc(x.note)}</p>`:""}</div></article>`).join(""):'<div class="schedule-no-data">📭 Hôm nay chưa có nội dung.</div>'}
}
$("bmeSchedulePrev")?.addEventListener("click",()=>{bmeScheduleWeek=bmeAddDays(bmeScheduleWeek,-7);renderBmeSchedule()});
$("bmeScheduleNext")?.addEventListener("click",()=>{bmeScheduleWeek=bmeAddDays(bmeScheduleWeek,7);renderBmeSchedule()});
$("bmeScheduleToday")?.addEventListener("click",()=>{bmeScheduleWeek=bmeMonday(new Date());renderBmeSchedule()});
renderBmeSchedule();
try{onSnapshot(collection(db,"class_schedule"),snap=>{bmeScheduleMap.clear();snap.forEach(d=>bmeScheduleMap.set(d.id,bmeNorm(d.data(),d.id)));renderBmeSchedule();},err=>{console.error("BME class_schedule:",err);const t=$("bmeScheduleTable"),today=$("bmeClassScheduleList");const msg=`❌ Không thể tải thời khóa biểu: ${err.code||""} ${err.message||""}`;if(t)t.innerHTML=`<div class="error">${esc(msg)}</div>`;if(today)today.innerHTML=`<div class="error">${esc(msg)}</div>`});}catch(err){console.error("BME class_schedule init:",err)}
