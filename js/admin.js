// ============================================================
// HOMEWORK HUB — ADMIN.JS
// Bản đầy đủ: bài tập, môn học, người dùng, streak, lượt truy cập,
// cài đặt thông báo, tìm kiếm người dùng và chỉnh sửa profile.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

// ============================================================
// FIREBASE
// ============================================================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();
const $ = (id) => document.getElementById(id);

// ============================================================
// ADMIN EMAILS
// QUAN TRỌNG: danh sách này phải khớp Firestore Rules.
// ============================================================
const ADMIN_EMAILS = [
  "028riu@gmail.com",
  "tu0ngtun2gsahur8@gmail.com",
  "linh085760@gmail.com",
  "phuong026443@stu.vinschool.edu.vn"
].map((email) => email.toLowerCase());

// ============================================================
// STATE
// ============================================================
let subjects = [];
let homeworks = [];
let users = [];
let siteSettings = {
  noHomeworkNoticeEnabled: true,
  oldHomeworkNoticeEnabled: true,
  noHomeworkNoticeTitle: "📚 Hôm nay không có bài tập mới",
  noHomeworkNoticeMessage: "Hôm nay chưa có bài tập mới được cập nhật.",
  oldHomeworkNoticeTitle: "📢 Bài tập chưa có cập nhật",
  oldHomeworkNoticeMessage: "Danh sách bài tập hôm nay vẫn giống ngày trước."
};

let started = false;
let unsubscribeSubjects = null;
let unsubscribeHomework = null;
let unsubscribeUsers = null;
let unsubscribeSettings = null;
let userSearchText = "";

// ============================================================
// HELPERS
// ============================================================
function isAdminEmail(email) {
  return !!email && ADMIN_EMAILS.includes(String(email).toLowerCase());
}

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch]);
}

function setHidden(id, hidden) {
  const el = $(id);
  if (el) el.classList.toggle("hidden", hidden);
}

function setLoginError(message = "") {
  const el = $("loginError");
  if (el) el.textContent = message;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateKeyFromValue(value) {
  if (!value) return "";
  try {
    const date = typeof value?.toDate === "function"
      ? value.toDate()
      : typeof value?.seconds === "number"
        ? new Date(value.seconds * 1000)
        : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

function formatDate(value) {
  if (!value) return "Chưa có";
  try {
    const date = typeof value?.toDate === "function"
      ? value.toDate()
      : typeof value?.seconds === "number"
        ? new Date(value.seconds * 1000)
        : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("vi-VN");
  } catch {
    return String(value);
  }
}

function normalizeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getUserStreak(user) {
  return Math.max(0, normalizeNumber(user.streak ?? user.currentStreak, 0));
}

function getUserLongest(user) {
  return Math.max(
    getUserStreak(user),
    normalizeNumber(user.longestStreak ?? user.highestStreak ?? user.maxStreak, 0)
  );
}

function getUserLastAccess(user) {
  return user.lastVisitAt || user.lastAccess || user.lastLoginAt || user.lastLoginDate || user.lastVisitDate || null;
}

function getUserName(user) {
  return user.displayName || user.username || user.name || user.email || "Người dùng";
}

function getDueText(value) {
  if (!value) return "Không đặt hạn";
  try {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("vi-VN");
  } catch {
    return String(value);
  }
}

function safeCloseDialog(id) {
  const dialog = $(id);
  if (dialog?.open) dialog.close();
}

function showDialog(id) {
  const dialog = $(id);
  if (!dialog) return;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.classList.remove("hidden");
}

// ============================================================
// LOGIN / LOGOUT
// ============================================================
const googleLoginBtn = $("googleLoginBtn");
if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", async () => {
    setLoginError("");
    googleLoginBtn.disabled = true;
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google Login Error:", error);
      setLoginError(`Không thể đăng nhập: ${error.code || error.message}`);
    } finally {
      googleLoginBtn.disabled = false;
    }
  });
}

const logoutBtn = $("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  });
}

