import {initializeApp} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithPopup,GoogleAuthProvider,signOut} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {getFirestore,collection,doc,setDoc,deleteDoc,onSnapshot,query,orderBy,serverTimestamp,runTransaction,getDocs} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";
const app=initializeApp(firebaseConfig),db=getFirestore(app),auth=getAuth(app),provider=new GoogleAuthProvider(),$=id=>document.getElementById(id);const ADMINS=["028riu@gmail.com", "tu0ngtun2gsahur8@gmail.com", "linh085760@gmail.com", "linh085760@stu.vinschool.edu.vn", "minh037199@stu.vinschool.edu.vn", "tran034866@stu.vinschool.edu.vn", "phuong026443@stu.vinschool.edu.vn"].map(x=>x.toLowerCase());const DAY=86400000,TZ="Asia/Ho_Chi_Minh";let users=[],homeworks=[],subjects=[],progressDocs=[],settings={};let unsub=[];let selected=new Set(),month=new Date();let sort="activity";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;const isAdmin=e=>e&&ADMINS.includes(String(e).toLowerCase());const dateKey=v=>{if(!v)return"";const d=v?.toDate?v.toDate():v?.seconds?new Date(v.seconds*1000):new Date(v);return Number.isNaN(d.getTime())?"":new Intl.DateTimeFormat("en-CA",{timeZone:TZ}).format(d)};const fmt=v=>{if(!v)return"Chưa có";const d=v?.toDate?v.toDate():v?.seconds?new Date(v.seconds*1000):new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString("vi-VN")};
function setHidden(id,x){$(id)?.classList.toggle("hidden",x)}function err(t){if($("loginError"))$("loginError").textContent=t}function close(id){const d=$(id);if(d?.open)d.close()}function open(id){const d=$(id);if(d?.showModal)d.showModal()}
$("googleLoginBtn")?.addEventListener("click",async()=>{err("");try{await signInWithPopup(auth,provider)}catch(e){err(`Không thể đăng nhập: ${e.code||e.message}`)}});$("logoutBtn")?.addEventListener("click",()=>signOut(auth));
onAuthStateChanged(auth,user=>{if(!user){setHidden("loginView",false);setHidden("dashboard",true);stop();return}if(!isAdmin(user.email)){err(`Tài khoản ${user.email||"này"} không có quyền quản trị.`);signOut(auth);return}setHidden("loginView",true);setHidden("dashboard",false);$("adminUser").textContent=`${user.displayName||"Admin"} · ${user.email}`;start()});function stop(){unsub.forEach(f=>f&&f());unsub=[]}
async function loadUsersNow(){try{const s=await getDocs(collection(db,"users"));users=s.docs.map(d=>({id:d.id,...d.data()}));renderUsers();renderOverview();renderStats();console.log("Homework Hub Admin: loaded users",users.length)}catch(e){console.error("Homework Hub Admin: cannot read users",e)}}
function start(){if(unsub.length)return;unsub.push(onSnapshot(collection(db,"users"),s=>{users=s.docs.map(d=>({id:d.id,...d.data()}));renderUsers();renderOverview();renderStats();console.log("Homework Hub Admin: realtime users",users.length)},e=>{console.error("Homework Hub Admin: users listener error",e);loadUsersNow();setTimeout(()=>{if(unsub.length)try{unsub[0]?.();}catch(_){ } start();},3000)}));unsub.push(onSnapshot(query(collection(db,"subjects"),orderBy("order","asc")),s=>{subjects=s.docs.map(d=>({id:d.id,...d.data()}));renderSubjects();fillSubjectSelect();renderCalendar()}));unsub.push(onSnapshot(query(collection(db,"homework"),orderBy("createdAt","desc")),s=>{homeworks=s.docs.map(d=>({id:d.id,...d.data()}));renderHomework();renderOverview();renderStats();renderCalendar()}));unsub.push(onSnapshot(collection(db,"settings"),s=>{settings={};s.docs.forEach(d=>settings[d.id]=d.data());renderSettings()}));
  // BME listener: chỉ chạy khi Admin đã đăng nhập, và được dọn cùng các listener khác.
  unsub.push(onSnapshot(collection(db,"bme_homework"),s=>{
    bmeHomeworks=s.docs.map(d=>({id:d.id,...d.data()}));
    renderBmeHomework();
  },e=>{
    console.error("Homework Hub Admin: BME listener error",e);
    const c=$("bmeHomeworkList");
    if(c)c.innerHTML=`<div class="error">Không thể tải bài BME: ${esc(e.message)}</div>`;
  }));
}
function renderStats(){const active=users.filter(u=>dateKey(u.lastVisitAt||u.lastVisitDate||u.lastLoginAt)===new Intl.DateTimeFormat("en-CA",{timeZone:TZ}).format(new Date())).length;const xp=users.reduce((a,u)=>a+num(u.totalXP),0),points=users.reduce((a,u)=>a+num(u.points),0),completed=users.reduce((a,u)=>a+num(u.completedHomeworkCount),0);$("statUsers").textContent=users.length;$("statHomework").textContent=homeworks.length;$("statActive").textContent=active;$("statXP").textContent=xp.toLocaleString("vi-VN");$("statPoints").textContent=points.toLocaleString("vi-VN");$("statCompleted").textContent=completed.toLocaleString("vi-VN")}
function renderOverview(){const total=users.length,avg=total?users.reduce((a,u)=>a+num(u.currentStreak??u.streak),0)/total:0,best=users.length?Math.max(...users.map(u=>num(u.longestStreak??u.streak))):0;$("overviewCards").innerHTML=[["👥","Users",total],["🔥","Streak TB",avg.toFixed(1)],["🏆","Streak cao nhất",best],["📚","Môn học",subjects.length],["📝","Bài tập",homeworks.length],["💎","Points",users.reduce((a,u)=>a+num(u.points),0).toLocaleString("vi-VN")]].map(x=>`<div class="overview-card"><span>${x[0]}</span><b>${x[2]}</b><small>${x[1]}</small></div>`).join("");const ranked=[...users].sort((a,b)=>num(b.currentStreak??b.streak)-num(a.currentStreak??a.streak)).slice(0,8);$("topUsers").innerHTML=ranked.length?ranked.map((u,i)=>`<div class="rank-row"><b>#${i+1}</b><span>${esc(u.displayName||u.name||u.email||u.id)}</span><small>🔥 ${num(u.currentStreak??u.streak)} · ⭐ ${num(u.totalXP)}</small></div>`).join(""):"<p class='muted'>Chưa có người dùng.</p>";$("recentHomework").innerHTML=homeworks.slice(0,6).map(h=>`<div class="admin-item"><b>${h.pinned?'📌 ':''}${h.important?'⭐ ':''}${esc(h.title)}</b><small>${esc(subjects.find(s=>s.id===h.subjectId)?.name||'Môn chưa rõ')} · ${fmt(h.createdAt)}</small></div>`).join("")||"<p class='muted'>Chưa có bài.</p>"}
function renderUsers(){const c=$("adminUsers");if(!c)return;let list=[...users];const q=($("userSearch")?.value||"").trim().toLowerCase();if(q)list=list.filter(u=>[u.id,u.email,u.displayName,u.name,u.username].some(v=>String(v||"").toLowerCase().includes(q)));list.sort((a,b)=>sort==="streak"?num(b.currentStreak??b.streak)-num(a.currentStreak??a.streak):sort==="xp"?num(b.totalXP)-num(a.totalXP):sort==="points"?num(b.points)-num(a.points):String(b.lastVisitAt||b.lastLoginAt||b.lastVisitDate||"").localeCompare(String(a.lastVisitAt||a.lastLoginAt||a.lastVisitDate||"")));c.innerHTML=list.length?list.map(u=>{const st=num(u.currentStreak??u.streak),long=num(u.longestStreak??u.streak),xp=num(u.totalXP),points=num(u.points),name=u.displayName||u.name||u.email||u.id;return `<div class="admin-item user-admin-item"><div class="user-main"><span class="avatar">${esc((name[0]||"U").toUpperCase())}</span><div><b>${esc(name)}</b><small>${esc(u.email||"Không có email")}</small><small>UID: ${esc(u.id||u.uid||"")}</small><small>🔥 ${st} · 🏆 ${long} · ⭐ ${xp} XP · 💎 ${points} · 📅 ${esc(u.lastVisitDate||"Chưa có")}</small></div></div><div class="actions"><button data-user-edit="${esc(u.id)}">Sửa</button></div></div>`}).join(""):"<p class='muted'>Chưa có người dùng.</p>";}$("userSearch").oninput=renderUsers;$("userSort").onchange=e=>{sort=e.target.value;renderUsers()};$("refreshUsers").onclick=loadUsersNow;document.addEventListener("click",e=>{const b=e.target.closest("[data-user-edit]");if(b)editUser(b.dataset.userEdit)});
function editUser(id){const u=users.find(x=>x.id===id);if(!u)return;document.querySelector("#userEditorModal")?.remove();const m=document.createElement("div");m.id="userEditorModal";m.innerHTML=`<div class="admin-modal-backdrop"><div class="admin-modal"><div class="admin-modal-header"><div><p class="eyebrow">USER CONTROL</p><h2>👤 ${esc(u.displayName||u.email||u.id)}</h2></div><button class="icon-btn" id="closeUserEditor">×</button></div><div class="admin-form"><label>Email profile<input id="euEmail" value="${esc(u.email||'')}"></label><label>Username<input id="euUsername" value="${esc(u.username||'')}"></label><label>Tên hiển thị<input id="euName" value="${esc(u.displayName||u.name||'')}"></label><div class="form-2"><label>🔥 Streak<input id="euStreak" type="number" min="0" value="${num(u.currentStreak??u.streak)}"></label><label>🏆 Streak cao nhất<input id="euLongest" type="number" min="0" value="${num(u.longestStreak??u.streak)}"></label><label>⭐ Total XP<input id="euXP" type="number" min="0" value="${num(u.totalXP)}"></label><label>💎 Points<input id="euPoints" type="number" min="0" value="${num(u.points)}"></label></div><label>📅 Last visit<input id="euDate" placeholder="YYYY-MM-DD" value="${esc(u.lastVisitDate||'')}"></label><h3>🐾 Pet</h3><div class="form-2"><label>Skin<input id="euSkin" value="${esc(u.pet?.skin||'default')}"></label><label>Pet type<input id="euPet" value="${esc(u.pet?.type||'flamey')}"></label></div><label>🎁 Unlock items (phân cách bằng dấu phẩy)<input id="euItems" value="${esc((u.unlockedItems||[]).join(', '))}"></label><div class="reward-buttons"><button data-reward="100xp">+100 XP</button><button data-reward="500xp">+500 XP</button><button data-reward="500p">+500 Points</button><button data-reward="reset">Reset Streak</button></div><div class="actions"><button class="primary" id="saveUser">💾 Lưu toàn bộ</button><button class="danger" id="deleteUser">🗑 Xóa profile</button></div><p id="ueError" class="error"></p></div></div></div>`;document.body.appendChild(m);$("closeUserEditor").onclick=()=>m.remove();m.querySelector('.admin-modal-backdrop').onclick=e=>{if(e.target.classList.contains('admin-modal-backdrop'))m.remove()};m.querySelectorAll('[data-reward]').forEach(b=>b.onclick=async()=>{const r=b.dataset.reward;try{await rewardUser(id,r);if(r==='reset')$("euStreak").value=0;else if(r==='100xp')$("euXP").value=num($("euXP").value)+100;else if(r==='500xp')$("euXP").value=num($("euXP").value)+500;else $("euPoints").value=num($("euPoints").value)+500}catch(e){$("ueError").textContent=e.message}});$("saveUser").onclick=async()=>{try{const streak=Math.max(0,Math.floor(num($("euStreak").value))),longest=Math.max(streak,Math.floor(num($("euLongest").value))),xp=Math.max(0,Math.floor(num($("euXP").value))),points=Math.max(0,Math.floor(num($("euPoints").value)));await setDoc(doc(db,"users",id),{email:$("euEmail").value.trim(),username:$("euUsername").value.trim(),displayName:$("euName").value.trim(),name:$("euName").value.trim(),streak,currentStreak:streak,longestStreak:longest,highestStreak:longest,maxStreak:longest,totalXP:xp,points,level:Math.max(1,Math.floor(Math.sqrt(xp/100))+1),lastVisitDate:$("euDate").value.trim(),pet:{...(u.pet||{}),type:$("euPet").value.trim()||'flamey',skin:$("euSkin").value.trim()||'default'},unlockedItems:$("euItems").value.split(',').map(x=>x.trim()).filter(Boolean),updatedAt:serverTimestamp()},{merge:true});m.remove();showToast('Đã lưu người dùng.')}catch(e){$("ueError").textContent=`Không thể lưu: ${e.message}`}};$("deleteUser").onclick=async()=>{if(!confirm('Xóa profile Firestore? Authentication Google không bị xóa.'))return;try{await deleteDoc(doc(db,'users',id));m.remove()}catch(e){$("ueError").textContent=e.message}}}
async function rewardUser(id,r){const ref=doc(db,'users',id);await runTransaction(db,async tx=>{const s=await tx.get(ref),d=s.exists()?s.data():{};let xp=num(d.totalXP),points=num(d.points),streak=num(d.currentStreak??d.streak);if(r==='100xp')xp+=100;if(r==='500xp')xp+=500;if(r==='500p')points+=500;if(r==='reset')streak=0;tx.set(ref,{totalXP:xp,points,currentStreak:streak,streak,level:Math.max(1,Math.floor(Math.sqrt(xp/100))+1),updatedAt:serverTimestamp()},{merge:true})})}
function renderSubjects(){const c=$("adminTabs");c.innerHTML=subjects.map(s=>`<div class="admin-item"><b>${esc(s.icon||'📚')} ${esc(s.name)}</b><small>Order: ${num(s.order)}</small><div class="actions"><button data-action="edit-subject" data-id="${s.id}">Sửa</button><button class="danger" data-action="delete-subject" data-id="${s.id}">Xóa</button></div></div>`).join('')||'<p class="muted">Chưa có môn.</p>'}function fillSubjectSelect(id=''){const s=$("hwTab");s.innerHTML=subjects.map(x=>`<option value="${esc(x.id)}">${esc(x.icon||'📚')} ${esc(x.name)}</option>`).join('')||'<option value="">Chưa có môn</option>';if(id)s.value=id}
function renderHomework(){const c=$("adminHomework");c.innerHTML=homeworks.map(h=>`<div class="admin-item hw-admin-row"><label class="select-check"><input type="checkbox" data-hw-select="${esc(h.id)}" ${selected.has(h.id)?'checked':''}></label><div><b>${h.pinned?'📌 ':''}${h.important?'⭐ ':''}${esc(h.title)}</b><small>${esc(subjects.find(s=>s.id===h.subjectId)?.name||'Chưa phân loại')} · ${esc(h.dueDate||'Không đặt hạn')}</small><small>${esc(h.content||'').slice(0,180)}</small></div><div class="actions"><button data-action="edit-homework" data-id="${esc(h.id)}">Sửa</button><button class="danger" data-action="delete-homework" data-id="${esc(h.id)}">Xóa</button></div></div>`).join('')||'<p class="muted">Chưa có bài.</p>';document.querySelectorAll('[data-hw-select]').forEach(x=>x.onchange=()=>x.checked?selected.add(x.dataset.hwSelect):selected.delete(x.dataset.hwSelect))}
function addHomeworkLink(value=""){const list=$("hwLinksList");if(!list)return;const row=document.createElement("div");row.className="hw-link-row";row.innerHTML=`<input class="hw-link-input" type="url" placeholder="https://..." value="${esc(value)}"><button type="button" class="ghost small remove-hw-link" aria-label="Xóa link">×</button>`;row.querySelector(".remove-hw-link").onclick=()=>{const rows=list.querySelectorAll(".hw-link-row");if(rows.length<=1)row.querySelector(".hw-link-input").value="";else row.remove()};list.appendChild(row)}
function setHomeworkLinks(values){const list=$("hwLinksList");if(!list)return;list.innerHTML="";const links=Array.isArray(values)?values.filter(Boolean):[];(links.length?links:[""]).forEach(addHomeworkLink)}
function getHomeworkLinks(){return [...document.querySelectorAll("#hwLinksList .hw-link-input")].map(x=>x.value.trim()).filter(Boolean)}
$("addHomeworkLink")?.addEventListener("click",()=>addHomeworkLink());
$("newHomework").onclick=()=>{$("homeworkForm").reset();$("hwId").value='';setHomeworkLinks([]);fillSubjectSelect();open('homeworkDialog')};$("newTab").onclick=()=>{$("tabForm").reset();$("tabId").value='';open('tabDialog')};
$("homeworkForm").onsubmit=async e=>{e.preventDefault();const id=$("hwId").value.trim(),old=homeworks.find(h=>h.id===id),links=getHomeworkLinks();const data={subjectId:$("hwTab").value,title:$("hwTitle").value.trim(),content:$("hwContent").value.trim(),links,url:links[0]||"",dueDate:$("hwDue").value||null,pinned:$("hwPinned").checked,important:$("hwImportant").checked,createdAt:old?.createdAt||serverTimestamp(),updatedAt:serverTimestamp()};try{await setDoc(doc(db,'homework',id||crypto.randomUUID()),data);close('homeworkDialog')}catch(x){$("hwError").textContent=x.message}};
$("tabForm").onsubmit=async e=>{e.preventDefault();const id=$("tabId").value.trim(),old=subjects.find(s=>s.id===id),order=old?num(old.order):subjects.length+1;try{await setDoc(doc(db,'subjects',id||crypto.randomUUID()),{name:$("tabName").value.trim(),icon:$("tabIcon").value.trim()||'📚',order,updatedAt:serverTimestamp()});close('tabDialog')}catch(x){$("tabError").textContent=x.message}};
document.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b)return;const id=b.dataset.id;try{if(b.dataset.action==='edit-homework'){const h=homeworks.find(x=>x.id===id);$("hwId").value=id;$("hwTitle").value=h.title||'';$("hwContent").value=h.content||'';setHomeworkLinks(Array.isArray(h.links)?h.links:(h.url?[h.url]:[]));$("hwDue").value=h.dueDate||'';$("hwPinned").checked=!!h.pinned;$("hwImportant").checked=!!h.important;fillSubjectSelect(h.subjectId);open('homeworkDialog')}if(b.dataset.action==='delete-homework'&&confirm('Xóa bài này?'))await deleteDoc(doc(db,'homework',id));if(b.dataset.action==='edit-subject'){const s=subjects.find(x=>x.id===id);$("tabId").value=id;$("tabName").value=s.name||'';$("tabIcon").value=s.icon||'';open('tabDialog')}if(b.dataset.action==='delete-subject'){if(homeworks.some(h=>h.subjectId===id))return alert('Môn đang có bài tập.');if(confirm('Xóa môn?'))await deleteDoc(doc(db,'subjects',id))}}catch(x){alert(x.message)}});
document.querySelectorAll('[data-bulk]').forEach(b=>b.onclick=async()=>{const act=b.dataset.bulk;if(!selected.size)return alert('Hãy chọn ít nhất một bài.');if(act==='delete'&&!confirm(`Xóa ${selected.size} bài?`))return;for(const id of selected){if(act==='delete')await deleteDoc(doc(db,'homework',id));else await setDoc(doc(db,'homework',id),{pinned:act==='pin',updatedAt:serverTimestamp()},{merge:true})}selected.clear();renderHomework()});
function renderCalendar(){const y=month.getFullYear(),m=month.getMonth();$("calendarTitle").textContent=`Tháng ${m+1}/${y}`;const first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),offset=(first.getDay()+6)%7;let html=['T2','T3','T4','T5','T6','T7','CN'].map(x=>`<div class="cal-head">${x}</div>`).join('');for(let i=0;i<offset;i++)html+='<div class="cal-day empty-day"></div>';for(let d=1;d<=days;d++){const key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,hs=homeworks.filter(h=>dateKey(h.createdAt)===key||String(h.dueDate||'').startsWith(key));html+=`<button class="cal-day ${hs.length?'has-homework':''}" data-date="${key}"><b>${d}</b>${hs.length?`<span>${hs.length} bài</span>`:''}</button>`}$("calendar").innerHTML=html;document.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{const hs=homeworks.filter(h=>dateKey(h.createdAt)===b.dataset.date||String(h.dueDate||'').startsWith(b.dataset.date));$("calendarDetails").innerHTML=`<b>${b.dataset.date}</b>${hs.length?hs.map(h=>`<div class="admin-item"><b>${esc(h.title)}</b><small>${esc(subjects.find(s=>s.id===h.subjectId)?.name||'')}</small></div>`).join(''):'<p>Không có bài tập.</p>'}`})}
$("prevMonth").onclick=()=>{month.setMonth(month.getMonth()-1);renderCalendar()};$("nextMonth").onclick=()=>{month.setMonth(month.getMonth()+1);renderCalendar()};
function renderSettings(){const s=settings.site||{};$("adminSettings").innerHTML=`<label class="setting-card"><span><b>🔔 Thông báo không có bài mới</b><small>Bật cảnh báo khi hôm nay chưa có bài mới.</small></span><input id="setNo" type="checkbox" ${s.noHomeworkNoticeEnabled!==false?'checked':''}></label><label class="setting-card"><span><b>📢 Thông báo bài cũ</b><small>Bật cảnh báo khi danh sách chưa cập nhật.</small></span><input id="setOld" type="checkbox" ${s.oldHomeworkNoticeEnabled!==false?'checked':''}></label><label class="setting-card"><span><b>🎁 XP hoàn thành bài</b><small>Số XP mặc định hiển thị trên card.</small></span><input id="setXP" type="number" min="0" value="${num(s.xpPerHomework,30)}"></label><label class="setting-card"><span><b>💎 Points hoàn thành bài</b><small>Số Points mặc định.</small></span><input id="setPoints" type="number" min="0" value="${num(s.pointsPerHomework,20)}"></label><label>Tiêu đề thông báo<textarea id="setTitle" rows="2">${esc(s.noHomeworkNoticeTitle||'📚 Hôm nay không có bài tập mới')}</textarea></label><label>Nội dung thông báo<textarea id="setMsg" rows="3">${esc(s.noHomeworkNoticeMessage||'Hôm nay chưa có bài tập mới được cập nhật.')}</textarea></label>`}$("saveAllSettings").onclick=async()=>{try{await setDoc(doc(db,'settings','site'),{noHomeworkNoticeEnabled:$("setNo").checked,oldHomeworkNoticeEnabled:$("setOld").checked,xpPerHomework:num($("setXP").value,30),pointsPerHomework:num($("setPoints").value,20),noHomeworkNoticeTitle:$("setTitle").value.trim(),noHomeworkNoticeMessage:$("setMsg").value.trim(),updatedAt:serverTimestamp()},{merge:true});showToast('Đã lưu cài đặt')}catch(e){alert(e.message)}};
document.querySelectorAll('.admin-tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.admin-tab').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.admin-page').forEach(p=>p.classList.toggle('hidden',p.dataset.page!==b.dataset.adminTab));if(b.dataset.adminTab==='calendar')renderCalendar()});
function showToast(t){const x=document.createElement('div');x.className='toast';x.textContent=t;document.body.appendChild(x);requestAnimationFrame(()=>x.classList.add('show'));setTimeout(()=>x.remove(),2300)}window.HomeworkAdmin={get state(){return{users,homeworks,subjects,settings}},editUser,rewardUser};
window.__HOMEWORK_HUB_ADMIN__={auth,db,isAdmin,get currentUser(){return auth.currentUser}};

