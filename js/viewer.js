import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  setDoc,
  serverTimestamp,
  runTransaction,
  getDocs,
  getDoc
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
const provider = new GoogleAuthProvider();
const $ = (id) => document.getElementById(id);

const DAY = 86400000;
const TZ = "Asia/Ho_Chi_Minh";
const USER_KEY_PREFIX = "hh_seen_notifications_";

let tabs = [];
let homework = [];
let progress = {};
let profile = null;
let user = null;
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

let unsubUser = [];
let unsubGlobal = [];
let refreshTimer = null;

const localPrefs = {
  theme: localStorage.getItem("hh_theme") || "dark",
  accent: localStorage.getItem("hh_accent") || "purple",
  background: localStorage.getItem("hh_bg") || "default",
  petEnabled: localStorage.getItem("hh_pet_enabled") !== "0"
};

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

function dayKey(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(value);
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

function formatDate(value) {
  const d = parseDate(value);
  return d ? d.toLocaleString("vi-VN") : "Chưa có";
}

function levelFromXP(xp) {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1);
}

function levelBounds(level) {
  return { cur: level <= 1 ? 0 : (level - 1) ** 2 * 100, next: level ** 2 * 100 };
}

function applyPrefs() {
  const isLight = localPrefs.theme === "light" ||
    (localPrefs.theme === "system" && window.matchMedia("(prefers-color-scheme: light)").matches);
  document.body.classList.toggle("light", isLight);
  document.documentElement.dataset.accent = localPrefs.accent;
  document.documentElement.dataset.background = localPrefs.background;
  $("floatingPet")?.classList.toggle("hidden", !user || !localPrefs.petEnabled);
}

function showToast(message) {
  const host = $("toastHost");
  if (!host) return;
  const item = document.createElement("div");
  item.className = "toast";
  item.textContent = message;
  host.appendChild(item);
  setTimeout(() => item.remove(), 2600);
}

async function ensureProfile(currentUser) {
  const ref = doc(db, "users", currentUser.uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const old = snap.exists() ? snap.data() : {};
    const today = dayKey();
    const last = String(old.lastVisitDate || "");

    let streak = Math.max(0, Math.floor(num(old.currentStreak ?? old.streak)));
    let longest = Math.max(streak, Math.floor(num(old.longestStreak ?? old.highestStreak ?? old.maxStreak)));
    let xp = Math.max(0, Math.floor(num(old.totalXP)));
    let points = Math.max(0, Math.floor(num(old.points)));

    if (streak > 1000000 || longest > 1000000 || xp > 1000000000 || points > 1000000000) {
      streak = 0;
      longest = 0;
      xp = 0;
      points = 0;
    }

    if (last !== today) {
      const previous = last ? new Date(`${last}T12:00:00+07:00`) : null;
      const current = new Date(`${today}T12:00:00+07:00`);
      const gap = previous ? Math.round((current - previous) / DAY) : 0;
      streak = last && gap === 1 ? streak + 1 : 1;
      longest = Math.max(longest, streak);
      xp += 20;
      points += 10;
    }

    const payload = {
      uid: currentUser.uid,
      email: currentUser.email || old.email || "",
      displayName: currentUser.displayName || old.displayName || currentUser.email || "Bạn",
      name: currentUser.displayName || old.name || currentUser.email || "Bạn",
      photoURL: currentUser.photoURL || old.photoURL || "",
      provider: "google",
      streak,
      currentStreak: streak,
      longestStreak: longest,
      highestStreak: longest,
      maxStreak: longest,
      totalXP: xp,
      points,
      level: levelFromXP(xp),
      lastVisitDate: today,
      lastVisitAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      completedHomeworkCount: Math.max(0, Math.floor(num(old.completedHomeworkCount))),
      unlockedItems: Array.isArray(old.unlockedItems) ? old.unlockedItems : [],
      equippedItems: Array.isArray(old.equippedItems) ? old.equippedItems : [],
      pet: {
        ...(old.pet && typeof old.pet === "object" ? old.pet : {}),
        type: old.pet?.type || "flamey",
        skin: old.pet?.skin || "default",
        position: old.pet?.position || { x: 82, y: 70 }
      }
    };

    tx.set(ref, payload, { merge: true });
  });
}

