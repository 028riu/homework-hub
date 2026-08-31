import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const $ = (id) => document.getElementById(id);
const DAY = 86400000;

let tabs = [];
let homework = [];
let active = "all";
let search = "";
let siteSettings = {
  noHomeworkNoticeEnabled: true,
  oldHomeworkNoticeEnabled: true,
  noHomeworkNoticeTitle: "📚 Hôm nay không có bài tập mới",
  noHomeworkNoticeMessage: "Hôm nay chưa có bài tập mới được cập nhật.",
  oldHomeworkNoticeTitle: "📢 Bài tập chưa có cập nhật",
  oldHomeworkNoticeMessage: "Danh sách bài tập hôm nay vẫn giống ngày trước."
};

$("today").textContent = new Intl.DateTimeFormat("vi-VN", { dateStyle: "full" }).format(new Date());

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch]);
}

function safeUrl(value) {
  try {
    const url = new URL(String(value).trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function dayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(date);
}

function updateStreak() {
  const key = "hh_streak_v2";
  const today = dayKey();
  let data;
  try {
    data = JSON.parse(localStorage.getItem(key) || '{"last":"","count":0}');
  } catch {
    data = { last: "", count: 0 };
  }

  if (data.last !== today) {
    const previous = data.last ? new Date(`${data.last}T12:00:00+07:00`) : null;
    const current = new Date(`${today}T12:00:00+07:00`);
    const gap = previous ? Math.round((current - previous) / DAY) : 0;
    data.count = data.last && gap === 1 ? data.count + 1 : 1;
    data.last = today;
    localStorage.setItem(key, JSON.stringify(data));
  }

  const count = Math.max(1, Number(data.count) || 1);
  $("streakCount").textContent = `${count} ngày`;
  $("firePet").dataset.level = count >= 30 ? "legendary" : count >= 7 ? "hot" : "baby";
  $("streakWidget").title = count >= 30
    ? "🔥 Pet lửa: cấp độ Huyền thoại!"
    : count >= 7
      ? "🔥 Pet lửa đang rất sung!"
      : "🔥 Pet lửa đang nghịch!";
}

function getLocalStreak() {
  try {
    return Number(JSON.parse(localStorage.getItem("hh_streak_v2") || '{"count":0}').count) || 1;
  } catch {
    return 1;
  }
}

function renderUser(user) {
  const area = $("userArea");
  if (!area) return;

  if (user) {
    const name = user.displayName || user.email || "Bạn";
    area.innerHTML = `
      <div class="user-pill">
        <span class="avatar">${esc((name[0] || "U").toUpperCase())}</span>
        <div><b>${esc(name)}</b><small>🔥 Chuỗi: <span id="userStreak">${getLocalStreak()}</span> ngày</small></div>
        <button id="logoutGoogle" class="logout-mini" type="button">Đăng xuất</button>
      </div>`;
    $("logoutGoogle")?.addEventListener("click", () => signOut(auth).catch((error) => console.error("Logout", error)));
    $("streakCount").textContent = `${getLocalStreak()} ngày`;
  } else {
    area.innerHTML = `<button id="googleLogin" class="google-mini" type="button">G&nbsp; Đăng nhập Google</button>`;
    $("googleLogin")?.addEventListener("click", async () => {
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (error) {
        console.error("Google login", error);
      }
    });
    $("streakCount").textContent = "—";
  }
}

onAuthStateChanged(auth, (user) => {
  renderUser(user);
  if (user) updateStreak();
});
updateStreak();

function normalizeAttachments(item) {
  const list = Array.isArray(item?.attachments) ? item.attachments : [];
  const result = list.map((attachment) => ({
    type: attachment.type === "file" ? "file" : "link",
    url: attachment.url || attachment.fileUrl || attachment.linkUrl || "",
    name: attachment.name || attachment.fileName || (attachment.type === "file" ? "Tệp đính kèm" : "Liên kết"),
    fileName: attachment.fileName || attachment.name || "",
    fileType: attachment.fileType || ""
  })).filter((attachment) => safeUrl(attachment.url));

  if (!result.length && item?.linkUrl && safeUrl(item.linkUrl)) {
    result.push({ type: "link", url: item.linkUrl, name: "Liên kết" });
  }
  if (!result.length && item?.fileUrl && safeUrl(item.fileUrl)) {
    result.push({ type: "file", url: item.fileUrl, name: item.fileName || "Tệp đính kèm", fileName: item.fileName || "" });
  }
  return result;
}

function getAttachmentKind(attachment) {
  if (attachment.type === "link") return "link";
  const type = String(attachment.fileType || "").toLowerCase();
  const name = String(attachment.fileName || attachment.name || "").toLowerCase();
  if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name)) return "image";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (type.startsWith("video/") || /\.(mp4|webm|ogg|mov|m4v)$/i.test(name)) return "video";
  if (type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(name)) return "audio";
  if (type.startsWith("text/") || /\.(txt|csv|json|md)$/i.test(name)) return "text";
  return "file";
}