// ============================================================
// BME — PARENT VIEW MANAGEMENT
// ============================================================

let bmeHomeworks = [];

function getBmeLinks(item) {
  if (Array.isArray(item?.links)) return item.links.filter(Boolean).map(String);
  if (item?.link) return [String(item.link)];
  if (item?.url) return [String(item.url)];
  return [];
}

function addBmeLinkRow(value = "") {
  const list = $("bmeLinksList");
  if (!list) return;
  const row = document.createElement("div");
  row.className = "hw-link-row";
  row.innerHTML = `
    <input class="bme-link-input" type="url" placeholder="https://..." value="${esc(value)}">
    <button type="button" class="ghost small remove-bme-link" aria-label="Xóa link">×</button>
  `;
  row.querySelector(".remove-bme-link").onclick = () => {
    if (list.children.length === 1) {
      row.querySelector(".bme-link-input").value = "";
    } else {
      row.remove();
    }
  };
  list.appendChild(row);
}

function setBmeLinks(values = []) {
  const list = $("bmeLinksList");
  if (!list) return;
  list.innerHTML = "";
  const clean = Array.isArray(values) ? values.filter(Boolean) : [];
  (clean.length ? clean : [""]).forEach(addBmeLinkRow);
}

function getBmeLinksFromForm() {
  return [...document.querySelectorAll("#bmeLinksList .bme-link-input")]
    .map((input) => input.value.trim())
    .filter(Boolean);
}