function renderAuth() {
  const area = $("userArea");
  if (!area) return;

  if (!user) {
    area.innerHTML = `<button id="googleLogin" class="google-mini">G&nbsp; Đăng nhập</button>`;
    $("googleLogin")?.addEventListener("click", loginGoogle);
    $("greeting").textContent = "Đăng nhập để lưu Streak, XP, Points, tiến độ và Flamey trên mọi thiết bị.";
    return;
  }

  const name = user.displayName || user.email || "Bạn";
  const streak = num(profile?.currentStreak ?? profile?.streak);
  const avatar = user.photoURL
    ? `<img class="avatar-img" src="${esc(user.photoURL)}" alt="Avatar" referrerpolicy="no-referrer">`
    : `<span class="avatar">${esc(name.charAt(0).toUpperCase())}</span>`;

  area.innerHTML = `<div class="user-pill">
    ${avatar}
    <div><b>${esc(name)}</b><small>🔥 <span id="userStreak">${streak}</span> ngày</small></div>
    <button id="logoutGoogle" class="logout-mini">Thoát</button>
  </div>`;
  $("logoutGoogle")?.addEventListener("click", () => signOut(auth));
  $("greeting").textContent = `Chào ${name} 👋 Hôm nay mình làm bài nhé!`;
}

async function loginGoogle() {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Google login:", error);
    showToast(`❌ Đăng nhập không thành công: ${error.message || "Lỗi không xác định"}`);
  }
}

function clearUserListeners() {
  unsubUser.forEach((fn) => {
    try { if (typeof fn === "function") fn(); } catch {}
  });
  unsubUser = [];
  progress = {};
  profile = null;
}

function renderStats() {
  const streak = Math.max(0, Math.floor(num(profile?.currentStreak ?? profile?.streak)));
  const xp = Math.max(0, Math.floor(num(profile?.totalXP)));
  const points = Math.max(0, Math.floor(num(profile?.points)));
  const level = Math.max(1, Math.floor(num(profile?.level, levelFromXP(xp))));
  const bounds = levelBounds(level);
  const percent = Math.min(100, Math.max(0, ((xp - bounds.cur) / Math.max(1, bounds.next - bounds.cur)) * 100));
  const today = dayKey();
  const todayHomework = homework.filter((h) => dayKey(parseDate(h.createdAt)) === today);
  const done = todayHomework.filter((h) => progress[h.id]?.completed).length;

  if ($("heroStreak")) $("heroStreak").textContent = user ? streak.toLocaleString("vi-VN") : "—";
  if ($("heroLevel")) $("heroLevel").textContent = user ? `Lv.${level}` : "—";
  if ($("heroPoints")) $("heroPoints").textContent = user ? points.toLocaleString("vi-VN") : "—";
  if ($("xpLevelText")) $("xpLevelText").textContent = user ? `⭐ Level ${level}` : "Đăng nhập để bắt đầu";
  if ($("xpText")) $("xpText").textContent = user
    ? `${xp.toLocaleString("vi-VN")} / ${bounds.next.toLocaleString("vi-VN")} XP · còn ${Math.max(0, bounds.next - xp).toLocaleString("vi-VN")} XP lên level`
    : "XP và tiến độ sẽ được lưu bằng Firebase";
  if ($("xpPercent")) $("xpPercent").textContent = user ? `${Math.round(percent)}%` : "0%";
  if ($("xpBar")) $("xpBar").style.width = `${user ? percent : 0}%`;
  if ($("dailyProgress")) $("dailyProgress").textContent = `☑ ${done} / ${todayHomework.length} bài hôm nay`;
  if ($("userStreak")) $("userStreak").textContent = String(streak);
  applyPrefs();
}

function normalizeLinks(item) {
  const raw = [];
  if (Array.isArray(item?.links)) raw.push(...item.links);
  if (item?.url) raw.push(item.url);
  const seen = new Set();
  return raw.map((link) => String(link || "").trim()).filter((link) => {
    if (!link || seen.has(link)) return false;
    try {
      const parsed = new URL(link);
      if (!["http:", "https:"].includes(parsed.protocol)) return false;
      seen.add(link);
      return true;
    } catch {
      return false;
    }
  }).slice(0, 10);
}

function renderTabs() {
  const container = $("tabs");
  if (!container) return;
  container.innerHTML = `<button class="tab ${active === "all" ? "active" : ""}" data-tab="all">✨ Tất cả <span>${homework.length}</span></button>` +
    tabs.map((tab) => {
      const count = homework.filter((h) => h.subjectId === tab.id).length;
      return `<button class="tab ${active === tab.id ? "active" : ""}" data-tab="${esc(tab.id)}">${esc(tab.icon || "📚")} ${esc(tab.name || "Môn học")} <span>${count}</span></button>`;
    }).join("");

  container.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      active = button.dataset.tab;
      renderTabs();
      renderHomework();
    });
  });
}