function attachmentCard(attachment, index) {
  const url = safeUrl(attachment.url);
  if (!url) return "";
  const kind = getAttachmentKind(attachment);
  const icon = kind === "link" ? "🔗" : kind === "image" ? "🖼️" : kind === "pdf" ? "📕" : kind === "video" ? "🎬" : kind === "audio" ? "🎵" : "📎";
  const title = attachment.name || attachment.fileName || `Tệp ${index + 1}`;
  const encoded = encodeURIComponent(url);

  return `
    <div class="attachment-card">
      <div class="attachment-info">
        <span class="attachment-type-icon">${icon}</span>
        <div><b>${esc(title)}</b><small>${kind === "link" ? esc(url) : esc(attachment.fileType || "Tệp đính kèm")}</small></div>
      </div>
      <div class="attachment-actions">
        <button type="button" class="attachment-view-btn" data-attachment-url="${esc(encoded)}" data-attachment-kind="${esc(kind)}" data-attachment-name="${esc(title)}">👁️ Xem</button>
        <a class="attachment-download-btn" href="${esc(url)}" download target="_blank" rel="noopener noreferrer">⬇️ Download</a>
        ${kind === "link" ? `<a class="attachment-open-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">↗ Mở link</a>` : ""}
      </div>
    </div>`;
}