function fillBmeSubject(selected = "") {
  const select = $("bmeSubject");
  if (!select) return;
  select.innerHTML = subjects.length
    ? subjects.map((subject) => `
        <option value="${esc(subject.id)}">
          ${esc(subject.icon || "📚")} ${esc(subject.name || "Môn học")}
        </option>
      `).join("")
    : `<option value="">Chưa có môn học</option>`;
  if (selected) select.value = selected;
}

function renderBmeHomework() {
  const container = $("bmeHomeworkList");
  if (!container) return;

  if (!bmeHomeworks.length) {
    container.innerHTML = `
      <div class="empty">
        👨‍👩‍👧<br><br>
        Chưa có bài tập cho phụ huynh.<br><br>
        <button type="button" class="primary small" id="emptyBmeCreate">＋ Đăng bài tập đầu tiên</button>
      </div>
    `;
    $("emptyBmeCreate")?.addEventListener("click", openBmeCreate, { once: true });
    return;
  }

  container.innerHTML = bmeHomeworks.map((item) => {
    const subject = subjects.find((s) => s.id === item.subjectId);
    const links = getBmeLinks(item);
    return `
      <article class="admin-item bme-admin-item">
        <div>
          <b>${esc(subject?.icon || "📚")} ${esc(item.title || "Bài tập")}</b>
          <small>${esc(subject?.name || "Chưa phân loại")}</small>
          ${item.dueDate ? `<small>⏰ Hạn: ${esc(fmt(item.dueDate))}</small>` : ""}
          <small>${esc(item.content || "").slice(0, 260)}</small>
          ${links.length ? `<small>🔗 ${links.length} link</small>` : ""}
        </div>
        <div class="actions">
          <button type="button" data-bme-edit="${esc(item.id)}">✏️ Sửa</button>
          <button type="button" class="danger" data-bme-delete="${esc(item.id)}">🗑 Xóa</button>
        </div>
      </article>
    `;
  }).join("");
}

