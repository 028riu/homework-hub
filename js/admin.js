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
  serverTimestamp,
  runTransaction,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const $ = (id) => document.getElementById(id);

const ADMINS = [
  "028riu@gmail.com",
  "tu0ngtun2gsahur8@gmail.com",
  "linh085760@gmail.com",
  "phuong026443@stu.vinschool.edu.vn"
].map((email) => email.toLowerCase());

const DAY = 86400000;
const TZ = "Asia/Ho_Chi_Minh";
let users = [];
let homeworks = [];
let subjects = [];
let settings = {};
let unsubscribers = [];
let selected = new Set();
let month = new Date();
let sort = "activity";

function esc(value = "") {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch]);
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isAdmin(email) {
  return !!email && ADMINS.includes(String(email).toLowerCase());
}

function parseDate(value) {
  if (!value) return null;
  try {
    if (typeof value.toDate === "function") return value.toDate();
    if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function dateKey(value) {
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date) : "";
}

function formatDate(value) {
  const date = parseDate(value);
  return date ? date.toLocaleString("vi-VN") : "Chưa có";
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function setHidden(id, hidden) {
  $(id)?.classList.toggle("hidden", hidden);
}

function openDialog(id) {
  const dialog = $(id);
  if (!dialog) return;
  if (typeof dialog.showModal === "function") dialog.showModal();
}

function closeDialog(id) {
  const dialog = $(id);
  if (dialog?.open) dialog.close();
}

function setLoginError(message = "") {
  if ($("loginError")) $("loginError").textContent = message;
}

$("googleLoginBtn")?.addEventListener("click", async () => {
  const button = $("googleLoginBtn");
  setLoginError("");
  button.disabled = true;
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Google login:", error);
    setLoginError(`Không thể đăng nhập: ${error.code || error.message}`);
  } finally {
    button.disabled = false;
  }
});

$("logoutBtn")?.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    setHidden("loginView", false);
    setHidden("dashboard", true);
    stopListeners();
    return;
  }
  if (!isAdmin(user.email)) {
    setHidden("loginView", false);
    setHidden("dashboard", true);
    setLoginError(`Tài khoản ${user.email || "này"} không có quyền quản trị.`);
    await signOut(auth).catch((error) => console.error("Admin sign-out:", error));
    return;
  }
  setLoginError("");
  setHidden("loginView", true);
  setHidden("dashboard", false);
  $("adminUser").textContent = `${user.displayName || "Admin"} · ${user.email || ""}`;
  startListeners();
});

function stopListeners() {
  unsubscribers.forEach((unsubscribe) => {
    try { unsubscribe?.(); } catch {}
  });
  unsubscribers = [];
}

async function loadUsersNow() {
  try {
    const snapshot = await getDocs(collection(db, "users"));
    users = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderUsers();
    renderOverview();
    renderStats();
    showToast(`👥 Đã tải ${users.length} người dùng`);
  } catch (error) {
    console.error("Load users:", error);
    showToast(`❌ Không tải được users: ${error.message}`);
  }
}

function startListeners() {
  stopListeners();

  unsubscribers.push(onSnapshot(collection(db, "users"), (snapshot) => {
    users = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderUsers();
    renderOverview();
    renderStats();
  }, (error) => {
    console.error("Users listener:", error);
    loadUsersNow();
  }));

  unsubscribers.push(onSnapshot(query(collection(db, "subjects"), orderBy("order", "asc")), (snapshot) => {
    subjects = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderSubjects();
    fillSubjectSelect();
    renderOverview();
    renderCalendar();
  }, (error) => console.error("Subjects listener:", error)));

  unsubscribers.push(onSnapshot(query(collection(db, "homework"), orderBy("createdAt", "desc")), (snapshot) => {
    homeworks = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderHomework();
    renderOverview();
    renderStats();
    renderCalendar();
  }, (error) => console.error("Homework listener:", error)));

  unsubscribers.push(onSnapshot(doc(db, "settings", "site"), (snapshot) => {
    settings = snapshot.exists() ? snapshot.data() : {};
    renderSettings();
  }, (error) => console.error("Settings listener:", error)));
}