function ensurePreviewModal() {
  if ($("attachmentViewerModal")) return;
  const modal = document.createElement("div");
  modal.id = "attachmentViewerModal";
  modal.className = "attachment-viewer-modal hidden";
  modal.innerHTML = `
    <div class="attachment-viewer-backdrop" data-close-viewer="1">
      <div class="attachment-viewer" role="dialog" aria-modal="true" aria-labelledby="attachmentViewerTitle">
        <div class="attachment-viewer-head">
          <div><b id="attachmentViewerTitle">Xem tài liệu</b><small id="attachmentViewerStatus"></small></div>
          <button type="button" id="closeAttachmentViewer" class="icon-btn">×</button>
        </div>
        <div id="attachmentViewerBody" class="attachment-viewer-body"></div>
        <div class="attachment-viewer-foot">
          <a id="attachmentViewerDownload" class="attachment-download-btn" href="#" target="_blank" rel="noopener noreferrer">⬇️ Download</a>
          <a id="attachmentViewerOpen" class="attachment-open-btn" href="#" target="_blank" rel="noopener noreferrer">↗ Mở ở tab mới</a>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  $("closeAttachmentViewer").addEventListener("click", closeAttachmentViewer);
  modal.querySelector("[data-close-viewer]").addEventListener("click", (event) => {
    if (event.target.dataset.closeViewer) closeAttachmentViewer();
  });
}

function closeAttachmentViewer() {
  $("attachmentViewerModal")?.classList.add("hidden");
  const body = $("attachmentViewerBody");
  if (body) body.innerHTML = "";
}

function openAttachmentViewer(url, kind, name) {
  ensurePreviewModal();
  const modal = $("attachmentViewerModal");
  const body = $("attachmentViewerBody");
  const status = $("attachmentViewerStatus");
  const download = $("attachmentViewerDownload");
  const open = $("attachmentViewerOpen");

  $("attachmentViewerTitle").textContent = name || "Xem tài liệu";
  status.textContent = "Đang tải bản xem trước...";
  download.href = url;
  open.href = url;
  modal.classList.remove("hidden");
  body.innerHTML = "";

  if (kind === "image") {
    const img = document.createElement("img");
    img.className = "attachment-preview-image";
    img.alt = name || "Hình ảnh";
    img.src = url;
    img.onload = () => { status.textContent = "Xem trực tiếp"; };
    img.onerror = () => { previewFailed(status, body, url); };
    body.appendChild(img);
    return;
  }

  if (kind === "video" || kind === "audio") {
    const media = document.createElement(kind);
    media.controls = true;
    media.autoplay = false;
    media.src = url;
    media.className = "attachment-preview-media";
    media.onloadeddata = () => { status.textContent = "Xem trực tiếp"; };
    media.onerror = () => { previewFailed(status, body, url); };
    body.appendChild(media);
    return;
  }

  const frame = document.createElement("iframe");
  frame.className = "attachment-preview-frame";
  frame.src = url;
  frame.loading = "eager";
  frame.referrerPolicy = "no-referrer";
  frame.title = name || "Xem nội dung";
  frame.onload = () => { status.textContent = "Nếu nội dung hiển thị trống, hãy bấm Mở ở tab mới."; };
  body.appendChild(frame);

  if (kind === "link") {
    status.textContent = "Đang thử xem nội dung của link...";
    window.setTimeout(() => {
      if (!modal.classList.contains("hidden")) {
        status.textContent = "Một số website chặn xem trong khung. Nếu trống/lỗi, bấm Mở ở tab mới.";
      }
    }, 2500);
  } else {
    status.textContent = "Đang thử xem trực tiếp... Nếu lỗi, dùng Download hoặc mở tab mới.";
  }
}

function previewFailed(status, body, url) {
  status.textContent = "Không thể xem trực tiếp.";
  body.innerHTML = `
    <div class="attachment-preview-error">
      <div class="attachment-error-icon">⚠️</div>
      <h3>Không thể xem trực tiếp</h3>
      <p>Trình duyệt hoặc website không cho phép xem nội dung này. Bạn có thể tải file hoặc mở bằng tab mới.</p>
      <div class="attachment-actions centered">
        <a class="attachment-download-btn" href="${esc(url)}" download target="_blank" rel="noopener noreferrer">⬇️ Download</a>
        <a class="attachment-open-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">↗ Mở tab mới</a>
      </div>
    </div>`;
}

document.addEventListener("click", (event) => {
  const button = event.target.closest(".attachment-view-btn");
  if (!button) return;
  const url = decodeURIComponent(button.dataset.attachmentUrl || "");
  const kind = button.dataset.attachmentKind || "file";
  const name = button.dataset.attachmentName || "Xem tài liệu";
  if (safeUrl(url)) openAttachmentViewer(url, kind, name);
});

function showUpdateNotice() {
  const today = dayKey();
  if (localStorage.getItem("hh_notice_dismissed") === today) return;

  const latest = homework.reduce((max, item) => {
    const date = item.createdAt?.toDate ? item.createdAt.toDate() : item.createdAt ? new Date(item.createdAt) : null;
    return date && (!max || date > max) ? date : max;
  }, null);

  let title = "";
  let text = "";
  if (!homework.length) {
    if (siteSettings.noHomeworkNoticeEnabled === false) return;
    title = siteSettings.noHomeworkNoticeTitle;
    text = siteSettings.noHomeworkNoticeMessage;
  } else {
    if (!latest) return;
    const latestKey = dayKey(latest);
    if (latestKey === today || siteSettings.oldHomeworkNoticeEnabled === false) return;
    const diff = Math.max(1, Math.round((new Date(`${today}T12:00:00+07:00`) - new Date(`${latestKey}T12:00:00+07:00`)) / DAY));
    title = siteSettings.oldHomeworkNoticeTitle;
    text = siteSettings.oldHomeworkNoticeMessage.replaceAll("{days}", String(diff)).replaceAll("{date}", latest.toLocaleDateString("vi-VN"));
  }

  $("noticeTitle").textContent = title;
  $("noticeText").textContent = text;
  $("updateNotice").classList.remove("hidden");
}

$("noticeClose")?.addEventListener("click", () => {
  localStorage.setItem("hh_notice_dismissed", dayKey());
  $("updateNotice").classList.add("hidden");
});

onSnapshot(query(collection(db, "subjects")), (snapshot) => {
  tabs = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  renderTabs();
  render();
}, (error) => console.error("Subjects listener", error));

onSnapshot(query(collection(db, "homework"), orderBy("createdAt", "desc")), (snapshot) => {
  homework = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  render();
  showUpdateNotice();
}, (error) => {
  console.error("Homework listener", error);
  $("status").textContent = "Không thể tải bài tập. Hãy tải lại trang.";
});

onSnapshot(doc(db, "settings", "site"), (snapshot) => {
  if (snapshot.exists()) siteSettings = { ...siteSettings, ...snapshot.data() };
  showUpdateNotice();
}, (error) => console.error("Settings listener", error));

function renderTabs() {
  $("tabs").innerHTML = `<button class="tab ${active === "all" ? "active" : ""}" data-tab="all">✨ Tất cả</button>` +
    tabs.map((tab) => `<button class="tab ${active === tab.id ? "active" : ""}" data-tab="${esc(tab.id)}">${esc(tab.icon || "📚")} ${esc(tab.name || "Môn học")}</button>`).join("");

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      active = button.dataset.tab;
      renderTabs();
      render();
    });
  });
}

$("search")?.addEventListener("input", (event) => {
  search = event.target.value.toLowerCase();
  $("clearSearch")?.classList.toggle("hidden", !search);
  render();
});

$("clearSearch")?.addEventListener("click", () => {
  $("search").value = "";
  search = "";
  $("clearSearch").classList.add("hidden");
  render();
});

function render() {
  $("totalCount").textContent = String(homework.length);
  const list = homework
    .filter((item) => active === "all" || item.subjectId === active)
    .filter((item) => !search || `${item.title || ""} ${item.content || ""}`.toLowerCase().includes(search))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));

  $("status").textContent = `${list.length} bài tập${active === "all" ? "" : " trong môn đã chọn"}`;
  $("empty").classList.toggle("hidden", list.length > 0);

  $("homeworkList").innerHTML = list.map((item, index) => {
    const subject = tabs.find((tab) => tab.id === item.subjectId);
    const due = item.dueDate ? new Date(item.dueDate) : null;
    const state = due && !Number.isNaN(due.getTime()) ? dueState(due) : {};
    const attachments = normalizeAttachments(item);

    return `
      <article class="card ${item.pinned ? "pinned" : ""}" style="animation-delay:${Math.min(index, 10) * 45}ms">
        <div class="card-top"><span class="subject">${esc(subject?.icon || "📚")} ${esc(subject?.name || "Chưa phân loại")}</span><span class="badge ${state.cls || ""}">${item.pinned ? "📌 Ghim" : item.important ? "⭐ Quan trọng" : "Mới"}</span></div>
        <h2>${esc(item.title || "Bài tập")}</h2>
        <div class="content">${esc(item.content || "")}</div>
        ${due ? `<div class="due ${state.cls || ""}">⏰ Hạn nộp: ${due.toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" })} · ${state.text}</div>` : ""}
        ${attachments.length ? `<div class="attachments"><div class="attachments-title">📎 Tài liệu & liên kết</div>${attachments.map(attachmentCard).join("")}</div>` : ""}
      </article>`;
  }).join("");
}

function dueState(date) {
  const diff = date - new Date();
  if (diff < 0) return { cls: "red", text: "Đã hết hạn" };
  if (diff < 2 * DAY) return { cls: "yellow", text: "Sắp hết hạn" };
  return { cls: "", text: "Còn hạn" };
}

const firePet = $("firePet");
const streakWidget = $("streakWidget");
function petPlay() {
  if (!firePet) return;
  firePet.classList.remove("pet-play");
  void firePet.offsetWidth;
  firePet.classList.add("pet-play");
  const label = $("streakLabel");
  if (label) {
    label.textContent = "Hí hí! 🔥";
    clearTimeout(window.__petTimer);
    window.__petTimer = setTimeout(() => { label.textContent = "chuỗi học tập"; }, 1400);
  }
}

streakWidget?.addEventListener("click", petPlay);
streakWidget?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    petPlay();
  }
});
setInterval(() => { if (firePet && !document.hidden) petPlay(); }, 17000);

if (localStorage.getItem("hh_theme") === "light") document.body.classList.add("light");
$("themeBtn")?.addEventListener("click", () => {
  document.body.classList.toggle("light");
  localStorage.setItem("hh_theme", document.body.classList.contains("light") ? "light" : "dark");
});