// ============================================================
// AUTH STATE
// ============================================================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    setHidden("loginView", false);
    setHidden("dashboard", true);
    started = false;
    stopListeners();
    return;
  }

  if (!isAdminEmail(user.email)) {
    setHidden("loginView", false);
    setHidden("dashboard", true);
    setLoginError(`Tài khoản ${user.email || "này"} không có quyền quản trị.`);
    signOut(auth).catch((error) => console.error("Admin sign-out error:", error));
    return;
  }

  setLoginError("");
  setHidden("loginView", true);
  setHidden("dashboard", false);

  const adminUser = $("adminUser");
  if (adminUser) {
    adminUser.textContent = `${user.displayName || "Admin"} · ${user.email || ""}`;
  }

  ensureManagementPanel();
  start();
});

// ============================================================
// LISTENERS
// ============================================================
function stopListeners() {
  for (const unsubscribe of [
    unsubscribeSubjects,
    unsubscribeHomework,
    unsubscribeUsers,
    unsubscribeSettings
  ]) {
    if (typeof unsubscribe === "function") unsubscribe();
  }
  unsubscribeSubjects = null;
  unsubscribeHomework = null;
  unsubscribeUsers = null;
  unsubscribeSettings = null;
}

// ============================================================
// FIRESTORE START
// ============================================================
function start() {
  if (started) return;
  started = true;

  unsubscribeSubjects = onSnapshot(
    query(collection(db, "subjects"), orderBy("order", "asc")),
    (snapshot) => {
      subjects = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderSubjects();
      fillSubjectSelect();
      renderHomework();
      updateAllStats();
    },
    (error) => {
      console.error("Subjects Firestore error:", error);
      showPanelError("adminTabs", "Không thể tải môn học", error);
    }
  );

  unsubscribeHomework = onSnapshot(
    query(collection(db, "homework"), orderBy("createdAt", "desc")),
    (snapshot) => {
      homeworks = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderHomework();
      updateAllStats();
    },
    (error) => {
      console.error("Homework Firestore error:", error);
      showPanelError("adminHomework", "Không thể tải bài tập", error);
    }
  );

  unsubscribeUsers = onSnapshot(
    collection(db, "users"),
    (snapshot) => {
      users = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderUsers();
      updateAllStats();
    },
    (error) => {
      console.error("Users Firestore error:", error);
      showPanelError("adminUsers", "Không thể tải người dùng", error);
    }
  );

  unsubscribeSettings = onSnapshot(
    doc(db, "settings", "site"),
    (snapshot) => {
      if (snapshot.exists()) {
        siteSettings = { ...siteSettings, ...snapshot.data() };
      }
      renderSiteSettings();
    },
    (error) => {
      console.error("Settings Firestore error:", error);
      const container = $("adminSettings");
      if (container) {
        container.innerHTML = `<p class="error">Không thể tải cài đặt: ${esc(error.message)}</p>`;
      }
    }
  );
}

function showPanelError(id, prefix, error) {
  const el = $(id);
  if (el) el.innerHTML = `<p class="error">${esc(prefix)}: ${esc(error.message)}</p>`;
}

// ============================================================
// SUBJECTS
// ============================================================
function renderSubjects() {
  const container = $("adminTabs");
  if (!container) return;

  if (!subjects.length) {
    container.innerHTML = `<p class="muted">Chưa có môn học.</p>`;
    return;
  }

  container.innerHTML = subjects.map((subject) => `
    <div class="admin-item">
      <b>${esc(subject.icon || "📚")} ${esc(subject.name || "Môn học")}</b>
      <small>ID: ${esc(subject.id)}</small>
      <div class="actions">
        <button type="button" data-action="edit-subject" data-id="${esc(subject.id)}">Sửa</button>
        <button type="button" class="danger" data-action="delete-subject" data-id="${esc(subject.id)}">Xóa</button>
      </div>
    </div>
  `).join("");
}

function fillSubjectSelect(selectedId = "") {
  const select = $("hwTab");
  if (!select) return;

  if (!subjects.length) {
    select.innerHTML = `<option value="">Chưa có môn học</option>`;
    return;
  }

  select.innerHTML = subjects.map((subject) => `
    <option value="${esc(subject.id)}">${esc(subject.icon || "📚")} ${esc(subject.name || "Môn học")}</option>
  `).join("");

  if (selectedId && subjects.some((subject) => subject.id === selectedId)) {
    select.value = selectedId;
  }
}