function getDueState(value) {
  const due = parseDate(value);
  if (!due) return null;
  const diff = due.getTime() - Date.now();
  if (diff < 0) return { cls: "red", text: "Đã hết hạn" };
  if (diff < 2 * DAY) return { cls: "yellow", text: "Sắp hết hạn" };
  return { cls: "", text: "Còn hạn" };
}

function renderLinkActions(link, index) {
  const label = `Link ${index + 1}`;
  return `<div class="attachment">
    <div class="attachment-head"><span class="attachment-title">🔗 ${label}</span><small>${esc(new URL(link).hostname)}</small></div>
    <div class="attachment-actions">
      <button type="button" class="primary-link" data-preview-link="${esc(link)}">👁 Xem trước</button>
      <a href="${esc(link)}" target="_blank" rel="noopener noreferrer">↗ Mở link</a>
      <a href="${esc(link)}" download>⬇ Download</a>
    </div>
  </div>`;
}

function renderHomework() {
  const container = $("homeworkList");
  const empty = $("empty");
  if (!container || !empty) return;

  const term = search.trim().toLowerCase();
  const filtered = homework.filter((item) => {
    const inTab = active === "all" || item.subjectId === active;
    const searchable = `${item.title || ""} ${item.content || ""} ${normalizeLinks(item).join(" ")}`.toLowerCase();
    return inTab && (!term || searchable.includes(term));
  }).sort((a, b) => {
    const pinned = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinned) return pinned;
    return (parseDate(b.createdAt)?.getTime() || 0) - (parseDate(a.createdAt)?.getTime() || 0);
  });

  empty.classList.toggle("hidden", filtered.length > 0);
  if ($("status")) $("status").textContent = `${filtered.length} bài tập${active === "all" ? "" : " · môn đã chọn"}`;
  if ($("totalCount")) $("totalCount").textContent = String(homework.length);

  container.innerHTML = filtered.map((item, index) => {
    const subject = tabs.find((tab) => tab.id === item.subjectId);
    const completed = Boolean(progress[item.id]?.completed);
    const dueState = getDueState(item.dueDate);
    const links = normalizeLinks(item);
    return `<article class="card ${item.pinned ? "pinned" : ""} ${completed ? "completed" : ""}" style="animation-delay:${Math.min(index, 10) * 35}ms">
      <div class="card-top">
        <span class="subject">${esc(subject?.icon || "📚")} ${esc(subject?.name || "Chưa phân loại")}</span>
        <span class="badge ${dueState?.cls || ""}">${item.pinned ? "📌 Ghim" : item.important ? "⭐ Quan trọng" : "Mới"}</span>
      </div>
      <h3>${esc(item.title || "Bài tập")}</h3>
      <div class="content">${esc(item.content || "")}</div>
      ${dueState ? `<div class="due ${dueState.cls}">⏰ Hạn: ${esc(formatDate(item.dueDate))} · ${esc(dueState.text)}</div>` : ""}
      ${links.length ? `<div class="attachment-list">${links.map(renderLinkActions).join("")}</div>` : ""}
      ${user ? `<div class="complete-row"><label class="complete-check"><input type="checkbox" data-complete="${esc(item.id)}" ${completed ? "checked" : ""}> ${completed ? "Đã hoàn thành" : "Đánh dấu đã làm"}</label><span class="muted">+${num(siteSettings.xpPerHomework, 30)} XP</span></div>` : `<div class="complete-row"><span class="muted">Đăng nhập để lưu tiến độ</span><button class="ghost small" data-login-needed="1">Đăng nhập</button></div>`}
    </article>`;
  }).join("");

  container.querySelectorAll("[data-preview-link]").forEach((button) => {
    button.addEventListener("click", () => openLinkPreview(button.dataset.previewLink));
  });
  container.querySelectorAll("[data-complete]").forEach((box) => {
    box.addEventListener("change", async () => {
      try {
        await completeHomework(box.dataset.complete, box.checked);
      } catch (error) {
        box.checked = !box.checked;
        console.error("Complete homework:", error);
        showToast(`❌ Không thể lưu tiến độ: ${error.message}`);
      }
    });
  });
  container.querySelectorAll("[data-login-needed]").forEach((button) => button.addEventListener("click", loginGoogle));
}