function renderStats() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const active = users.filter((user) => dateKey(user.lastVisitAt || user.lastLoginAt || user.lastVisitDate) === today).length;
  const totalXP = users.reduce((sum, user) => sum + Math.max(0, num(user.totalXP)), 0);
  const totalPoints = users.reduce((sum, user) => sum + Math.max(0, num(user.points)), 0);
  const completed = users.reduce((sum, user) => sum + Math.max(0, num(user.completedHomeworkCount)), 0);
  $("statUsers").textContent = String(users.length);
  $("statHomework").textContent = String(homeworks.length);
  $("statActive").textContent = String(active);
  $("statXP").textContent = totalXP.toLocaleString("vi-VN");
  $("statPoints").textContent = totalPoints.toLocaleString("vi-VN");
  $("statCompleted").textContent = completed.toLocaleString("vi-VN");
}

function renderOverview() {
  const total = users.length;
  const average = total ? users.reduce((sum, user) => sum + num(user.currentStreak ?? user.streak), 0) / total : 0;
  const best = total ? Math.max(...users.map((user) => num(user.longestStreak ?? user.highestStreak ?? user.streak))) : 0;
  const points = users.reduce((sum, user) => sum + num(user.points), 0);
  const cards = [
    ["👥", "Users", total],
    ["🔥", "Streak TB", average.toFixed(1)],
    ["🏆", "Streak cao nhất", best],
    ["📚", "Môn học", subjects.length],
    ["📝", "Bài tập", homeworks.length],
    ["💎", "Points", points.toLocaleString("vi-VN")]
  ];
  if ($("overviewCards")) {
    $("overviewCards").innerHTML = cards.map(([icon, label, value]) => `<div class="overview-card"><span>${icon}</span><b>${esc(value)}</b><small>${label}</small></div>`).join("");
  }
  const ranked = [...users].sort((a, b) => num(b.currentStreak ?? b.streak) - num(a.currentStreak ?? a.streak)).slice(0, 8);
  $("topUsers").innerHTML = ranked.length ? ranked.map((user, index) => `<div class="rank-row"><b>#${index + 1}</b><span>${esc(user.displayName || user.name || user.email || user.id)}</span><small>🔥 ${num(user.currentStreak ?? user.streak)} · ⭐ ${num(user.totalXP)}</small></div>`).join("") : `<p class="muted">Chưa có người dùng.</p>`;
  $("recentHomework").innerHTML = homeworks.slice(0, 6).map((item) => `<div class="admin-item"><b>${item.pinned ? "📌 " : ""}${item.important ? "⭐ " : ""}${esc(item.title || "Bài tập")}</b><small>${esc(subjects.find((subject) => subject.id === item.subjectId)?.name || "Môn chưa rõ")} · ${esc(formatDate(item.createdAt))}</small></div>`).join("") || `<p class="muted">Chưa có bài.</p>`;
}