const newTab = $("newTab");
if (newTab) {
  newTab.addEventListener("click", () => {
    $("tabForm")?.reset();
    $("tabId").value = "";
    $("tabDialogTitle").textContent = "Tạo môn học";
    $("tabError").textContent = "";
    showDialog("tabDialog");
  });
}

const tabForm = $("tabForm");
if (tabForm) {
  tabForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const id = $("tabId").value.trim();
    const name = $("tabName").value.trim();
    const icon = $("tabIcon").value.trim() || "📚";
    const errorEl = $("tabError");

    if (!name) {
      errorEl.textContent = "Vui lòng nhập tên môn học.";
      return;
    }

    const oldSubject = subjects.find((item) => item.id === id);
    const order = id
      ? normalizeNumber(oldSubject?.order, 0)
      : (subjects.length ? Math.max(...subjects.map((item) => normalizeNumber(item.order, 0))) + 1 : 1);

    try {
      await setDoc(doc(db, "subjects", id || crypto.randomUUID()), {
        name,
        icon,
        order,
        updatedAt: serverTimestamp()
      });
      safeCloseDialog("tabDialog");
      errorEl.textContent = "";
    } catch (error) {
      console.error("Save subject error:", error);
      errorEl.textContent = `Không thể lưu: ${error.message}`;
    }
  });
}


// ============================================================
// ATTACHMENTS / FILE UPLOAD
// ============================================================
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

function normalizeUrl(value = "") {
  const raw = String(value).trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  } catch {
    return "";
  }
}

function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getHomeworkAttachments(homework) {
  const list = Array.isArray(homework?.attachments) ? homework.attachments : [];
  const legacy = [];

  if (homework?.linkUrl && !list.some((x) => x?.type === "link" && x?.url === homework.linkUrl)) {
    legacy.push({ type: "link", url: homework.linkUrl, name: homework.linkName || "Liên kết" });
  }
  if (homework?.fileUrl && !list.some((x) => x?.type === "file" && x?.url === homework.fileUrl)) {
    legacy.push({
      type: "file",
      url: homework.fileUrl,
      name: homework.fileName || "Tệp đính kèm",
      mimeType: homework.fileType || "",
      size: homework.fileSize || 0
    });
  }

  return [...list, ...legacy];
}

function renderAttachmentAdminSummary(homework) {
  const attachments = getHomeworkAttachments(homework);
  if (!attachments.length) return `<small class="muted">Không có link hoặc file đính kèm.</small>`;

  return `
    <div class="attachment-admin-list">
      ${attachments.map((item) => {
        const isLink = item?.type === "link";
        const name = item?.name || (isLink ? item.url : "Tệp");
        return `
          <small class="attachment-admin-item">
            ${isLink ? "🔗" : "📎"} ${esc(name)}
            ${isLink ? `<span class="muted"> · ${esc(item.url || "")}</span>` : ` · ${esc(formatFileSize(item.size))}`}
          </small>
        `;
      }).join("")}
    </div>
  `;
}

function setUploadStatus(message = "", isError = false) {
  const el = $("hwUploadStatus");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("error", isError);
  el.classList.toggle("success", !isError && !!message);
}

function resetAttachmentInputs() {
  const url = $("hwUrl");
  const file = $("hwFile");
  const old = $("hwExistingAttachments");
  if (url) url.value = "";
  if (file) file.value = "";
  if (old) old.innerHTML = "";
  setUploadStatus("");
}

function renderExistingAttachments(homework) {
  const container = $("hwExistingAttachments");
  if (!container) return;

  const attachments = getHomeworkAttachments(homework);
  if (!attachments.length) {
    container.innerHTML = `<span class="muted">Chưa có tệp/link cũ.</span>`;
    return;
  }

  container.innerHTML = attachments.map((item, index) => {
    const isLink = item?.type === "link";
    return `
      <div class="existing-attachment" data-existing-index="${index}">
        <span>${isLink ? "🔗" : "📎"} ${esc(item?.name || (isLink ? "Liên kết" : "Tệp"))}</span>
        <small>${isLink ? esc(item?.url || "") : esc(formatFileSize(item?.size))}</small>
      </div>
    `;
  }).join("");
}