function openLinkPreview(link) {
  const container = $("linkPreviewContent");
  if (!container) return;
  const parsed = new URL(link);
  container.innerHTML = `<div class="panel-title">
    <div><p class="eyebrow">LINK PREVIEW</p><h2>👁 Xem trước</h2><p class="muted">${esc(parsed.hostname)}</p></div>
    <button class="icon-btn" id="closeLinkPreview" aria-label="Đóng">×</button>
  </div>
  <div class="preview-toolbar"><a class="primary" href="${esc(link)}" target="_blank" rel="noopener noreferrer">↗ Mở ở tab mới</a><a class="ghost" href="${esc(link)}" download>⬇ Download</a></div>
  <div class="preview-hint">Một số website không cho phép nhúng vào trang khác. Khi đó hãy bấm <b>Mở ở tab mới</b>.</div>
  <iframe class="preview-frame" src="${esc(link)}" title="Xem trước ${esc(parsed.hostname)}" referrerpolicy="no-referrer" loading="lazy"></iframe>`;
  $("linkPreviewDialog")?.showModal();
  $("closeLinkPreview")?.addEventListener("click", () => $("linkPreviewDialog")?.close());
}

async function completeHomework(id, checked) {
  if (!user) {
    await loginGoogle();
    return;
  }

  const progressRef = doc(db, "users", user.uid, "homeworkProgress", id);
  const userRef = doc(db, "users", user.uid);
  const xpPer = Math.max(0, Math.floor(num(siteSettings.xpPerHomework, 30)));
  const pointsPer = Math.max(0, Math.floor(num(siteSettings.pointsPerHomework, 20)));

  if (!checked) {
    await runTransaction(db, async (tx) => {
      const progressSnap = await tx.get(progressRef);
      const userSnap = await tx.get(userRef);
      if (!progressSnap.exists() || !progressSnap.data().completed) return;
      const current = userSnap.exists() ? userSnap.data() : {};
      const earnedXP = num(progressSnap.data().xp, xpPer);
      const earnedPoints = num(progressSnap.data().points, pointsPer);
      tx.set(progressRef, { completed: false, updatedAt: serverTimestamp() }, { merge: true });
      tx.set(userRef, {
        totalXP: Math.max(0, num(current.totalXP) - earnedXP),
        points: Math.max(0, num(current.points) - earnedPoints),
        completedHomeworkCount: Math.max(0, num(current.completedHomeworkCount) - 1),
        updatedAt: serverTimestamp()
      }, { merge: true });
    });
    showToast("↩️ Đã bỏ đánh dấu bài.");
    return;
  }

  if (progress[id]?.completed) return;

  const today = dayKey();
  const todayItems = homework.filter((item) => dayKey(parseDate(item.createdAt)) === today);
  const isLastToday = todayItems.length > 0 && todayItems.every((item) => progress[item.id]?.completed || item.id === id);

  await runTransaction(db, async (tx) => {
    const progressSnap = await tx.get(progressRef);
    const userSnap = await tx.get(userRef);
    if (progressSnap.exists() && progressSnap.data().completed) return;
    const current = userSnap.exists() ? userSnap.data() : {};
    const oldRewardDate = current.dailyRewardDate || "";
    const bonusXP = isLastToday && oldRewardDate !== today ? 100 : 0;
    const bonusPoints = isLastToday && oldRewardDate !== today ? 50 : 0;
    tx.set(progressRef, { completed: true, completedAt: serverTimestamp(), xp: xpPer, points: pointsPer }, { merge: true });
    tx.set(userRef, {
      totalXP: num(current.totalXP) + xpPer + bonusXP,
      points: num(current.points) + pointsPer + bonusPoints,
      level: levelFromXP(num(current.totalXP) + xpPer + bonusXP),
      completedHomeworkCount: num(current.completedHomeworkCount) + 1,
      ...(bonusXP ? { dailyRewardDate: today } : {}),
      updatedAt: serverTimestamp()
    }, { merge: true });
  });

  showToast(isLastToday ? `🎉 Hoàn thành toàn bộ hôm nay! +${xpPer + 100} XP · +${pointsPer + 50} Points` : `✨ +${xpPer} XP · +${pointsPer} Points`);
}