function renderUsers() {
  const container = $("adminUsers");
  if (!container) return;
  const q = ($("userSearch")?.value || "").trim().toLowerCase();
  let list = [...users];
  if (q) list = list.filter((user) => [user.id, user.uid, user.email, user.displayName, user.name, user.username].some((value) => String(value || "").toLowerCase().includes(q)));
  const value = (user) => num(user.currentStreak ?? user.streak);
  if (sort === "streak") list.sort((a, b) => value(b) - value(a));
  else if (sort === "xp") list.sort((a, b) => num(b.totalXP) - num(a.totalXP));
  else if (sort === "points") list.sort((a, b) => num(b.points) - num(a.points));
  else list.sort((a, b) => String(b.lastVisitAt || b.lastLoginAt || b.lastVisitDate || "").localeCompare(String(a.lastVisitAt || a.lastLoginAt || a.lastVisitDate || "")));

  container.innerHTML = list.length ? list.map((user) => {
    const name = user.displayName || user.name || user.email || user.id;
    const avatar = user.photoURL ? `<img class="avatar-img" src="${esc(user.photoURL)}" alt="Avatar" referrerpolicy="no-referrer">` : `<span class="avatar">${esc(name.charAt(0).toUpperCase())}</span>`;
    return `<div class="admin-item user-admin-item"><div class="user-main">${avatar}<div><b>${esc(name)}</b><small>📧 ${esc(user.email || "Không có email")}</small><small>🆔 ${esc(user.id)}</small><small>🔥 ${num(user.currentStreak ?? user.streak)} · 🏆 ${num(user.longestStreak ?? user.highestStreak ?? user.streak)} · ⭐ ${num(user.totalXP).toLocaleString("vi-VN")} XP · 💎 ${num(user.points).toLocaleString("vi-VN")}</small><small>🕒 ${esc(formatDate(user.lastVisitAt || user.lastLoginAt || user.lastVisitDate))}</small></div></div><div class="actions"><button type="button" data-user-edit="${esc(user.id)}">Sửa</button></div></div>`;
  }).join("") : `<p class="muted">${users.length ? "Không tìm thấy người dùng phù hợp." : "Chưa có người dùng."}</p>`;
}

$("userSearch")?.addEventListener("input", renderUsers);
$("userSort")?.addEventListener("change", (event) => { sort = event.target.value; renderUsers(); });
$("refreshUsers")?.addEventListener("click", loadUsersNow);

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-user-edit]");
  if (button) openUserEditor(button.dataset.userEdit);
});

function openUserEditor(id) {
  const user = users.find((item) => item.id === id);
  if (!user) return;
  $("userEditorModal")?.remove();
  const modal = document.createElement("div");
  modal.id = "userEditorModal";
  modal.innerHTML = `<div class="admin-modal-backdrop"><div class="admin-modal"><div class="admin-modal-header"><div><p class="eyebrow">USER CONTROL</p><h2>👤 ${esc(user.displayName || user.email || user.id)}</h2></div><button class="icon-btn" id="closeUserEditor" type="button" aria-label="Đóng">×</button></div><div class="admin-form"><label>Email profile<input id="euEmail" value="${esc(user.email || "")}"></label><label>Username<input id="euUsername" value="${esc(user.username || "")}"></label><label>Tên hiển thị<input id="euName" value="${esc(user.displayName || user.name || "")}"></label><div class="form-2"><label>🔥 Streak<input id="euStreak" type="number" min="0" value="${num(user.currentStreak ?? user.streak)}"></label><label>🏆 Cao nhất<input id="euLongest" type="number" min="0" value="${num(user.longestStreak ?? user.highestStreak ?? user.streak)}"></label><label>⭐ Total XP<input id="euXP" type="number" min="0" value="${num(user.totalXP)}"></label><label>💎 Points<input id="euPoints" type="number" min="0" value="${num(user.points)}"></label></div><label>📅 Last visit<input id="euDate" placeholder="YYYY-MM-DD" value="${esc(user.lastVisitDate || "")}"></label><h3>🐾 Pet</h3><div class="form-2"><label>Skin<input id="euSkin" value="${esc(user.pet?.skin || "default")}"></label><label>Pet type<input id="euPet" value="${esc(user.pet?.type || "flamey")}"></label></div><label>🎁 Unlock items<input id="euItems" value="${esc((user.unlockedItems || []).join(", "))}"></label><div class="reward-buttons"><button type="button" data-reward="100xp">+100 XP</button><button type="button" data-reward="500xp">+500 XP</button><button type="button" data-reward="500p">+500 Points</button><button type="button" data-reward="reset">Reset Streak</button></div><div class="actions"><button class="primary" id="saveUser" type="button">💾 Lưu toàn bộ</button><button class="danger" id="deleteUser" type="button">🗑 Xóa profile</button></div><p id="ueError" class="error"></p></div></div></div>`;
  document.body.appendChild(modal);
  $("closeUserEditor").onclick = () => modal.remove();
  modal.querySelector(".admin-modal-backdrop").onclick = (event) => { if (event.target.classList.contains("admin-modal-backdrop")) modal.remove(); };

  modal.querySelectorAll("[data-reward]").forEach((button) => button.addEventListener("click", async () => {
    try {
      await rewardUser(id, button.dataset.reward);
      if (button.dataset.reward === "reset") $("euStreak").value = 0;
      if (button.dataset.reward === "100xp") $("euXP").value = num($("euXP").value) + 100;
      if (button.dataset.reward === "500xp") $("euXP").value = num($("euXP").value) + 500;
      if (button.dataset.reward === "500p") $("euPoints").value = num($("euPoints").value) + 500;
    } catch (error) {
      $("ueError").textContent = error.message;
    }
  }));

  $("saveUser").onclick = async () => {
    const error = $("ueError");
    error.textContent = "";
    try {
      const streak = Math.max(0, Math.floor(num($("euStreak").value)));
      const longest = Math.max(streak, Math.floor(num($("euLongest").value)));
      const xp = Math.max(0, Math.floor(num($("euXP").value)));
      const points = Math.max(0, Math.floor(num($("euPoints").value)));
      const email = $("euEmail").value.trim();
      const lastVisit = $("euDate").value.trim();
      if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Email không hợp lệ.");
      if (lastVisit && !/^\d{4}-\d{2}-\d{2}$/.test(lastVisit)) throw new Error("Ngày phải có dạng YYYY-MM-DD.");
      await setDoc(doc(db, "users", id), {
        email,
        username: $("euUsername").value.trim(),
        displayName: $("euName").value.trim(),
        name: $("euName").value.trim(),
        streak,
        currentStreak: streak,
        highestStreak: longest,
        longestStreak: longest,
        maxStreak: longest,
        totalXP: xp,
        points,
        level: Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1),
        lastVisitDate: lastVisit,
        pet: { ...(user.pet || {}), type: $("euPet").value.trim() || "flamey", skin: $("euSkin").value.trim() || "default" },
        unlockedItems: $("euItems").value.split(",").map((item) => item.trim()).filter(Boolean),
        updatedAt: serverTimestamp()
      }, { merge: true });
      modal.remove();
      showToast("✅ Đã lưu người dùng");
    } catch (error2) {
      console.error("Save user:", error2);
      error.textContent = `Không thể lưu: ${error2.message}`;
    }
  };

  $("deleteUser").onclick = async () => {
    if (!confirm("Xóa profile Firestore? Tài khoản Google Authentication không bị xóa.")) return;
    try {
      await deleteDoc(doc(db, "users", id));
      modal.remove();
      showToast("🗑️ Đã xóa profile");
    } catch (error) {
      $("ueError").textContent = error.message;
    }
  };
}