function openBmeCreate() {
  $("bmeHomeworkForm")?.reset();
  $("bmeId").value = "";
  $("bmeDialogTitle").textContent = "Đăng bài tập BME";
  $("bmeError").textContent = "";
  fillBmeSubject();
  setBmeLinks([]);
  open("bmeHomeworkDialog");
}

function openBmeEdit(id) {
  const item = bmeHomeworks.find((x) => x.id === id);
  if (!item) return;
  $("bmeDialogTitle").textContent = "Sửa bài tập BME";
  $("bmeId").value = item.id;
  fillBmeSubject(item.subjectId || "");
  $("bmeTitle").value = item.title || "";
  $("bmeContent").value = item.content || "";
  $("bmeDue").value = item.dueDate || "";
  $("bmeError").textContent = "";
  setBmeLinks(getBmeLinks(item));
  open("bmeHomeworkDialog");
}

async function deleteBmeHomework(id) {
  const item = bmeHomeworks.find((x) => x.id === id);
  if (!item) return;
  if (!confirm(`Xóa bài BME "${item.title || "Bài tập"}"?`)) return;
  try {
    await deleteDoc(doc(db, "bme_homework", id));
    showToast("🗑️ Đã xóa bài BME");
  } catch (error) {
    alert(`Không thể xóa: ${error.message}`);
  }
}

