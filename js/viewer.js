import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, collection, doc, onSnapshot, query, orderBy, setDoc, serverTimestamp, runTransaction, getDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const $ = (id) => document.getElementById(id);
const TZ = "Asia/Ho_Chi_Minh";
const DAY = 86400000;

let user = null;
let profile = null;
let subjects = [];
let homework = [];
let progress = {};
let items = [];
let settings = {
  xpPerHomework: 30,
  pointsPerHomework: 20,
  dailyXP: 100,
  dailyPoints: 50,
  noHomeworkNoticeEnabled: true,
  oldHomeworkNoticeEnabled: true,
  noHomeworkNoticeTitle: "📚 Hôm nay không có bài tập mới",
  noHomeworkNoticeMessage: "Hôm nay chưa có bài tập mới được cập nhật."
};
let activeTab = "all";
let searchText = "";
let unsubs = [];

const localPrefs = {
  theme: localStorage.getItem("hh_theme") || "dark",
  accent: localStorage.getItem("hh_accent") || "purple",
  background: localStorage.getItem("hh_bg") || "default",
  petEnabled: localStorage.getItem("hh_pet_enabled") !== "0",
  petX: Number(localStorage.getItem("hh_pet_x") || 0),
  petY: Number(localStorage.getItem("hh_pet_y") || 0)
};

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}
function dateKey(value = new Date()) {
  const d = value instanceof Date ? value : parseDate(value) || new Date();
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}
function parseDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "object" && Number.isFinite(value.seconds)) return new Date(value.seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
function levelFromXP(xp) {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1);
}
function levelBounds(level) {
  return { current: level <= 1 ? 0 : (level - 1) ** 2 * 100, next: level ** 2 * 100 };
}
function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.appendChild(node);
  requestAnimationFrame(() => node.classList.add("show"));
  setTimeout(() => node.remove(), 2400);
}
function applyPrefs() {
  const light = localPrefs.theme === "light" || (localPrefs.theme === "system" && matchMedia("(prefers-color-scheme: light)").matches);
  document.body.classList.toggle("light", light);
  document.documentElement.dataset.accent = localPrefs.accent;
  document.documentElement.dataset.background = localPrefs.background;
  document.body.dataset.bg = localPrefs.background;
  const pet = $("floatingPet");
  if (pet) {
    pet.classList.toggle("hidden", !user || !localPrefs.petEnabled);
    if (localPrefs.petX && localPrefs.petY) {
      pet.style.left = `${Math.max(5, Math.min(window.innerWidth - 75, localPrefs.petX))}px`;
      pet.style.top = `${Math.max(65, Math.min(window.innerHeight - 80, localPrefs.petY))}px`;
      pet.style.right = "auto";
      pet.style.bottom = "auto";
    }
  }
}
function renderAuth() {
  const area = $("userArea");
  if (!user) {
    area.innerHTML = `<button id="googleLogin" class="google-mini" type="button">G&nbsp; Đăng nhập Google</button>`;
    $("googleLogin").onclick = () => signInWithPopup(auth, provider).catch((e) => toast(`Không thể đăng nhập: ${e.message}`));
    $("greeting").textContent = "Đăng nhập để lưu tiến độ, Streak, XP và Pet trên mọi thiết bị.";
    return;
  }
  const name = user.displayName || user.email || "Bạn";
  const initial = (name.trim()[0] || "U").toUpperCase();
  area.innerHTML = `<div class="user-pill"><img src="${esc(user.photoURL || "")}" alt="" onerror="this.style.display='none'"><span class="avatar">${esc(initial)}</span><div><b>${esc(name)}</b><small>🔥 <span id="userStreak">${num(profile?.currentStreak ?? profile?.streak)}</span> ngày</small></div><button id="logoutGoogle" class="logout-mini" type="button">Thoát</button></div>`;
  const img = area.querySelector("img");
  if (img && user.photoURL) img.onload = () => { area.querySelector(".avatar").style.display = "none"; };
  $("logoutGoogle").onclick = () => signOut(auth).catch(console.error);
  $("greeting").textContent = `Chào ${name} 👋 Hôm nay mình làm bài nhé!`;
}
async function ensureProfile(u) {
  const ref = doc(db, "users", u.uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const old = snap.exists() ? snap.data() : {};
    const today = dateKey();
    let streak = Math.max(0, num(old.currentStreak ?? old.streak));
    let longest = Math.max(streak, num(old.longestStreak ?? old.highestStreak));
    let xp = Math.max(0, num(old.totalXP));
    let points = Math.max(0, num(old.points));
    const last = old.lastVisitDate || "";
    if (last !== today) {
      const previous = last ? new Date(`${last}T12:00:00+07:00`) : null;
      const current = new Date(`${today}T12:00:00+07:00`);
      const gap = previous ? Math.round((current - previous) / DAY) : 0;
      streak = last && gap === 1 ? streak + 1 : 1;
      longest = Math.max(longest, streak);
      xp += 20;
      points += 10;
    }
    tx.set(ref, {
      uid: u.uid,
      email: u.email || old.email || "",
      displayName: u.displayName || old.displayName || u.email || "Bạn",
      photoURL: u.photoURL || old.photoURL || "",
      currentStreak: streak,
      streak,
      longestStreak: longest,
      highestStreak: longest,
      totalXP: xp,
      points,
      level: levelFromXP(xp),
      lastVisitDate: today,
      lastLoginAt: serverTimestamp(),
      lastVisitAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      pet: {
        type: old.pet?.type || "flamey",
        skin: old.pet?.skin || "default",
        position: old.pet?.position || { x: 0, y: 0 }
      },
      unlockedItems: Array.isArray(old.unlockedItems) ? old.unlockedItems : [],
      equippedItems: Array.isArray(old.equippedItems) ? old.equippedItems : []
    }, { merge: true });
  });
}
function clearSubscriptions() {
  unsubs.forEach((fn) => { try { fn(); } catch {} });
  unsubs = [];
  progress = {};
}
function startRealtime() {
  clearSubscriptions();
  unsubs.push(onSnapshot(query(collection(db, "subjects"), orderBy("order", "asc")), (snap) => {
    subjects = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderTabs(); renderHomework();
  }, (e) => console.error("Subjects:", e)));
  unsubs.push(onSnapshot(query(collection(db, "homework"), orderBy("createdAt", "desc")), (snap) => {
    homework = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderHomework(); renderNotice(); renderStats();
  }, (e) => console.error("Homework:", e)));
  unsubs.push(onSnapshot(doc(db, "settings", "site"), (snap) => {
    if (snap.exists()) settings = { ...settings, ...snap.data() };
    renderHomework(); renderNotice(); renderSettingsDialog();
  }, (e) => console.error("Settings:", e)));
  unsubs.push(onSnapshot(collection(db, "items"), (snap) => {
    items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, (e) => console.error("Items:", e)));
  if (user) {
    unsubs.push(onSnapshot(doc(db, "users", user.uid), (snap) => {
      profile = snap.exists() ? snap.data() : null;
      renderStats(); renderAuth(); applyPrefs();
    }, (e) => console.error("Profile:", e)));
    unsubs.push(onSnapshot(collection(db, "users", user.uid, "homeworkProgress"), (snap) => {
      progress = {};
      snap.docs.forEach((d) => { progress[d.id] = d.data(); });
      renderHomework(); renderStats();
    }, (e) => console.error("Progress:", e)));
  }
}
function renderStats() {
  const streak = Math.max(0, num(profile?.currentStreak ?? profile?.streak));
  const xp = Math.max(0, num(profile?.totalXP));
  const points = Math.max(0, num(profile?.points));
  const level = Math.max(1, num(profile?.level, levelFromXP(xp)));
  const bounds = levelBounds(level);
  const pct = Math.min(100, Math.max(0, ((xp - bounds.current) / Math.max(1, bounds.next - bounds.current)) * 100));
  $("heroStreak").textContent = user ? streak : "—";
  $("heroLevel").textContent = user ? `Lv.${level}` : "—";
  $("heroPoints").textContent = user ? points.toLocaleString("vi-VN") : "—";
  $("xpLevelText").textContent = user ? `⭐ Level ${level}` : "Đăng nhập để bắt đầu";
  $("xpText").textContent = user ? `${xp.toLocaleString("vi-VN")} / ${bounds.next.toLocaleString("vi-VN")} XP · còn ${Math.max(0, bounds.next - xp).toLocaleString("vi-VN")} XP` : "XP và tiến độ sẽ được lưu bằng Firebase.";
  $("xpPercent").textContent = user ? `${Math.round(pct)}%` : "0%";
  $("xpBar").style.width = `${user ? pct : 0}%`;
  const today = dateKey();
  const todayHomework = homework.filter((h) => dateKey(parseDate(h.createdAt)) === today);
  const done = todayHomework.filter((h) => progress[h.id]?.completed).length;
  $("dailyProgress").textContent = `☑ ${done} / ${todayHomework.length} bài hôm nay`;
  if ($("userStreak")) $("userStreak").textContent = String(streak);
  $("today").textContent = new Intl.DateTimeFormat("vi-VN", { dateStyle: "full", timeZone: TZ }).format(new Date());
}
function renderTabs() {
  const all = `<button class="tab ${activeTab === "all" ? "active" : ""}" data-tab="all" type="button">✨ Tất cả</button>`;
  const rest = subjects.map((s) => `<button class="tab ${activeTab === s.id ? "active" : ""}" data-tab="${esc(s.id)}" type="button">${esc(s.icon || "📚")} ${esc(s.name || "Môn học")}</button>`).join("");
  $("tabs").innerHTML = all + rest;
  document.querySelectorAll(".tab").forEach((button) => { button.onclick = () => { activeTab = button.dataset.tab; renderTabs(); renderHomework(); }; });
}
function renderHomework() {
  const queryText = searchText.toLowerCase().trim();
  const list = homework.filter((h) => {
    const subjectOk = activeTab === "all" || h.subjectId === activeTab;
    const text = `${h.title || ""} ${h.content || ""}`.toLowerCase();
    return subjectOk && (!queryText || text.includes(queryText));
  }).sort((a, b) => Number(b.pinned) - Number(a.pinned));
  $("status").textContent = `${list.length} bài tập${activeTab === "all" ? "" : " trong môn đã chọn"}`;
  $("empty").classList.toggle("hidden", list.length !== 0);
  $("homeworkList").innerHTML = list.map((h, index) => {
    const subject = subjects.find((s) => s.id === h.subjectId);
    const due = parseDate(h.dueDate);
    const overdue = due && due < new Date();
    const done = Boolean(progress[h.id]?.completed);
    const xpReward = Math.max(0, num(settings.xpPerHomework, 30));
    return `<article class="card ${h.pinned ? "pinned" : ""} ${done ? "completed" : ""}" style="animation-delay:${Math.min(index,10) * 25}ms">
      <div class="card-top"><span class="subject">${esc(subject?.icon || "📚")} ${esc(subject?.name || "Chưa phân loại")}</span><span class="badge ${overdue ? "red" : ""}">${h.pinned ? "📌 Ghim" : h.important ? "⭐ Quan trọng" : "Mới"}</span></div>
      <h2>${esc(h.title || "Bài tập")}</h2><div class="content">${esc(h.content || "")}</div>
      ${due ? `<div class="due ${overdue ? "red" : ""}">⏰ Hạn: ${esc(due.toLocaleString("vi-VN", { dateStyle:"medium", timeStyle:"short" }))} · ${overdue ? "Đã hết hạn" : "Còn hạn"}</div>` : ""}
      <div class="card-footer"><label class="task-check"><input type="checkbox" data-homework="${esc(h.id)}" ${done ? "checked" : ""}><span></span><b>${done ? "Đã hoàn thành" : "Đã làm"}</b></label><span class="xp-chip">⭐ +${xpReward} XP · 💎 +${num(settings.pointsPerHomework,20)} P</span></div>
    </article>`;
  }).join("");
  document.querySelectorAll("[data-homework]").forEach((input) => { input.onchange = () => completeHomework(input.dataset.homework, input.checked); });
  $("clearSearch").classList.toggle("hidden", !searchText);
}
function renderNotice() {
  const today = dateKey();
  const todayHomework = homework.filter((h) => dateKey(parseDate(h.createdAt)) === today);
  const notice = $("updateNotice");
  if (!notice) return;
  if (todayHomework.length === 0 && settings.noHomeworkNoticeEnabled) {
    $("noticeTitle").textContent = settings.noHomeworkNoticeTitle || "📚 Hôm nay không có bài tập mới";
    $("noticeText").textContent = settings.noHomeworkNoticeMessage || "Hôm nay chưa có bài tập mới được cập nhật.";
    notice.classList.remove("hidden");
  } else {
    notice.classList.add("hidden");
  }
}
async function completeHomework(homeworkId, checked) {
  if (!user) {
    toast("Hãy đăng nhập Google trước nhé!");
    renderHomework();
    return;
  }
  const progressRef = doc(db, "users", user.uid, "homeworkProgress", homeworkId);
  const userRef = doc(db, "users", user.uid);
  const xpReward = Math.max(0, num(settings.xpPerHomework, 30));
  const pointsReward = Math.max(0, num(settings.pointsPerHomework, 20));
  try {
    if (!checked) {
      await runTransaction(db, async (tx) => {
        const ps = await tx.get(progressRef);
        const us = await tx.get(userRef);
        if (!ps.exists() || !ps.data().completed) return;
        const old = us.exists() ? us.data() : {};
        const earnedXP = num(ps.data().xp, xpReward);
        const earnedPoints = num(ps.data().points, pointsReward);
        tx.set(progressRef, { completed: false, updatedAt: serverTimestamp() }, { merge: true });
        tx.set(userRef, { totalXP: Math.max(0, num(old.totalXP) - earnedXP), points: Math.max(0, num(old.points) - earnedPoints), completedHomeworkCount: Math.max(0, num(old.completedHomeworkCount) - 1), updatedAt: serverTimestamp() }, { merge: true });
      });
      toast("↩️ Đã bỏ hoàn thành bài.");
      return;
    }
    await runTransaction(db, async (tx) => {
      const ps = await tx.get(progressRef);
      const us = await tx.get(userRef);
      if (ps.exists() && ps.data().completed) return;
      const old = us.exists() ? us.data() : {};
      const today = dateKey();
      const todayHomework = homework.filter((h) => dateKey(parseDate(h.createdAt)) === today);
      const willCompleteAll = todayHomework.length > 0 && todayHomework.every((h) => h.id === homeworkId || progress[h.id]?.completed);
      const dailyAlready = old.dailyRewardDate === today;
      const bonusXP = willCompleteAll && !dailyAlready ? Math.max(0, num(settings.dailyXP,100)) : 0;
      const bonusPoints = willCompleteAll && !dailyAlready ? Math.max(0, num(settings.dailyPoints,50)) : 0;
      const xp = Math.max(0, num(old.totalXP) + xpReward + bonusXP);
      const points = Math.max(0, num(old.points) + pointsReward + bonusPoints);
      tx.set(progressRef, { homeworkId, completed: true, completedAt: serverTimestamp(), xp: xpReward, points: pointsReward }, { merge: true });
      tx.set(userRef, { totalXP: xp, points, level: levelFromXP(xp), completedHomeworkCount: num(old.completedHomeworkCount) + 1, ...(bonusXP ? { dailyRewardDate: today } : {}), updatedAt: serverTimestamp() }, { merge: true });
      if (willCompleteAll && !dailyAlready) window.__dailyBonus = { xp: bonusXP, points: bonusPoints };
    });
    const bonus = window.__dailyBonus || { xp: 0, points: 0 };
    window.__dailyBonus = null;
    toast(bonus.xp ? `🎉 Hoàn thành toàn bộ! +${xpReward + bonus.xp} XP · +${pointsReward + bonus.points} Points` : `✨ +${xpReward} XP · +${pointsReward} Points`);
  } catch (error) {
    console.error(error);
    toast(`Không thể cập nhật: ${error.message}`);
    renderHomework();
  }
}
function renderSettingsDialog() {
  $("petEnabled").checked = localPrefs.petEnabled;
  document.querySelectorAll("[data-theme]").forEach((b) => b.classList.toggle("active", b.dataset.theme === localPrefs.theme));
  document.querySelectorAll("[data-accent]").forEach((b) => b.classList.toggle("active", b.dataset.accent === localPrefs.accent));
  document.querySelectorAll("[data-bg]").forEach((b) => b.classList.toggle("active", b.dataset.bg === localPrefs.background));
}
function openProfile() {
  if (!user || !profile) { toast("Hãy đăng nhập để xem hồ sơ."); return; }
  const name = user.displayName || profile.displayName || "Bạn";
  const xp = num(profile.totalXP), points = num(profile.points), streak = num(profile.currentStreak ?? profile.streak), longest = num(profile.longestStreak ?? profile.highestStreak);
  $("profileContent").innerHTML = `<div class="panel-title"><div><p class="eyebrow">YOUR PROFILE</p><h2>👤 ${esc(name)}</h2><p class="muted">${esc(user.email || "")}</p></div><button class="icon-btn" id="closeProfile" type="button">×</button></div><div class="profile-stats"><div class="profile-stat"><b>🔥 ${streak}</b><small>Streak</small></div><div class="profile-stat"><b>🏆 ${longest}</b><small>Cao nhất</small></div><div class="profile-stat"><b>⭐ ${xp}</b><small>XP</small></div><div class="profile-stat"><b>💎 ${points}</b><small>Points</small></div></div><div class="panel" style="margin-top:15px"><b>🐾 Pet</b><p class="muted">${esc(profile.pet?.skin || "default")} · ${Array.isArray(profile.equippedItems) ? profile.equippedItems.length : 0} món đang mặc</p><button id="profilePet" class="primary" type="button">Mở tủ đồ Pet</button></div>`;
  $("profileDialog").showModal();
  $("closeProfile").onclick = () => $("profileDialog").close();
  $("profilePet").onclick = () => { $("profileDialog").close(); openPetShop(); };
}
async function buyOrEquipItem(item) {
  if (!user || !profile) return toast("Hãy đăng nhập trước.");
  const unlocked = Array.isArray(profile.unlockedItems) && profile.unlockedItems.includes(item.id);
  try {
    if (!unlocked) {
      const price = Math.max(0, num(item.price));
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "users", user.uid);
        const snap = await tx.get(ref);
        const old = snap.data() || {};
        const points = num(old.points);
        if (points < price) throw new Error("Không đủ Points.");
        const list = Array.isArray(old.unlockedItems) ? [...old.unlockedItems] : [];
        if (!list.includes(item.id)) list.push(item.id);
        tx.set(ref, { points: points - price, unlockedItems: list, updatedAt: serverTimestamp() }, { merge: true });
      });
      toast(`🛍️ Đã mua ${item.name}!`);
    } else {
      await setDoc(doc(db, "users", user.uid), { equippedItems: [item.id], pet: { ...(profile.pet || {}), skin: item.petSkin || profile.pet?.skin || "default" }, updatedAt: serverTimestamp() }, { merge: true });
      toast(`✨ Đã mặc ${item.name}!`);
    }
    openPetShop();
  } catch (e) { toast(e.message); }
}
function openPetShop() {
  if (!user || !profile) { toast("Hãy đăng nhập để dùng Pet."); return; }
  const unlocked = new Set(Array.isArray(profile.unlockedItems) ? profile.unlockedItems : []);
  const sortedItems = items.length ? items : [
    { id:"pet_hat_red", name:"Mũ đỏ", description:"Mũ cơ bản cho Flamey.", price:80, emoji:"🧢", petSkin:"hat-red" },
    { id:"pet_crown", name:"Vương miện", description:"Món đồ hiếm.", price:250, emoji:"👑", petSkin:"crown" },
    { id:"pet_glasses", name:"Kính ngầu", description:"Tăng độ ngầu.", price:150, emoji:"🕶️", petSkin:"glasses" },
    { id:"pet_scarf", name:"Khăn sao", description:"Phụ kiện ấm áp.", price:120, emoji:"🧣", petSkin:"scarf" },
    { id:"pet_wings", name:"Cánh sao", description:"Phụ kiện huyền thoại.", price:400, emoji:"🪽", petSkin:"wings" },
    { id:"pet_cape", name:"Áo choàng", description:"Dành cho người chăm chỉ.", price:300, emoji:"🦸", petSkin:"cape" }
  ];
  const equipped = Array.isArray(profile.equippedItems) ? profile.equippedItems : [];
  $("petContent").innerHTML = `<div class="panel-title"><div><p class="eyebrow">STREAK PET CLOSET</p><h2>🐾 Tủ đồ của ${esc(profile.displayName || user.displayName || "Bạn")}</h2><p class="muted">Mỗi món mua bằng Points. Mua một lần, mặc lại miễn phí.</p></div><button id="closePet" class="icon-btn" type="button">×</button></div><div class="daily-strip"><span>💎 ${num(profile.points).toLocaleString("vi-VN")} Points</span><span>🔥 ${num(profile.currentStreak ?? profile.streak)} ngày Streak</span></div><div class="pet-shop">${sortedItems.map((item) => { const has = unlocked.has(item.id); const isEquipped = equipped.includes(item.id); return `<article class="pet-item"><div class="pet-preview">${esc(item.emoji || "🎽")}</div><h4>${esc(item.name || item.id)}</h4><p>${esc(item.description || "Phụ kiện Pet")}</p><button class="${isEquipped ? "ghost" : "primary"}" data-item-id="${esc(item.id)}" type="button">${isEquipped ? "✓ Đang mặc" : has ? "👕 Mặc" : `💎 Mua · ${num(item.price)} P`}</button></article>`; }).join("")}</div>`;
  $("petDialog").showModal();
  $("closePet").onclick = () => $("petDialog").close();
  document.querySelectorAll("[data-item-id]").forEach((b) => b.onclick = () => { const item = sortedItems.find((x) => x.id === b.dataset.itemId); if (item) buyOrEquipItem(item); });
}
function setupPetDrag() {
  const pet = $("floatingPet");
  let dragging = false; let offsetX = 0; let offsetY = 0;
  pet.addEventListener("pointerdown", (e) => { dragging = true; pet.setPointerCapture(e.pointerId); const r = pet.getBoundingClientRect(); offsetX = e.clientX - r.left; offsetY = e.clientY - r.top; });
  pet.addEventListener("pointermove", (e) => { if (!dragging) return; const x = Math.max(5, Math.min(window.innerWidth - rWidth(), e.clientX - offsetX)); const y = Math.max(65, Math.min(window.innerHeight - rHeight(), e.clientY - offsetY)); pet.style.left = `${x}px`; pet.style.top = `${y}px`; pet.style.right = "auto"; pet.style.bottom = "auto"; });
  pet.addEventListener("pointerup", () => { if (!dragging) return; dragging = false; localPrefs.petX = pet.offsetLeft; localPrefs.petY = pet.offsetTop; localStorage.setItem("hh_pet_x", String(localPrefs.petX)); localStorage.setItem("hh_pet_y", String(localPrefs.petY)); });
  pet.addEventListener("click", () => { if (!dragging) openPetShop(); });
  pet.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") openPetShop(); });
  function rWidth(){return pet.offsetWidth || 68;} function rHeight(){return pet.offsetHeight || 68;}
}