async function rewardUser(id, reward) {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "users", id);
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    let xp = num(data.totalXP);
    let points = num(data.points);
    let streak = num(data.currentStreak ?? data.streak);
    if (reward === "100xp") xp += 100;
    if (reward === "500xp") xp += 500;
    if (reward === "500p") points += 500;
    if (reward === "reset") streak = 0;
    tx.set(ref, { totalXP: xp, points, streak, currentStreak: streak, level: Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1), updatedAt: serverTimestamp() }, { merge: true });
  });
}

function renderSubjects() {
  $("adminTabs").innerHTML = subjects.map((subject) => `<div class="admin-item"><b>${esc(subject.icon || "📚")} ${esc(subject.name || "Môn học")}</b><small>Thứ tự: ${num(subject.order)}</small><div class="actions"><button data-action="edit-subject" data-id="${esc(subject.id)}">Sửa</button><button class="danger" data-action="delete-subject" data-id="${esc(subject.id)}">Xóa</button></div></div>`).join("") || `<p class="muted">Chưa có môn.</p>`;
}

function fillSubjectSelect(selectedId = "") {
  const select = $("hwTab");
  if (!select) return;
  select.innerHTML = subjects.map((subject) => `<option value="${esc(subject.id)}">${esc(subject.icon || "📚")} ${esc(subject.name || "Môn học")}</option>`).join("") || `<option value="">Chưa có môn</option>`;
  if (selectedId) select.value = selectedId;
}

