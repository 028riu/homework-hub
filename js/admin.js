import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, collection, doc, onSnapshot, query, orderBy, setDoc, deleteDoc, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const $ = (id) => document.getElementById(id);
const ADMIN_EMAILS = ["028riu@gmail.com", "tu0ngtun2gsahur8@gmail.com", "linh085760@gmail.com", "phuong026443@stu.vinschool.edu.vn"];
const TZ = "Asia/Ho_Chi_Minh";
let subjects = [];
let homeworks = [];
let users = [];
let settings = {};
let selected = new Set();
let month = new Date();
let stopRealtime = [];

function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function esc(value = "") { return String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
function dateKey(value) { const d = value?.toDate ? value.toDate() : (value?.seconds ? new Date(value.seconds * 1000) : new Date(value)); if (Number.isNaN(d.getTime())) return ""; return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); }
function isAdmin(user) { return Boolean(user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())); }
function toast(message) { const n = document.createElement("div"); n.className = "toast"; n.textContent = message; document.body.appendChild(n); requestAnimationFrame(() => n.classList.add("show")); setTimeout(() => n.remove(), 2200); }
function clearRealtime() { stopRealtime.forEach((fn) => { try { fn(); } catch {} }); stopRealtime = []; }
function showDashboard(user) { $("loginView").classList.add("hidden"); $("dashboard").classList.remove("hidden"); $("adminUser").textContent = `${user.displayName || "Admin"} · ${user.email}`; }
function showLogin(message = "") { $("loginView").classList.remove("hidden"); $("dashboard").classList.add("hidden"); $("loginError").textContent = message; }
function startRealtime() {
  clearRealtime();
  stopRealtime.push(onSnapshot(query(collection(db, "subjects"), orderBy("order", "asc")), (snap) => { subjects = snap.docs.map((d) => ({ id:d.id, ...d.data() })); renderSubjects(); fillSubjectSelect(); renderHomework(); updateStats(); }, (e) => console.error("Subjects:", e)));
  stopRealtime.push(onSnapshot(query(collection(db, "homework"), orderBy("createdAt", "desc")), (snap) => { homeworks = snap.docs.map((d) => ({ id:d.id, ...d.data() })); renderHomework(); updateStats(); renderOverview(); renderCalendar(); }, (e) => console.error("Homework:", e)));
  stopRealtime.push(onSnapshot(collection(db, "users"), (snap) => { users = snap.docs.map((d) => ({ id:d.id, ...d.data() })); renderUsers(); updateStats(); renderOverview(); }, (e) => console.error("Users:", e)));
  stopRealtime.push(onSnapshot(doc(db, "settings", "site"), (snap) => { settings = snap.exists() ? snap.data() : {}; renderSettings(); }, (e) => console.error("Settings:", e)));
}
function updateStats() {
  const today = dateKey(new Date());
  const active = users.filter((u) => (u.lastVisitDate || u.lastLoginDate || "") === today).length;
  const xp = users.reduce((sum,u) => sum + num(u.totalXP), 0);
  const points = users.reduce((sum,u) => sum + num(u.points), 0);
  const completed = users.reduce((sum,u) => sum + num(u.completedHomeworkCount), 0);
  $("statUsers").textContent = users.length;
  $("statHomework").textContent = homeworks.length;
  $("statActive").textContent = active;
  $("statXP").textContent = xp.toLocaleString("vi-VN");
  $("statCompleted").textContent = completed.toLocaleString("vi-VN");
  $("statPoints").textContent = points.toLocaleString("vi-VN");
}
function renderOverview() {
  const avg = users.length ? Math.round(users.reduce((s,u) => s + num(u.totalXP),0) / users.length) : 0;
  $("overviewCards").innerHTML = `<div class="overview-card"><b>${users.length}</b><small>Người dùng</small></div><div class="overview-card"><b>${subjects.length}</b><small>Môn học</small></div><div class="overview-card"><b>${homeworks.length}</b><small>Bài tập</small></div><div class="overview-card"><b>${avg}</b><small>XP trung bình</small></div><div class="overview-card"><b>${users.filter(u => num(u.currentStreak ?? u.streak)>0).length}</b><small>Đang có Streak</small></div><div class="overview-card"><b>${users.filter(u => num(u.points)>0).length}</b><small>Có Points</small></div>`;
  const top = [...users].sort((a,b) => num(b.totalXP)-num(a.totalXP)).slice(0,8);
  $("streakList").innerHTML = top.map((u,i) => `<div class="admin-item"><div><b>${i+1}. ${esc(u.displayName || u.name || u.email || "User")}</b><small>🔥 ${num(u.currentStreak ?? u.streak)} · ⭐ ${num(u.totalXP)} XP · 💎 ${num(u.points)} P</small></div></div>`).join("") || `<p class="muted">Chưa có dữ liệu.</p>`;
  $("topUsers").innerHTML = `<h3>📌 Bài tập gần đây</h3>` + homeworks.slice(0,5).map((h) => `<div class="admin-item"><div><b>${esc(h.title)}</b><small>${esc(subjects.find(s=>s.id===h.subjectId)?.name || "Chưa phân loại")}</small></div></div>`).join("");
  $("recentHomework").innerHTML = homeworks.slice(0,10).map((h) => `<div class="admin-item"><div><b>${h.pinned?"📌 ":""}${esc(h.title)}</b><small>${esc(subjects.find(s=>s.id===h.subjectId)?.name || "Chưa phân loại")} · ${esc(h.dueDate || "Không đặt hạn")}</small></div></div>`).join("") || `<p class="muted">Chưa có bài tập.</p>`;
}
function renderUsers() {
  const search = $("userSearch").value.toLowerCase().trim();
  const sort = $("userSort").value;
  const list = users.filter((u) => `${u.displayName||""} ${u.email||""} ${u.username||""} ${u.id}`.toLowerCase().includes(search));
  list.sort((a,b) => sort === "streak" ? num(b.currentStreak??b.streak)-num(a.currentStreak??a.streak) : sort === "xp" ? num(b.totalXP)-num(a.totalXP) : sort === "points" ? num(b.points)-num(a.points) : String(b.lastVisitDate||"").localeCompare(String(a.lastVisitDate||"")));
  $("adminUsers").innerHTML = list.map((u) => `<div class="admin-item"><div><b>${esc(u.displayName||u.name||"Người dùng")}</b><small>${esc(u.email||"Không có email")} · UID: ${esc(u.id)}</small><small>🔥 ${num(u.currentStreak??u.streak)} · ⭐ ${num(u.totalXP)} XP · 💎 ${num(u.points)} P</small></div><div class="actions"><button data-user-edit="${esc(u.id)}" type="button">Sửa</button><button data-user-reward="${esc(u.id)}" type="button">🎁 +100 XP</button></div></div>`).join("") || `<p class="muted">Không tìm thấy người dùng.</p>`;
  document.querySelectorAll("[data-user-edit]").forEach((b) => b.onclick = () => editUser(b.dataset.userEdit));
  document.querySelectorAll("[data-user-reward]").forEach((b) => b.onclick = () => rewardUser(b.dataset.userReward));
}
function editUser(id) {
  const u = users.find((x) => x.id === id); if (!u) return;
  const modal = document.createElement("div"); modal.className = "admin-modal-backdrop";
  modal.innerHTML = `<section class="admin-modal"><div class="panel-title"><h2>👤 Sửa người dùng</h2><button id="closeUser" class="icon-btn" type="button">×</button></div><div class="admin-form-grid"><label>Tên<input id="euName" value="${esc(u.displayName||u.name||"")}"></label><label>Username<input id="euUsername" value="${esc(u.username||"")}"></label><label>Email<input id="euEmail" value="${esc(u.email||"")}"></label><label>Streak<input id="euStreak" type="number" min="0" value="${num(u.currentStreak??u.streak)}"></label><label>Streak cao nhất<input id="euLongest" type="number" min="0" value="${num(u.longestStreak??u.highestStreak)}"></label><label>XP<input id="euXP" type="number" min="0" value="${num(u.totalXP)}"></label><label>Points<input id="euPoints" type="number" min="0" value="${num(u.points)}"></label><label>Pet skin<input id="euSkin" value="${esc(u.pet?.skin||"default")}"></label></div><div class="admin-form-actions"><button id="saveUser" class="primary" type="button">💾 Lưu</button></div><p id="ueError" class="error"></p></section>`;
  document.body.appendChild(modal);
  $("closeUser").onclick = () => modal.remove();
  $("saveUser").onclick = async () => { try { const xp=Math.max(0,Math.floor(num($("euXP").value))), streak=Math.max(0,Math.floor(num($("euStreak").value))), longest=Math.max(streak,Math.floor(num($("euLongest").value))), points=Math.max(0,Math.floor(num($("euPoints").value)))); await setDoc(doc(db,"users",id),{displayName:$("euName").value.trim(),name:$("euName").value.trim(),username:$("euUsername").value.trim(),email:$("euEmail").value.trim(),currentStreak:streak,streak,longestStreak:longest,highestStreak:longest,totalXP:xp,points,level:Math.max(1,Math.floor(Math.sqrt(xp/100))+1),pet:{...(u.pet||{}),skin:$("euSkin").value.trim()||"default"},updatedAt:serverTimestamp()},{merge:true}); modal.remove(); toast("Đã lưu người dùng."); } catch(e) { $("ueError").textContent=e.message; } };
}
async function rewardUser(id) { try { await runTransaction(db, async (tx) => { const ref=doc(db,"users",id); const s=await tx.get(ref); const d=s.exists()?s.data():{}; const xp=num(d.totalXP)+100; tx.set(ref,{totalXP:xp,level:Math.max(1,Math.floor(Math.sqrt(xp/100))+1),lastRewardReason:"admin +100 XP",lastRewardAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true}); }); toast("🎁 Đã tặng 100 XP."); } catch(e) { toast(e.message); } }
function renderSubjects() { $("adminTabs").innerHTML = subjects.map((s) => `<div class="admin-item"><div><b>${esc(s.icon||"📚")} ${esc(s.name||"Môn học")}</b><small>Thứ tự: ${num(s.order)}</small></div><div class="actions"><button data-sub-edit="${esc(s.id)}" type="button">Sửa</button><button data-sub-delete="${esc(s.id)}" class="danger" type="button">Xóa</button></div></div>`).join("") || `<p class="muted">Chưa có môn.</p>`; document.querySelectorAll("[data-sub-edit]").forEach((b)=>b.onclick=()=>editSubject(b.dataset.subEdit)); document.querySelectorAll("[data-sub-delete]").forEach((b)=>b.onclick=()=>deleteSubject(b.dataset.subDelete)); }
function fillSubjectSelect(selectedId="") { const select=$("hwTab"); select.innerHTML=subjects.map((s)=>`<option value="${esc(s.id)}">${esc(s.icon||"📚")} ${esc(s.name||"Môn học")}</option>`).join("") || `<option value="">Chưa có môn</option>`; if(selectedId) select.value=selectedId; }
function renderHomework() { $("adminHomework").innerHTML=homeworks.map((h)=>`<div class="admin-item"><label class="select-check"><input type="checkbox" data-hw-select="${esc(h.id)}" ${selected.has(h.id)?"checked":""}></label><div><b>${h.pinned?"📌 ":""}${h.important?"⭐ ":""}${esc(h.title||"Bài tập")}</b><small>${esc(subjects.find(s=>s.id===h.subjectId)?.name||"Chưa phân loại")} · ${esc(h.dueDate||"Không đặt hạn")}</small><small>${esc(h.content||"").slice(0,140)}</small></div><div class="actions"><button data-hw-edit="${esc(h.id)}" type="button">Sửa</button><button data-hw-delete="${esc(h.id)}" class="danger" type="button">Xóa</button></div></div>`).join("") || `<p class="muted">Chưa có bài.</p>`; document.querySelectorAll("[data-hw-select]").forEach((x)=>x.onchange=()=>x.checked?selected.add(x.dataset.hwSelect):selected.delete(x.dataset.hwSelect)); document.querySelectorAll("[data-hw-edit]").forEach((b)=>b.onclick=()=>editHomework(b.dataset.hwEdit)); document.querySelectorAll("[data-hw-delete]").forEach((b)=>b.onclick=()=>deleteHomework(b.dataset.hwDelete)); }
function openDialog(id) { const d=$(id); if(typeof d.showModal==="function") d.showModal(); else d.setAttribute("open",""); }
function closeDialog(id) { const d=$(id); if(typeof d.close==="function" && d.open) d.close(); else d.removeAttribute("open"); }
function editHomework(id="") { const h=homeworks.find((x)=>x.id===id); $("hwDialogTitle").textContent=h?"Sửa bài tập":"Tạo bài tập"; $("hwId").value=h?.id||""; fillSubjectSelect(h?.subjectId||subjects[0]?.id||""); $("hwTitle").value=h?.title||""; $("hwContent").value=h?.content||""; $("hwDue").value=h?.dueDate||""; $("hwPinned").checked=Boolean(h?.pinned); $("hwImportant").checked=Boolean(h?.important); $("hwError").textContent=""; openDialog("homeworkDialog"); }
async function deleteHomework(id) { if(!confirm("Xóa bài tập này?")) return; try { await deleteDoc(doc(db,"homework",id)); toast("Đã xóa bài."); } catch(e){toast(e.message);} }
function editSubject(id="") { const s=subjects.find((x)=>x.id===id); $("tabDialogTitle").textContent=s?"Sửa môn học":"Tạo môn học"; $("tabId").value=s?.id||""; $("tabName").value=s?.name||""; $("tabIcon").value=s?.icon||""; $("tabError").textContent=""; openDialog("tabDialog"); }
async function deleteSubject(id) { if(homeworks.some((h)=>h.subjectId===id)) return alert("Môn này vẫn còn bài tập. Hãy chuyển/xóa bài trước."); if(!confirm("Xóa môn học?")) return; try { await deleteDoc(doc(db,"subjects",id)); toast("Đã xóa môn."); } catch(e){toast(e.message);} }
function renderSettings() { const s=settings||{}; $("adminSettings").innerHTML=`<label class="setting-card"><span><b>🔔 Không có bài mới</b><small>Hiện cảnh báo khi hôm nay chưa có bài.</small></span><input id="setNo" type="checkbox" ${s.noHomeworkNoticeEnabled!==false?"checked":""}></label><label class="setting-card"><span><b>🎁 XP mỗi bài</b><small>Phần thưởng khi tick hoàn thành.</small></span><input id="setXP" type="number" min="0" value="${num(s.xpPerHomework,30)}"></label><label class="setting-card"><span><b>💎 Points mỗi bài</b><small>Points khi tick hoàn thành.</small></span><input id="setPoints" type="number" min="0" value="${num(s.pointsPerHomework,20)}"></label><label class="setting-card"><span><b>🏆 Daily XP</b><small>Bonus khi hoàn thành toàn bộ bài hôm nay.</small></span><input id="setDailyXP" type="number" min="0" value="${num(s.dailyXP,100)}"></label><label class="setting-card"><span><b>💎 Daily Points</b><small>Bonus Points hàng ngày.</small></span><input id="setDailyPoints" type="number" min="0" value="${num(s.dailyPoints,50)}"></label><label class="setting-card"><span><b>📢 Cảnh báo bài cũ</b><small>Giữ trường cho phiên bản tương thích.</small></span><input id="setOld" type="checkbox" ${s.oldHomeworkNoticeEnabled!==false?"checked":""}></label><label>Tiêu đề<textarea id="setTitle" rows="2">${esc(s.noHomeworkNoticeTitle||"📚 Hôm nay không có bài tập mới")}</textarea></label><label>Nội dung<textarea id="setMsg" rows="3">${esc(s.noHomeworkNoticeMessage||"Hôm nay chưa có bài tập mới được cập nhật.")}</textarea></label>`; }
function renderCalendar() { const y=month.getFullYear(),m=month.getMonth(); $("calendarTitle").textContent=`Tháng ${m+1}/${y}`; const first=new Date(y,m,1), days=new Date(y,m+1,0).getDate(), offset=(first.getDay()+6)%7; let html=["T2","T3","T4","T5","T6","T7","CN"].map((x)=>`<div class="cal-head">${x}</div>`).join(""); for(let i=0;i<offset;i++) html+=`<div class="cal-day"></div>`; for(let d=1;d<=days;d++){const key=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`,hs=homeworks.filter((h)=>dateKey(h.createdAt)===key || String(h.dueDate||"").startsWith(key)); html+=`<button class="cal-day ${hs.length?"has-homework":""}" data-date="${key}" type="button"><b>${d}</b>${hs.length?`<span>${hs.length} bài</span>`:""}</button>`;} $("calendar").innerHTML=html; document.querySelectorAll("[data-date]").forEach((b)=>b.onclick=()=>{const hs=homeworks.filter((h)=>dateKey(h.createdAt)===b.dataset.date||String(h.dueDate||"").startsWith(b.dataset.date));$("calendarDetails").innerHTML=`<b>${b.dataset.date}</b>${hs.map((h)=>`<div class="admin-item"><div><b>${esc(h.title)}</b><small>${esc(subjects.find(s=>s.id===h.subjectId)?.name||"")}</small></div></div>`).join("")||"<p>Không có bài tập.</p>";}); }