$("settingsBtn").onclick = () => { renderSettingsDialog(); $("settingsDialog").showModal(); };
$("closeSettings").onclick = () => $("settingsDialog").close();
$("saveSettings").onclick = () => { localPrefs.petEnabled = $("petEnabled").checked; localStorage.setItem("hh_pet_enabled", localPrefs.petEnabled ? "1" : "0"); applyPrefs(); $("settingsDialog").close(); toast("💾 Đã lưu giao diện."); };
document.querySelectorAll("[data-theme]").forEach((b) => b.onclick = () => { localPrefs.theme = b.dataset.theme; localStorage.setItem("hh_theme", localPrefs.theme); applyPrefs(); renderSettingsDialog(); });
document.querySelectorAll("[data-accent]").forEach((b) => b.onclick = () => { localPrefs.accent = b.dataset.accent; localStorage.setItem("hh_accent", localPrefs.accent); applyPrefs(); renderSettingsDialog(); });
document.querySelectorAll("[data-bg]").forEach((b) => b.onclick = () => { localPrefs.background = b.dataset.bg; localStorage.setItem("hh_bg", localPrefs.background); applyPrefs(); renderSettingsDialog(); });
$("themeBtn").onclick = () => { localPrefs.theme = document.body.classList.contains("light") ? "dark" : "light"; localStorage.setItem("hh_theme", localPrefs.theme); applyPrefs(); };
$("search").oninput = (e) => { searchText = e.target.value; renderHomework(); };
$("clearSearch").onclick = () => { searchText = ""; $("search").value = ""; renderHomework(); };
$("noticeClose").onclick = () => $("updateNotice").classList.add("hidden");
$("petNav").onclick = openPetShop;
$("profileNav").onclick = openProfile;

onAuthStateChanged(auth, async (u) => {
  user = u;
  renderAuth();
  if (!u) { profile = null; clearSubscriptions(); startRealtime(); renderStats(); applyPrefs(); return; }
  try { await ensureProfile(u); } catch (e) { console.error("Profile init:", e); toast(`Không thể khởi tạo hồ sơ: ${e.message}`); }
  startRealtime();
});

setupPetDrag();
applyPrefs();
renderTabs();
renderSettingsDialog();