function addHomeworkLink(value = "") {
  const list = $("hwLinksList");
  if (!list) return;
  const row = document.createElement("div");
  row.className = "hw-link-row";
  row.innerHTML = `<input class="hw-link-input" type="url" placeholder="https://..." value="${esc(value)}" autocomplete="off"><button class="ghost small remove-hw-link" type="button" aria-label="Xóa link">×</button>`;
  row.querySelector(".remove-hw-link").onclick = () => {
    const rows = list.querySelectorAll(".hw-link-row");
    if (rows.length <= 1) row.querySelector(".hw-link-input").value = "";
    else row.remove();
  };
  list.appendChild(row);
}

function setHomeworkLinks(values = []) {
  const list = $("hwLinksList");
  if (!list) return;
  list.innerHTML = "";
  const valid = Array.isArray(values) ? values.filter(Boolean) : [];
  (valid.length ? valid : [""]).forEach((value) => addHomeworkLink(value));
}

function getHomeworkLinks() {
  return [...document.querySelectorAll("#hwLinksList .hw-link-input")].map((input) => input.value.trim()).filter(Boolean);
}

function renderHomework() {
  const container = $("adminHomework");
  if (!container) return;
  container.innerHTML = homeworks.map((item) => `<div class="admin-item hw-admin-row"><label class="select-check"><input type="checkbox" data-hw-select="${esc(item.id)}" ${selected.has(item.id) ? "checked" : ""}></label><div><b>${item.pinned ? "📌 " : ""}${item.important ? "⭐ " : ""}${esc(item.title || "Bài tập")}</b><small>${esc(subjects.find((subject) => subject.id === item.subjectId)?.name || "Chưa phân loại")} · ${esc(formatDate(item.dueDate))}</small><small>${esc(item.content || "").slice(0, 180)}</small><small>${Array.isArray(item.links) && item.links.length ? `🔗 ${item.links.length} link` : ""}</small></div><div class="actions"><button data-action="edit-homework" data-id="${esc(item.id)}">Sửa</button><button class="danger" data-action="delete-homework" data-id="${esc(item.id)}">Xóa</button></div></div>`).join("") || `<p class="muted">Chưa có bài.</p>`;
  container.querySelectorAll("[data-hw-select]").forEach((input) => input.addEventListener("change", () => input.checked ? selected.add(input.dataset.hwSelect) : selected.delete(input.dataset.hwSelect)));
}

$("addHomeworkLink")?.addEventListener("click", () => addHomeworkLink());

$("newHomework")?.addEventListener("click", () => {
  if (!subjects.length) return alert("Hãy tạo môn trước.");
  $("homeworkForm")?.reset();
  $("hwId").value = "";
  $("hwDialogTitle").textContent = "Tạo bài tập";
  $("hwError").textContent = "";
  setHomeworkLinks([]);
  fillSubjectSelect();
  openDialog("homeworkDialog");
});

$("newTab")?.addEventListener("click", () => {
  $("tabForm")?.reset();
  $("tabId").value = "";
  $("tabDialogTitle").textContent = "Tạo môn học";
  $("tabError").textContent = "";
  openDialog("tabDialog");
});