$("newBmeHomework")?.addEventListener("click", openBmeCreate);
$("addBmeLink")?.addEventListener("click", () => addBmeLinkRow(""));

document.addEventListener("click", (event) => {
  const edit = event.target.closest("[data-bme-edit]");
  const del = event.target.closest("[data-bme-delete]");
  if (edit) openBmeEdit(edit.dataset.bmeEdit);
  if (del) deleteBmeHomework(del.dataset.bmeDelete);
});

$("bmeHomeworkForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = $("bmeError");
  error.textContent = "";

  const id = $("bmeId").value.trim();
  const subjectId = $("bmeSubject").value;
  const title = $("bmeTitle").value.trim();
  const content = $("bmeContent").value.trim();
  const dueDate = $("bmeDue").value || null;
  const links = getBmeLinksFromForm();

  if (!title) return void (error.textContent = "Vui lòng nhập tiêu đề.");
  if (!content) return void (error.textContent = "Vui lòng nhập nội dung.");

  for (const link of links) {
    try {
      const url = new URL(link);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    } catch {
      error.textContent = "Có link không hợp lệ.";
      return;
    }
  }

  try {
    const old = bmeHomeworks.find((x) => x.id === id);
    await setDoc(
      doc(db, "bme_homework", id || crypto.randomUUID()),
      {
        subjectId,
        title,
        content,
        dueDate,
        links,
        link: links[0] || "",
        createdAt: old?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );
    close("bmeHomeworkDialog");
    showToast(id ? "✅ Đã cập nhật bài BME" : "✅ Đã đăng bài BME");
  } catch (saveError) {
    error.textContent = saveError.message;
  }
});
