import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "../js/firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const $ = id => document.getElementById(id);
let data = [];
let subjects = [];
let search = "";

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"}[c]));
const dateValue = value => {
  try {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch { return null; }
};
const fmt = value => {
  const d = dateValue(value);
  return d ? d.toLocaleString("vi-VN", { dateStyle:"medium", timeStyle:"short" }) : "";
};
const linksOf = h => {
  const raw = Array.isArray(h.links) ? h.links : (h.link ? [h.link] : (h.url ? [h.url] : []));
  return raw.map(x => typeof x === "string" ? x.trim() : "").filter(x => /^https?:\/\//i.test(x));
};

function render() {
  const q = search.toLowerCase();
  const filtered = data.filter(h => {
    const subject = subjects.find(s => s.id === h.subjectId);
    return `${h.title || ""} ${h.content || ""} ${subject?.name || ""}`.toLowerCase().includes(q);
  });

  $("empty").hidden = filtered.length !== 0;
  $("status").innerHTML = `<span class="count">${filtered.length}</span> bài tập đang hiển thị`;

  $("list").innerHTML = filtered.map(h => {
    const subject = subjects.find(s => s.id === h.subjectId);
    const links = linksOf(h);
    const due = fmt(h.dueDate);
    return `<article class="card">
      <div class="top"><span class="subject">${esc(subject?.icon || "📚")} ${esc(subject?.name || "Bài tập")}</span><span class="date">${esc(fmt(h.createdAt))}</span></div>
      <h2>${esc(h.title || "Bài tập")}</h2>
      <div class="content">${esc(h.content || "")}</div>
      ${due ? `<p class="due">⏰ Hạn nộp: ${esc(due)}</p>` : ""}
      ${links.length ? `<div class="links">${links.map((url, i) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">🔗 Mở link ${i + 1} ↗</a>`).join("")}</div>` : ""}
    </article>`;
  }).join("");
}

$("search").addEventListener("input", e => { search = e.target.value.trim(); render(); });

// Read BME without orderBy(). This deliberately avoids requiring a Firestore
// composite/index or failing because an older document has no createdAt field.
onSnapshot(collection(db, "bme_homework"), snapshot => {
  data = snapshot.docs.map(d => ({ id:d.id, ...d.data() }));
  data.sort((a,b) => {
    const ad = dateValue(a.createdAt)?.getTime() || 0;
    const bd = dateValue(b.createdAt)?.getTime() || 0;
    return bd - ad;
  });
  $("error").hidden = true;
  render();
}, error => {
  console.error("View BME Firebase error:", error);
  $("status").textContent = "❌ Không thể tải dữ liệu BME";
  $("error").hidden = false;
  $("error").textContent = `Firebase trả về lỗi: ${error?.message || error}`;
});

// Subjects are optional for BME. A failure here must never hide BME homework.
onSnapshot(collection(db, "subjects"), snapshot => {
  subjects = snapshot.docs.map(d => ({ id:d.id, ...d.data() }));
  render();
}, error => {
  console.warn("View BME subjects unavailable:", error);
  subjects = [];
  render();
});

render();