const PETS = [
  { id: "default", emoji: "🔥", name: "Flamey", unlock: 1, accessory: "", desc: "Ngọn lửa đầu tiên đồng hành với bạn.", mood: "•ᴗ•" },
  { id: "cap", emoji: "🔥", name: "School Cap", unlock: 7, accessory: "🧢", desc: "Mũ học sinh cho chiến binh 7 ngày.", mood: "⌐■ᴗ■" },
  { id: "hoodie", emoji: "🔥", name: "Hoodie", unlock: 14, accessory: "👕", desc: "Ấm áp nhưng vẫn cực ngầu.", mood: "ᵔᴗᵔ" },
  { id: "glasses", emoji: "🔥", name: "Smart Glasses", unlock: 21, accessory: "👓", desc: "Flamey nhập học bá mode.", mood: "⌐ᴗ⌐" },
  { id: "crown", emoji: "🔥", name: "Crown", unlock: 30, accessory: "👑", desc: "Vương miện cho người bền bỉ.", mood: "^ᴗ^" },
  { id: "galaxy", emoji: "🌌", name: "Galaxy Flame", unlock: 75, accessory: "✦", desc: "Lửa vũ trụ hiếm.", mood: "✦ᴗ✦" }
];

function petMood(streak) {
  if (streak >= 75) return ["🌌", "Flamey đã bước vào huyền thoại!", "Cả vũ trụ cũng biết bạn là ai."];
  if (streak >= 30) return ["👑", "Flamey đang cực kỳ tự hào!", "Bạn là huyền thoại rồi."];
  if (streak >= 14) return ["😎", "Flamey đang rất sung!", "Đừng để chuỗi rơi nhé!"];
  if (streak >= 7) return ["🥳", "Flamey đang ăn mừng!", "7 ngày liên tục rồi đó!"];
  if (streak >= 1) return ["😊", "Flamey đang vui!", "Làm thêm một bài để Flamey lớn hơn."];
  return ["😴", "Flamey đang chờ bạn...", "Đăng nhập và bắt đầu chuỗi nhé."];
}

function petVisual(skin) {
  const item = PETS.find((pet) => pet.id === skin) || PETS[0];
  return `<div class="pet-orbit"><div class="pet-glow"></div><div class="pet-character ${esc(item.id)}">
    <span class="pet-emoji">${item.emoji}</span>
    ${item.accessory ? `<span class="pet-accessory">${item.accessory}</span>` : ""}
    <span class="pet-eyes">${item.mood}</span>
    <span class="pet-spark s1">✦</span><span class="pet-spark s2">✧</span>
  </div></div>`;
}

function openPet() {
  if (!user) {
    loginGoogle();
    return;
  }
  const data = profile || {};
  const streak = Math.max(0, Math.floor(num(data.currentStreak ?? data.streak)));
  const selectedSkin = data.pet?.skin || "default";
  const [moodIcon, moodTitle, moodText] = petMood(streak);
  const unlocked = (pet) => streak >= pet.unlock || (Array.isArray(data.unlockedItems) && data.unlockedItems.includes(pet.id));
  const energy = Math.min(100, 55 + (streak % 45));
  const bond = Math.min(100, Math.max(10, 35 + streak * 2));

  $("petContent").innerHTML = `<div class="panel-title">
    <div><p class="eyebrow">PET HOME</p><h2>🐾 Góc của Flamey</h2><p class="muted">Một góc nhỏ nơi Flamey sống, nghỉ, chơi và khoe thành tích cùng bạn.</p></div>
    <button class="icon-btn" id="closePet" aria-label="Đóng">×</button>
  </div>
  <div class="pet-dashboard">
    <section class="pet-showcase">
      <div class="pet-stage" id="petStage">${petVisual(selectedSkin)}</div>
      <div class="pet-info">
        <div class="pet-status"><span>${moodIcon} ${esc(moodTitle)}</span><span class="pet-level">Lv.${Math.max(1, Math.floor(num(data.level, 1)))}</span></div>
        <h2>🔥 Flamey</h2>
        <p class="muted">${esc(moodText)}</p>
        <div class="pet-bars">
          <div><span>❤️ Thân thiết</span><b>${bond}%</b><i><em style="width:${bond}%"></em></i></div>
          <div><span>⚡ Năng lượng</span><b>${energy}%</b><i><em style="width:${energy}%"></em></i></div>
        </div>
        <div class="pet-actions"><button id="petPlay" class="primary">🎮 Chơi với Flamey</button><button id="petFeed" class="ghost">🍪 Cho ăn</button></div>
      </div>
    </section>
    <section class="pet-wardrobe">
      <div class="wardrobe-head"><div><h3>👕 Trang bị</h3><p class="muted">Bấm vào món đã mở để trang bị ngay cho Flamey.</p></div><span>${PETS.filter(unlocked).length}/${PETS.length} đã mở</span></div>
      <div class="pet-grid">${PETS.map((item) => {
        const ok = unlocked(item);
        const equipped = selectedSkin === item.id;
        return `<button class="pet-item ${equipped ? "equipped" : ""} ${ok ? "" : "locked"}" type="button" data-pet-skin="${esc(item.id)}" ${ok ? "" : "disabled"}>
          <span class="pet-item-icon">${item.emoji}</span>${item.accessory ? `<span class="pet-item-acc">${item.accessory}</span>` : ""}
          <b>${esc(item.name)}</b><small>${equipped ? "✓ Đang trang bị" : ok ? "✓ Đã mở" : `🔒 ${item.unlock} ngày`}</small>
        </button>`;
      }).join("")}</div>
    </section>
  </div>`;

  $("petDialog")?.showModal();
  $("closePet")?.addEventListener("click", () => $("petDialog")?.close());
  document.querySelectorAll("[data-pet-skin]").forEach((button) => {
    button.addEventListener("click", async () => {
      const skin = button.dataset.petSkin;
      try {
        await setDoc(doc(db, "users", user.uid), {
          pet: { ...(profile?.pet || {}), type: "flamey", skin },
          equippedItems: [skin],
          updatedAt: serverTimestamp()
        }, { merge: true });
        profile = { ...(profile || {}), pet: { ...(profile?.pet || {}), type: "flamey", skin }, equippedItems: [skin] };
        showToast(`🐾 Flamey đã mặc ${PETS.find((item) => item.id === skin)?.name || "món đồ"}!`);
        openPet();
      } catch (error) {
        console.error("Equip pet:", error);
        showToast(`❌ Không thể trang bị: ${error.message}`);
      }
    });
  });
  $("petPlay")?.addEventListener("click", () => {
    const stage = $("petStage");
    stage?.classList.remove("pet-happy");
    void stage?.offsetWidth;
    stage?.classList.add("pet-happy");
    showToast("🎮 Flamey: Yay! Chơi nữa đi!");
  });
  $("petFeed")?.addEventListener("click", () => {
    const stage = $("petStage");
    stage?.classList.remove("pet-happy");
    void stage?.offsetWidth;
    stage?.classList.add("pet-happy");
    showToast("🍪 Flamey: Ngon quá! ❤️");
  });
}