async function uploadHomeworkFile(file, homeworkId) {
  if (!file) return null;
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error(`File quá lớn. Kích thước tối đa là ${formatFileSize(MAX_UPLOAD_SIZE)}.`);
  }

  const safeName = file.name.replace(/[^\w.\-À-ỹ ]/g, "_").replace(/\s+/g, "_");
  const path = `homework-files/${homeworkId}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, path);

  setUploadStatus(`⏳ Đang tải ${file.name}...`);
  const snapshot = await uploadBytes(storageRef, file, {
    contentType: file.type || "application/octet-stream",
    customMetadata: {
      originalName: file.name
    }
  });
  const url = await getDownloadURL(snapshot.ref);

  setUploadStatus(`✅ Đã tải ${file.name} (${formatFileSize(file.size)})`);
  return {
    type: "file",
    url,
    storagePath: path,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size
  };
}

function validateHomeworkUrl(value) {
  if (!value.trim()) return "";
  const normalized = normalizeUrl(value);
  if (!normalized) throw new Error("URL không hợp lệ. Hãy nhập dạng https://... hoặc http://...");
  return normalized;
}

// ============================================================
// HOMEWORK
// ============================================================
function renderHomework() {
  const container = $("adminHomework");
  if (!container) return;

  if (!homeworks.length) {
    container.innerHTML = `<p class="muted">Chưa có bài tập.</p>`;
    return;
  }

  container.innerHTML = homeworks.map((homework) => {
    const subject = subjects.find((item) => item.id === homework.subjectId);
    return `
      <div class="admin-item">
        <b>${homework.pinned ? "📌 " : ""}${homework.important ? "⭐ " : ""}${esc(homework.title || "Bài tập")}</b>
        <small>${esc(subject?.icon || "📚")} ${esc(subject?.name || "Chưa phân loại")} · ${esc(getDueText(homework.dueDate))}</small>
        <small>${esc(homework.content || "")}</small>
        ${renderAttachmentAdminSummary(homework)}
        <div class="actions">
          <button type="button" data-action="edit-homework" data-id="${esc(homework.id)}">Sửa</button>
          <button type="button" class="danger" data-action="delete-homework" data-id="${esc(homework.id)}">Xóa</button>
        </div>
      </div>
    `;
  }).join("");
}

const newHomework = $("newHomework");
if (newHomework) {
  newHomework.addEventListener("click", () => {
    if (!subjects.length) {
      alert("Hãy tạo ít nhất 1 môn học trước.");
      return;
    }
    $("homeworkForm")?.reset();
    $("hwId").value = "";
    $("hwDialogTitle").textContent = "Tạo bài tập";
    $("hwError").textContent = "";
    resetAttachmentInputs();
    fillSubjectSelect();
    showDialog("homeworkDialog");
  });
}

const homeworkForm = $("homeworkForm");
if (homeworkForm) {
  homeworkForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const id = $("hwId").value.trim();
    const subjectId = $("hwTab").value;
    const title = $("hwTitle").value.trim();
    const content = $("hwContent").value.trim();
    const errorEl = $("hwError");

    if (!subjectId) return void (errorEl.textContent = "Vui lòng chọn môn học.");
    if (!title) return void (errorEl.textContent = "Vui lòng nhập tiêu đề.");
    if (!content) return void (errorEl.textContent = "Vui lòng nhập nội dung.");

    const oldHomework = homeworks.find((item) => item.id === id);
    const homeworkId = id || crypto.randomUUID();

    try {
      const linkUrl = validateHomeworkUrl($("hwUrl")?.value || "");
      const selectedFile = $("hwFile")?.files?.[0] || null;
      let attachments = getHomeworkAttachments(oldHomework);

      // Nếu nhập URL mới, thêm URL vào danh sách đính kèm.
      if (linkUrl) {
        attachments = attachments.filter((item) => !(item?.type === "link" && item?.url === linkUrl));
        attachments.push({
          type: "link",
          url: linkUrl,
          name: "Liên kết",
          addedAt: new Date().toISOString()
        });
      }

      // Nếu chọn file mới, tải lên Firebase Storage.
      if (selectedFile) {
        const uploaded = await uploadHomeworkFile(selectedFile, homeworkId);
        attachments = attachments.filter((item) => item?.type !== "file");
        attachments.push(uploaded);
      }

      const data = {
        subjectId,
        title,
        content,
        dueDate: $("hwDue").value || null,
        pinned: $("hwPinned").checked,
        important: $("hwImportant").checked,
        attachments,
        updatedAt: serverTimestamp(),
        createdAt: oldHomework?.createdAt || serverTimestamp()
      };

      await setDoc(doc(db, "homework", homeworkId), data);
      safeCloseDialog("homeworkDialog");
      errorEl.textContent = "";
      setUploadStatus("");
    } catch (error) {
      console.error("Save homework error:", error);
      errorEl.textContent = `Không thể lưu: ${error.message}`;
      setUploadStatus(`❌ ${error.message}`, true);
    }
  });
}

// ============================================================
// EDIT / DELETE EVENTS
// ============================================================
document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  switch (button.dataset.action) {
    case "edit-homework": return editHomework(id);
    case "delete-homework": return removeHomework(id);
    case "edit-subject": return editSubject(id);
    case "delete-subject": return removeSubject(id);
  }
});

function editHomework(id) {
  const homework = homeworks.find((item) => item.id === id);
  if (!homework) return;

  $("hwDialogTitle").textContent = "Sửa bài tập";
  $("hwId").value = homework.id;
  fillSubjectSelect(homework.subjectId || "");
  $("hwTitle").value = homework.title || "";
  $("hwContent").value = homework.content || "";
  $("hwDue").value = homework.dueDate || "";
  $("hwPinned").checked = !!homework.pinned;
  $("hwImportant").checked = !!homework.important;
  $("hwUrl").value = "";
  $("hwFile").value = "";
  renderExistingAttachments(homework);
  setUploadStatus("");
  $("hwError").textContent = "";
  showDialog("homeworkDialog");
}

async function removeHomework(id) {
  if (!confirm("Bạn có chắc muốn xóa bài tập này?")) return;
  try {
    await deleteDoc(doc(db, "homework", id));
  } catch (error) {
    console.error("Delete homework error:", error);
    alert(`Không thể xóa: ${error.message}`);
  }
}

function editSubject(id) {
  const subject = subjects.find((item) => item.id === id);
  if (!subject) return;
  $("tabId").value = id;
  $("tabName").value = subject.name || "";
  $("tabIcon").value = subject.icon || "";
  $("tabDialogTitle").textContent = "Sửa môn học";
  $("tabError").textContent = "";
  showDialog("tabDialog");
}

async function removeSubject(id) {
  if (homeworks.some((item) => item.subjectId === id)) {
    alert("Môn này đang có bài tập. Hãy chuyển hoặc xóa các bài tập thuộc môn này trước.");
    return;
  }
  if (!confirm("Bạn có chắc muốn xóa môn này?")) return;
  try {
    await deleteDoc(doc(db, "subjects", id));
  } catch (error) {
    console.error("Delete subject error:", error);
    alert(`Không thể xóa: ${error.message}`);
  }
}

// ============================================================
// MANAGEMENT PANEL
// ============================================================
function ensureManagementPanel() {
  if (!$("dashboard") || $("advancedAdminPanel")) return;

  const panel = document.createElement("section");
  panel.id = "advancedAdminPanel";
  panel.className = "panel advanced-admin-panel";
  panel.innerHTML = `
    <div class="admin-section">
      <div class="panel-title">
        <h2>👥 Quản lý người dùng</h2>
        <button type="button" id="refreshUsers" class="ghost small">↻ Làm mới</button>
      </div>
      <div class="stats admin-user-stats">
        <div><b id="statUsers">0</b><span>Người dùng</span></div>
        <div><b id="statVisitedToday">0</b><span>Đã truy cập hôm nay</span></div>
        <div><b id="statTotalStreak">0</b><span>Tổng streak</span></div>
      </div>
      <input id="userSearch" class="admin-search" type="search" placeholder="🔎 Tìm theo tên, username hoặc Gmail...">
      <div id="adminUsers" class="admin-list"><p class="muted">Đang tải người dùng...</p></div>
    </div>

    <div class="admin-section">
      <div class="panel-title"><h2>🔔 Cài đặt thông báo</h2></div>
      <div id="adminSettings" class="admin-settings"><p class="muted">Đang tải...</p></div>
    </div>
  `;
  $("dashboard").appendChild(panel);

  $("userSearch")?.addEventListener("input", (event) => {
    userSearchText = event.target.value.trim().toLowerCase();
    renderUsers();
  });

  $("refreshUsers")?.addEventListener("click", () => {
    renderUsers();
    updateAllStats();
  });
}

// ============================================================
// USER LIST
// ============================================================
function renderUsers() {
  const container = $("adminUsers");
  if (!container) return;

  let filtered = [...users];
  if (userSearchText) {
    filtered = filtered.filter((user) => {
      const haystack = [user.email, user.displayName, user.username, user.name, user.id]
        .filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(userSearchText);
    });
  }

  filtered.sort((a, b) => {
    const aDate = getUserLastAccess(a);
    const bDate = getUserLastAccess(b);
    const at = aDate ? (typeof aDate?.toDate === "function" ? aDate.toDate().getTime() : new Date(aDate).getTime()) : 0;
    const bt = bDate ? (typeof bDate?.toDate === "function" ? bDate.toDate().getTime() : new Date(bDate).getTime()) : 0;
    return bt - at;
  });

  if (!filtered.length) {
    container.innerHTML = `<p class="muted">${users.length ? "Không tìm thấy người dùng phù hợp." : "Chưa có người dùng nào được ghi nhận."}</p>`;
    return;
  }

  const today = todayKey();
  container.innerHTML = filtered.map((user) => {
    const streak = getUserStreak(user);
    const longest = getUserLongest(user);
    const lastAccess = getUserLastAccess(user);
    const lastDate = dateKeyFromValue(lastAccess) || user.lastVisitDate || user.lastLoginDate || "";
    const visitedToday = lastDate === today;
    const name = getUserName(user);
    const email = user.email || "Không có email";

    return `
      <div class="admin-item user-admin-item">
        <div>
          <b>${esc(name)}</b>
          <small>📧 ${esc(email)}</small>
          <small>🆔 ${esc(user.id)}</small>
          <small>🔥 Streak: <strong>${streak}</strong> · 🏆 Cao nhất: <strong>${longest}</strong></small>
          <small>🕒 Truy cập: ${esc(formatDate(lastAccess))}${visitedToday ? " · 🟢 Hôm nay" : ""}</small>
          <small>🔐 ${user.lastLoginAt || user.lastLoginDate ? "Đã đăng nhập" : "Chưa có lần đăng nhập được ghi nhận"}</small>
        </div>
        <div class="actions">
          <button type="button" data-user-edit="${esc(user.id)}">Sửa</button>
        </div>
      </div>
    `;
  }).join("");
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-user-edit]");
  if (!button) return;
  openUserEditor(button.dataset.userEdit);
});

// ============================================================
// USER STATS
// ============================================================
function updateUserStats() {
  const today = todayKey();
  const visitedToday = users.filter((user) => {
    const last = getUserLastAccess(user);
    return (dateKeyFromValue(last) || user.lastVisitDate || user.lastLoginDate || "") === today;
  }).length;

  const totalStreak = users.reduce((sum, user) => sum + getUserStreak(user), 0);

  if ($("statUsers")) $("statUsers").textContent = String(users.length);
  if ($("statVisitedToday")) $("statVisitedToday").textContent = String(visitedToday);
  if ($("statTotalStreak")) $("statTotalStreak").textContent = String(totalStreak);
}

function updateAllStats() {
  updateUserStats();

  if ($("statHomework")) $("statHomework").textContent = String(homeworks.length);
  if ($("statTabs")) $("statTabs").textContent = String(subjects.length);
  if ($("statPinned")) $("statPinned").textContent = String(homeworks.filter((item) => item.pinned).length);
}

// ============================================================
// USER EDITOR
// ============================================================
function openUserEditor(id) {
  const user = users.find((item) => item.id === id);
  if (!user) return;

  document.getElementById("userEditorModal")?.remove();

  const streak = getUserStreak(user);
  const longest = getUserLongest(user);
  const modal = document.createElement("div");
  modal.id = "userEditorModal";
  modal.innerHTML = `
    <div class="admin-modal-backdrop">
      <div class="admin-modal" role="dialog" aria-modal="true">
        <div class="admin-modal-header">
          <h2>✏️ Sửa người dùng</h2>
          <button type="button" id="closeUserEditor" class="icon-btn">×</button>
        </div>
        <div class="admin-form">
          <label>UID<input id="editUserUid" value="${esc(user.id)}" readonly></label>
          <label>Email profile<input id="editUserEmail" type="email" value="${esc(user.email || "")}"></label>
          <label>Tên tài khoản / Username<input id="editUserUsername" value="${esc(user.username || "")}"></label>
          <label>Tên hiển thị<input id="editUserDisplayName" value="${esc(user.displayName || user.name || "")}"></label>
          <label>🔥 Streak hiện tại<input id="editUserStreak" type="number" min="0" value="${streak}"></label>
          <label>🏆 Streak cao nhất<input id="editUserLongestStreak" type="number" min="0" value="${longest}"></label>
          <label>📅 Ngày truy cập cuối<input id="editUserLastVisit" value="${esc(user.lastVisitDate || "")}" placeholder="YYYY-MM-DD"></label>
          <div class="actions">
            <button type="button" id="saveUserChanges" class="primary">💾 Lưu thay đổi</button>
            <button type="button" id="deleteUserProfile" class="danger">🗑️ Xóa profile</button>
          </div>
          <p class="muted">⚠️ Sửa Email ở đây chỉ sửa thông tin trong Firestore profile. Không đổi email tài khoản Google/Firebase Authentication.</p>
          <p id="userEditorError" class="error"></p>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  $("closeUserEditor")?.addEventListener("click", () => modal.remove());
  modal.querySelector(".admin-modal-backdrop")?.addEventListener("click", (event) => {
    if (event.target.classList.contains("admin-modal-backdrop")) modal.remove();
  });

  $("saveUserChanges")?.addEventListener("click", async () => {
    const errorEl = $("userEditorError");
    const newUsername = $("editUserUsername").value.trim();
    const newDisplayName = $("editUserDisplayName").value.trim();
    const newEmail = $("editUserEmail").value.trim();
    const newStreak = Math.max(0, Math.floor(normalizeNumber($("editUserStreak").value, 0)));
    const newLongest = Math.max(newStreak, Math.floor(normalizeNumber($("editUserLongestStreak").value, 0)));
    const newLastVisit = $("editUserLastVisit").value.trim();

    if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      errorEl.textContent = "Email không hợp lệ.";
      return;
    }
    if (newLastVisit && !/^\d{4}-\d{2}-\d{2}$/.test(newLastVisit)) {
      errorEl.textContent = "Ngày truy cập phải có dạng YYYY-MM-DD.";
      return;
    }

    try {
      await setDoc(doc(db, "users", id), {
        email: newEmail,
        username: newUsername,
        displayName: newDisplayName,
        name: newDisplayName,
        streak: newStreak,
        currentStreak: newStreak,
        longestStreak: newLongest,
        highestStreak: newLongest,
        maxStreak: newLongest,
        lastVisitDate: newLastVisit,
        updatedAt: serverTimestamp()
      }, { merge: true });
      modal.remove();
    } catch (error) {
      console.error("Save user error:", error);
      errorEl.textContent = `Không thể lưu: ${error.message}`;
    }
  });

  $("deleteUserProfile")?.addEventListener("click", async () => {
    if (!confirm("Xóa profile Firestore của người này?\n\nTài khoản Google Authentication sẽ KHÔNG bị xóa.")) return;
    try {
      await deleteDoc(doc(db, "users", id));
      modal.remove();
    } catch (error) {
      console.error("Delete user error:", error);
      alert(`Không thể xóa: ${error.message}`);
    }
  });
}