$("googleLoginBtn").onclick=async()=>{ try{await signInWithPopup(auth,provider);}catch(e){console.error(e);$("loginError").textContent=`Đăng nhập thất bại: ${e.message}`;} };
$("logoutBtn").onclick=()=>signOut(auth);
$("newHomework").onclick=()=>{if(!subjects.length)return alert("Hãy tạo môn học trước.");editHomework();};
$("newTab").onclick=()=>editSubject();
$("closeHomework").onclick=()=>closeDialog("homeworkDialog");
$("closeTab").onclick=()=>closeDialog("tabDialog");
$("homeworkForm").onsubmit=async(e)=>{e.preventDefault();const id=$("hwId").value.trim(),old=homeworks.find((h)=>h.id===id);const title=$("hwTitle").value.trim(),content=$("hwContent").value.trim(),subjectId=$("hwTab").value;if(!subjectId||!title||!content){$("hwError").textContent="Hãy nhập đủ môn, tiêu đề và nội dung.";return;}try{await setDoc(doc(db,"homework",id||crypto.randomUUID()),{subjectId,title,content,dueDate:$("hwDue").value||null,pinned:$("hwPinned").checked,important:$("hwImportant").checked,createdAt:old?.createdAt||serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});closeDialog("homeworkDialog");toast("Đã lưu bài tập.");}catch(e){$("hwError").textContent=e.message;}};
$("tabForm").onsubmit=async(e)=>{e.preventDefault();const id=$("tabId").value.trim(),old=subjects.find((s)=>s.id===id),name=$("tabName").value.trim();if(!name){$("tabError").textContent="Vui lòng nhập tên môn.";return;}try{await setDoc(doc(db,"subjects",id||crypto.randomUUID()),{name,icon:$("tabIcon").value.trim()||"📚",order:old?num(old.order):subjects.length+1,updatedAt:serverTimestamp()},{merge:true});closeDialog("tabDialog");toast("Đã lưu môn.");}catch(e){$("tabError").textContent=e.message;}};
document.querySelectorAll(".admin-tab").forEach((b)=>b.onclick=()=>{document.querySelectorAll(".admin-tab").forEach((x)=>x.classList.toggle("active",x===b));document.querySelectorAll(".admin-page").forEach((p)=>p.classList.toggle("hidden",p.dataset.page!==b.dataset.adminTab));if(b.dataset.adminTab==="calendar")renderCalendar();});
$("userSearch").oninput=renderUsers; $("userSort").onchange=renderUsers; $("refreshUsers").onclick=renderUsers;
document.querySelectorAll("[data-bulk]").forEach((b)=>b.onclick=async()=>{const action=b.dataset.bulk;if(!selected.size)return alert("Hãy chọn bài trước.");if(action==="delete"&&!confirm(`Xóa ${selected.size} bài?`))return;try{for(const id of selected){if(action==="delete")await deleteDoc(doc(db,"homework",id));else await setDoc(doc(db,"homework",id),{pinned:action==="pin",updatedAt:serverTimestamp()},{merge:true});}selected.clear();toast("Đã xử lý.");}catch(e){toast(e.message);}});
$("prevMonth").onclick=()=>{month.setMonth(month.getMonth()-1);renderCalendar();}; $("nextMonth").onclick=()=>{month.setMonth(month.getMonth()+1);renderCalendar();};
$("saveAllSettings").onclick=async()=>{try{await setDoc(doc(db,"settings","site"),{noHomeworkNoticeEnabled:$("setNo").checked,oldHomeworkNoticeEnabled:$("setOld").checked,xpPerHomework:Math.max(0,num($("setXP").value,30)),pointsPerHomework:Math.max(0,num($("setPoints").value,20)),dailyXP:Math.max(0,num($("setDailyXP").value,100)),dailyPoints:Math.max(0,num($("setDailyPoints").value,50)),noHomeworkNoticeTitle:$("setTitle").value.trim(),noHomeworkNoticeMessage:$("setMsg").value.trim(),updatedAt:serverTimestamp()},{merge:true});toast("💾 Đã lưu cài đặt.");}catch(e){toast(e.message);}};

onAuthStateChanged(auth,(user)=>{if(!user){clearRealtime();showLogin();return;}if(!isAdmin(user)){signOut(auth);showLogin(`Tài khoản ${user.email||"này"} không có quyền quản trị.`);return;}showDashboard(user);startRealtime();});