function openProfile() {
  if (!user) {
    loginGoogle();
    return;
  }
  const p = profile || {};
  const streak = Math.max(0, Math.floor(num(p.currentStreak ?? p.streak)));
  const longest = Math.max(streak, Math.floor(num(p.longestStreak ?? p.highestStreak)));
  const xp = Math.max(0, Math.floor(num(p.totalXP)));
  const points = Math.max(0, Math.floor(num(p.points)));
  const completed = Math.max(0, Math.floor(num(p.completedHomeworkCount)));
  const achievements = [
    ["🔥 First Flame", streak >= 1, "Đăng nhập ngày đầu tiên"],
    ["🔥 Week Warrior", streak >= 7, "7 ngày liên tục"],
    ["🔥 Two Weeks", streak >= 14, "14 ngày liên tục"],
    ["📚 Homework Hero", completed >= 50, `${Math.min(completed, 50)}/50 bài hoàn thành`],
    ["⚡ XP Hunter", xp >= 1000, "Đạt 1.000 XP"],
    ["👑 Legend", streak >= 100, "100 ngày liên tục"]
  ];

  $("profileContent").innerHTML = `<div class="panel-title"><div><p class="eyebrow">YOUR PROGRESS</p><h2>👤 Hồ sơ</h2></div><button class="icon-btn" id="closeProfile" aria-label="Đóng">×</button></div>
    <div class="profile-card">
      <div class="profile-top"><img class="profile-avatar" src="${esc(user.photoURL || "")}" alt="Avatar" referrerpolicy="no-referrer"><div><h2>${esc(user.displayName || "Bạn")}</h2><p class="muted">${esc(user.email || "")}</p></div></div>
      <div class="profile-stats">
        <div class="profile-stat"><b>🔥 ${streak.toLocaleString("vi-VN")}</b><small>Streak</small></div>
        <div class="profile-stat"><b>🏆 ${longest.toLocaleString("vi-VN")}</b><small>Cao nhất</small></div>
        <div class="profile-stat"><b>⭐ ${xp.toLocaleString("vi-VN")}</b><small>XP</small></div>
        <div class="profile-stat"><b>💎 ${points.toLocaleString("vi-VN")}</b><small>Points</small></div>
      </div>
      <h3>🏆 Thành tựu</h3>
      <div class="achievement-grid">${achievements.map(([title, unlocked, desc]) => `<div class="achievement ${unlocked ? "unlocked" : ""}"><span>${unlocked ? "✓" : "🔒"}</span><div><b>${esc(title)}</b><small>${esc(desc)}</small></div></div>`).join("")}</div>
    </div>`;
  $("profileDialog")?.showModal();
  $("closeProfile")?.addEventListener("click", () => $("profileDialog")?.close());
}