// ============================================================
// SITE SETTINGS
// ============================================================
async function saveSiteSettings(changes) {
  try {
    await setDoc(doc(db, "settings", "site"), {
      ...changes,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Save site settings error:", error);
    alert(`Không thể lưu cài đặt: ${error.message}`);
    throw error;
  }
}

function renderSiteSettings() {
  const container = $("adminSettings");
  if (!container) return;

  const noHomeworkEnabled = siteSettings.noHomeworkNoticeEnabled !== false;
  const oldHomeworkEnabled = siteSettings.oldHomeworkNoticeEnabled !== false;

  container.innerHTML = `
    <div class="admin-setting-row">
      <div>
        <b>Thông báo bài tập không có cập nhật</b>
        <small>Khi sang ngày mới nhưng không có bài tập mới.</small>
      </div>
      <label class="switch">
        <input type="checkbox" id="noHomeworkNoticeToggle" ${noHomeworkEnabled ? "checked" : ""}>
        <span></span>
      </label>
    </div>

    <div class="admin-setting-row">
      <div>
        <b>Thông báo bài tập cũ chưa cập nhật</b>
        <small>Bật/tắt riêng khi danh sách bài tập vẫn giống ngày trước.</small>
      </div>
      <label class="switch">
        <input type="checkbox" id="oldHomeworkNoticeToggle" ${oldHomeworkEnabled ? "checked" : ""}>
        <span></span>
      </label>
    </div>

    <details class="admin-setting-details">
      <summary>✏️ Chỉnh nội dung 2 thông báo</summary>
      <label>Tiêu đề thông báo không có bài mới
        <input id="noHomeworkNoticeTitle" maxlength="120" value="${esc(siteSettings.noHomeworkNoticeTitle || "📚 Hôm nay không có bài tập mới")}">
      </label>
      <label>Nội dung thông báo không có bài mới
        <textarea id="noHomeworkNoticeMessage" rows="3">${esc(siteSettings.noHomeworkNoticeMessage || "Hôm nay chưa có bài tập mới được cập nhật.")}</textarea>
      </label>
      <label>Tiêu đề thông báo bài tập cũ
        <input id="oldHomeworkNoticeTitle" maxlength="120" value="${esc(siteSettings.oldHomeworkNoticeTitle || "📢 Bài tập chưa có cập nhật")}">
      </label>
      <label>Nội dung thông báo bài tập cũ
        <textarea id="oldHomeworkNoticeMessage" rows="3">${esc(siteSettings.oldHomeworkNoticeMessage || "Danh sách bài tập hôm nay vẫn giống ngày trước.")}</textarea>
      </label>
      <button type="button" id="saveNoticeTexts" class="primary">💾 Lưu nội dung thông báo</button>
    </details>
  `;

  $("noHomeworkNoticeToggle")?.addEventListener("change", async (event) => {
    try {
      await saveSiteSettings({ noHomeworkNoticeEnabled: event.target.checked });
    } catch {
      event.target.checked = !event.target.checked;
    }
  });

  $("oldHomeworkNoticeToggle")?.addEventListener("change", async (event) => {
    try {
      await saveSiteSettings({ oldHomeworkNoticeEnabled: event.target.checked });
    } catch {
      event.target.checked = !event.target.checked;
    }
  });

  $("saveNoticeTexts")?.addEventListener("click", async () => {
    const button = $("saveNoticeTexts");
    button.disabled = true;
    try {
      await saveSiteSettings({
        noHomeworkNoticeTitle: $("noHomeworkNoticeTitle").value.trim() || "📚 Hôm nay không có bài tập mới",
        noHomeworkNoticeMessage: $("noHomeworkNoticeMessage").value.trim() || "Hôm nay chưa có bài tập mới được cập nhật.",
        oldHomeworkNoticeTitle: $("oldHomeworkNoticeTitle").value.trim() || "📢 Bài tập chưa có cập nhật",
        oldHomeworkNoticeMessage: $("oldHomeworkNoticeMessage").value.trim() || "Danh sách bài tập hôm nay vẫn giống ngày trước."
      });
      alert("Đã lưu cài đặt thông báo.");
    } catch {
      // saveSiteSettings đã báo lỗi.
    } finally {
      button.disabled = false;
    }
  });
}

// ============================================================
// EXPOSE OPTIONAL FUNCTIONS FOR DEBUGGING / OTHER UI
// ============================================================
window.HomeworkAdmin = {
  get state() {
    return { subjects, homeworks, users, siteSettings };
  },
  refreshUsers: renderUsers,
  refreshSettings: renderSiteSettings,
  editUser: openUserEditor
};

console.log("Homework Hub Admin: ready");