$("homeworkForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = $("hwError");
  error.textContent = "";
  const id = $("hwId").value.trim();
  const old = homeworks.find((item) => item.id === id);
  const title = $("hwTitle").value.trim();
  const content = $("hwContent").value.trim();
  const subjectId = $("hwTab").value;
  const links = getHomeworkLinks();
  if (!subjectId || !title || !content) {
    error.textContent = "Vui lòng nhập môn, tiêu đề và nội dung.";
    return;
  }
  try {
    await setDoc(doc(db, "homework", id || crypto.randomUUID()), {
      subjectId,
      title,
      content,
      links,
      url: links[0] || "",
      dueDate: $("hwDue").value || null,
      pinned: $("hwPinned").checked,
      important: $("hwImportant").checked,
      createdAt: old?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    closeDialog("homeworkDialog");
    showToast("✅ Đã lưu bài tập");
  } catch (saveError) {
    console.error("Save homework:", saveError);
    error.textContent = `Không thể lưu: ${saveError.message}`;
  }
});

$("tabForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = $("tabError");
  error.textContent = "";
  const id = $("tabId").value.trim();
  const old = subjects.find((item) => item.id === id);
  const name = $("tabName").value.trim();
  if (!name) {
    error.textContent = "Vui lòng nhập tên môn.";
    return;
  }
  const order = old ? num(old.order) : (subjects.length ? Math.max(...subjects.map((item) => num(item.order))) + 1 : 1);
  try {
    await setDoc(doc(db, "subjects", id || crypto.randomUUID()), { name, icon: $("tabIcon").value.trim() || "📚", order, updatedAt: serverTimestamp() });
    closeDialog("tabDialog");
    showToast("✅ Đã lưu môn học");
  } catch (saveError) {
    error.textContent = `Không thể lưu: ${saveError.message}`;
  }
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const id = button.dataset.id;
  try {
    if (button.dataset.action === "edit-homework") {
      const item = homeworks.find((homework) => homework.id === id);
      if (!item) return;
      $("hwDialogTitle").textContent = "Sửa bài tập";
      $("hwId").value = id;
      $("hwTitle").value = item.title || "";
      $("hwContent").value = item.content || "";
      $("hwDue").value = item.dueDate || "";
      $("hwPinned").checked = Boolean(item.pinned);
      $("hwImportant").checked = Boolean(item.important);
      $("hwError").textContent = "";
      fillSubjectSelect(item.subjectId || "");
      setHomeworkLinks(Array.isArray(item.links) ? item.links : (item.url ? [item.url] : []));
      openDialog("homeworkDialog");
    }
    if (button.dataset.action === "delete-homework" && confirm("Xóa bài này?")) {
      await deleteDoc(doc(db, "homework", id));
      showToast("🗑️ Đã xóa bài tập");
    }
    if (button.dataset.action === "edit-subject") {
      const subject = subjects.find((item) => item.id === id);
      if (!subject) return;
      $("tabId").value = id;
      $("tabName").value = subject.name || "";
      $("tabIcon").value = subject.icon || "";
      $("tabDialogTitle").textContent = "Sửa môn học";
      openDialog("tabDialog");
    }
    if (button.dataset.action === "delete-subject") {
      if (homeworks.some((item) => item.subjectId === id)) return alert("Môn này đang có bài tập.");
      if (confirm("Xóa môn này?")) await deleteDoc(doc(db, "subjects", id));
    }
  } catch (error) {
    console.error("Admin action:", error);
    alert(error.message);
  }
});

document.querySelectorAll("[data-bulk]").forEach((button) => button.addEventListener("click", async () => {
  const action = button.dataset.bulk;
  if (!selected.size) return alert("Hãy chọn ít nhất một bài.");
  if (action === "delete" && !confirm(`Xóa ${selected.size} bài?`)) return;
  try {
    for (const id of selected) {
      if (action === "delete") await deleteDoc(doc(db, "homework", id));
      else await setDoc(doc(db, "homework", id), { pinned: action === "pin", updatedAt: serverTimestamp() }, { merge: true });
    }
    selected.clear();
    renderHomework();
    showToast("✅ Đã xử lý các bài được chọn");
  } catch (error) {
    alert(error.message);
  }
}));