function showUpdateNotice() {
  const today = dayKey();
  const dismissed = localStorage.getItem("hh_notice_dismissed");
  if (dismissed === today) return;

  const latest = homework.reduce((latestDate, item) => {
    const d = parseDate(item.createdAt);
    return d && (!latestDate || d > latestDate) ? d : latestDate;
  }, null);

  let title = "";
  let text = "";
  if (!homework.length) {
    if (siteSettings.noHomeworkNoticeEnabled === false) return;
    title = siteSettings.noHomeworkNoticeTitle;
    text = siteSettings.noHomeworkNoticeMessage;
  } else {
    if (!latest) return;
    const latestDay = dayKey(latest);
    if (latestDay === today || siteSettings.oldHomeworkNoticeEnabled === false) return;
    const diff = Math.max(1, Math.round((new Date(`${today}T12:00:00+07:00`) - new Date(`${latestDay}T12:00:00+07:00`)) / DAY));
    title = siteSettings.oldHomeworkNoticeTitle;
    text = String(siteSettings.oldHomeworkNoticeMessage || "").replaceAll("{days}", String(diff)).replaceAll("{date}", latest.toLocaleDateString("vi-VN"));
  }

  if ($("noticeTitle")) $("noticeTitle").textContent = title;
  if ($("noticeText")) $("noticeText").textContent = text;
  $("updateNotice")?.classList.remove("hidden");
}

async function refreshHomework() {
  try {
    const snapshot = await getDocs(query(collection(db, "homework"), orderBy("createdAt", "desc")));
    homework = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderTabs();
    renderHomework();
    renderStats();
    showUpdateNotice();
  } catch (error) {
    console.warn("Homework refresh:", error);
  }
}

function cleanup() {
  clearUserListeners();
  unsubGlobal.forEach((fn) => {
    try { if (typeof fn === "function") fn(); } catch {}
  });
  unsubGlobal = [];
}

function bindNavigation() {
  document.querySelectorAll("[data-main-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-main-nav]").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(`[data-main-nav="${button.dataset.mainNav}"]`).forEach((item) => item.classList.add("active"));
      const nav = button.dataset.mainNav;
      if (nav === "home") window.scrollTo({ top: 0, behavior: "smooth" });
      if (nav === "homework") $("homeworkSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (nav === "pet") openPet();
      if (nav === "profile") openProfile();
    });
  });

  $("noticeClose")?.addEventListener("click", () => {
    $("updateNotice")?.classList.add("hidden");
    localStorage.setItem("hh_notice_dismissed", dayKey());
  });
  $("search")?.addEventListener("input", (event) => {
    search = event.target.value.toLowerCase();
    $("clearSearch")?.classList.toggle("hidden", !search);
    renderHomework();
  });
  $("clearSearch")?.addEventListener("click", () => {
    $("search").value = "";
    search = "";
    $("clearSearch")?.classList.add("hidden");
    renderHomework();
  });
  $("settingsBtn")?.addEventListener("click", () => {
    $("settingsDialog")?.showModal();
    $("petEnabled").checked = localPrefs.petEnabled;
  });
  $("closeSettings")?.addEventListener("click", () => $("settingsDialog")?.close());
  $("saveSettings")?.addEventListener("click", () => {
    localPrefs.petEnabled = Boolean($("petEnabled")?.checked);
    localStorage.setItem("hh_pet_enabled", localPrefs.petEnabled ? "1" : "0");
    $("settingsDialog")?.close();
    applyPrefs();
  });
  $("themeBtn")?.addEventListener("click", () => {
    localPrefs.theme = document.body.classList.contains("light") ? "dark" : "light";
    localStorage.setItem("hh_theme", localPrefs.theme);
    applyPrefs();
  });
  document.querySelectorAll("[data-theme]").forEach((button) => button.addEventListener("click", () => {
    localPrefs.theme = button.dataset.theme;
    localStorage.setItem("hh_theme", localPrefs.theme);
    applyPrefs();
  }));
  document.querySelectorAll("[data-accent]").forEach((button) => button.addEventListener("click", () => {
    localPrefs.accent = button.dataset.accent;
    localStorage.setItem("hh_accent", localPrefs.accent);
    applyPrefs();
  }));
  document.querySelectorAll("[data-bg]").forEach((button) => button.addEventListener("click", () => {
    localPrefs.background = button.dataset.bg;
    localStorage.setItem("hh_bg", localPrefs.background);
    applyPrefs();
  }));
}

