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