function renderCalendar() {
  const year = month.getFullYear();
  const currentMonth = month.getMonth();
  $("calendarTitle").textContent = `Tháng ${currentMonth + 1}/${year}`;
  const first = new Date(year, currentMonth, 1);
  const days = new Date(year, currentMonth + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  let html = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => `<div class="cal-head">${day}</div>`).join("");
  for (let i = 0; i < offset; i += 1) html += `<div class="cal-day empty-day"></div>`;
  for (let day = 1; day <= days; day += 1) {
    const key = `${year}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const list = homeworks.filter((item) => dateKey(item.createdAt) === key || String(item.dueDate || "").startsWith(key));
    html += `<button class="cal-day ${list.length ? "has-homework" : ""}" data-date="${key}" type="button"><b>${day}</b>${list.length ? `<span>${list.length} bài</span>` : ""}</button>`;
  }
  $("calendar").innerHTML = html;
  document.querySelectorAll("[data-date]").forEach((button) => button.addEventListener("click", () => {
    const key = button.dataset.date;
    const list = homeworks.filter((item) => dateKey(item.createdAt) === key || String(item.dueDate || "").startsWith(key));
    $("calendarDetails").innerHTML = `<b>${esc(key)}</b>${list.length ? list.map((item) => `<div class="admin-item"><b>${esc(item.title)}</b><small>${esc(subjects.find((subject) => subject.id === item.subjectId)?.name || "")}</small></div>`).join("") : `<p>Không có bài tập.</p>`}`;
  }));
}

$("prevMonth")?.addEventListener("click", () => { month.setMonth(month.getMonth() - 1); renderCalendar(); });
$("nextMonth")?.addEventListener("click", () => { month.setMonth(month.getMonth() + 1); renderCalendar(); });

function renderSettings() {
  const current = settings.site || settings || {};
  $("adminSettings").innerHTML = `<label class="setting-card"><span><b>🔔 Thông báo không có bài mới</b><small>Bật cảnh báo khi hôm nay chưa có bài mới.</small></span><input id="setNo" type="checkbox" ${current.noHomeworkNoticeEnabled !== false ? "checked" : ""}></label><label class="setting-card"><span><b>📢 Thông báo bài cũ</b><small>Bật cảnh báo khi danh sách chưa cập nhật.</small></span><input id="setOld" type="checkbox" ${current.oldHomeworkNoticeEnabled !== false ? "checked" : ""}></label><label class="setting-card"><span><b>🎁 XP hoàn thành bài</b><small>XP nhận được khi đánh dấu hoàn thành.</small></span><input id="setXP" type="number" min="0" value="${num(current.xpPerHomework, 30)}"></label><label class="setting-card"><span><b>💎 Points hoàn thành bài</b><small>Points nhận được khi đánh dấu hoàn thành.</small></span><input id="setPoints" type="number" min="0" value="${num(current.pointsPerHomework, 20)}"></label><label>Tiêu đề thông báo<textarea id="setTitle" rows="2">${esc(current.noHomeworkNoticeTitle || "📚 Hôm nay không có bài tập mới")}</textarea></label><label>Nội dung thông báo<textarea id="setMsg" rows="3">${esc(current.noHomeworkNoticeMessage || "Hôm nay chưa có bài tập mới được cập nhật.")}</textarea></label>`;
}

$("saveAllSettings")?.addEventListener("click", async () => {
  try {
    await setDoc(doc(db, "settings", "site"), {
      noHomeworkNoticeEnabled: $("setNo").checked,
      oldHomeworkNoticeEnabled: $("setOld").checked,
      xpPerHomework: Math.max(0, Math.floor(num($("setXP").value, 30))),
      pointsPerHomework: Math.max(0, Math.floor(num($("setPoints").value, 20))),
      noHomeworkNoticeTitle: $("setTitle").value.trim() || "📚 Hôm nay không có bài tập mới",
      noHomeworkNoticeMessage: $("setMsg").value.trim() || "Hôm nay chưa có bài tập mới được cập nhật.",
      updatedAt: serverTimestamp()
    }, { merge: true });
    showToast("✅ Đã lưu cài đặt");
  } catch (error) {
    alert(error.message);
  }
});

document.querySelectorAll(".admin-tab").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".admin-tab").forEach((item) => item.classList.toggle("active", item === button));
  document.querySelectorAll(".admin-page").forEach((page) => page.classList.toggle("hidden", page.dataset.page !== button.dataset.adminTab));
  if (button.dataset.adminTab === "calendar") renderCalendar();
}));

window.HomeworkAdmin = {
  get state() { return { users, homeworks, subjects, settings }; },
  refreshUsers: loadUsersNow,
  editUser: openUserEditor,
  rewardUser
};

console.log("Homework Hub Admin: ready");