function bindFloatingPet() {
  const pet = $("floatingPet");
  if (!pet) return;
  let dragging = false;
  let moved = false;
  let offsetX = 0;
  let offsetY = 0;

  function setPosition(x, y, save = true) {
    const px = Math.max(6, Math.min(94, x));
    const py = Math.max(8, Math.min(88, y));
    pet.style.left = `${px}%`;
    pet.style.top = `${py}%`;
    if (save && user) {
      setDoc(doc(db, "users", user.uid), {
        pet: { ...(profile?.pet || {}), position: { x: px, y: py } },
        updatedAt: serverTimestamp()
      }, { merge: true }).catch((error) => console.warn("Pet position:", error));
    }
  }

  pet.addEventListener("pointerdown", (event) => {
    dragging = true;
    moved = false;
    pet.setPointerCapture(event.pointerId);
    const rect = pet.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    pet.classList.add("dragging");
  });
  pet.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    moved = true;
    setPosition((event.clientX - offsetX) / innerWidth * 100, (event.clientY - offsetY) / innerHeight * 100, false);
  });
  pet.addEventListener("pointerup", () => {
    if (!dragging) return;
    dragging = false;
    pet.classList.remove("dragging");
    setPosition(parseFloat(pet.style.left), parseFloat(pet.style.top), true);
  });
  pet.addEventListener("click", () => {
    if (moved) return;
    pet.classList.remove("pet-play");
    void pet.offsetWidth;
    pet.classList.add("pet-play");
    showToast(profile?.currentStreak >= 7 ? "🔥 Flamey: Giữ chuỗi nhé!" : "🔥 Flamey: Đi làm bài nào!");
  });

  window.__hhSetPetPosition = setPosition;
}

onAuthStateChanged(auth, async (currentUser) => {
  clearUserListeners();
  user = currentUser;
  renderAuth();
  renderStats();

  if (!currentUser) return;

  try {
    await ensureProfile(currentUser);
  } catch (error) {
    console.error("Ensure profile:", error);
    showToast(`⚠️ Không thể lưu hồ sơ: ${error.message}`);
  }

  unsubUser.push(onSnapshot(doc(db, "users", currentUser.uid), (snap) => {
    profile = snap.exists() ? snap.data() : {};
    renderAuth();
    renderStats();
    if (profile?.pet?.position && window.__hhSetPetPosition) {
      window.__hhSetPetPosition(num(profile.pet.position.x, 82), num(profile.pet.position.y, 70), false);
    }
  }, (error) => console.error("Profile listener:", error)));

  unsubUser.push(onSnapshot(collection(db, "users", currentUser.uid, "homeworkProgress"), (snap) => {
    progress = {};
    snap.docs.forEach((item) => { progress[item.id] = item.data(); });
    renderStats();
    renderHomework();
  }, (error) => console.error("Progress listener:", error)));
});

unsubGlobal.push(onSnapshot(query(collection(db, "subjects"), orderBy("order", "asc")), (snap) => {
  tabs = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
  renderTabs();
  renderHomework();
}, (error) => console.error("Subjects listener:", error)));

unsubGlobal.push(onSnapshot(query(collection(db, "homework"), orderBy("createdAt", "desc")), (snap) => {
  homework = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
  renderTabs();
  renderHomework();
  renderStats();
  showUpdateNotice();
}, (error) => console.error("Homework listener:", error)));

unsubGlobal.push(onSnapshot(doc(db, "settings", "site"), (snap) => {
  if (snap.exists()) siteSettings = { ...siteSettings, ...snap.data() };
  renderStats();
  showUpdateNotice();
}, (error) => console.error("Settings listener:", error)));

refreshTimer = window.setInterval(refreshHomework, 10000);

$("today").textContent = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "full",
  timeZone: TZ
}).format(new Date());

applyPrefs();
bindNavigation();
bindFloatingPet();
renderTabs();
renderHomework();
renderStats();

window.addEventListener("beforeunload", () => {
  if (refreshTimer) clearInterval(refreshTimer);
  cleanup();
});
