import { getApps, getApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = getApps().length ? getApp() : null;
if (!app) throw new Error("Homework Hub: Firebase app chưa được khởi tạo.");
const auth = getAuth(app), db = getFirestore(app);
const ADMINS = ["028riu@gmail.com","tu0ngtun2gsahur@gmail.com","linh085760@gmail.com","linh085760@stu.vinschool.edu.vn","minh037199@stu.vinschool.edu.vn","tran034866@stu.vinschool.edu.vn","phuong026443@stu.vinschool.edu.vn"].map(x => x.toLowerCase());
const $ = id => document.getElementById(id);
const esc = v => String(v ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;","'":"&#39;"}[c]));

function toast(text){
  let t = $("noticeAdminToast");
  if(!t){ t=document.createElement("div"); t.id="noticeAdminToast"; t.style.cssText="position:fixed;right:18px;bottom:18px;z-index:99999;padding:12px 16px;border-radius:12px;background:#171a31;color:#fff;box-shadow:0 12px 35px #0007;font-weight:700"; document.body.appendChild(t); }
  t.textContent=text; clearTimeout(t._timer); t._timer=setTimeout(()=>t.remove(),2600);
}

function inject(){
  const page=document.querySelector('[data-page="settings"]');
  if(!page || $("directNotificationAdmin")) return;
  const panel=document.createElement("section");
  panel.className="panel";
  panel.id="directNotificationAdmin";
  panel.style.cssText="margin-top:18px";
  panel.innerHTML=`
    <div class="panel-title">
      <div><h2>📢 Thông báo trực tiếp</h2><p class="muted">Phát thông báo cho người dùng ở trang chủ. Có thể thu hồi bất cứ lúc nào.</p></div>
      <span id="notificationAdminStatus" class="muted">Đang kiểm tra...</span>
    </div>
    <div style="display:grid;gap:12px">
      <label>Tiêu đề<input id="noticeAdminTitle" maxlength="120" placeholder="Ví dụ: Thông báo mới"></label>
      <label>Nội dung<textarea id="noticeAdminMessage" rows="5" maxlength="2000" placeholder="Nội dung thông báo..."></textarea></label>
      <div class="actions">
        <button id="noticeAdminPublish" class="primary" type="button">📢 Phát thông báo</button>
        <button id="noticeAdminRevoke" class="danger" type="button">🗑 Thu hồi thông báo</button>
      </div>
      <p id="noticeAdminError" class="error"></p>
    </div>`;
  page.appendChild(panel);
  $("noticeAdminPublish").onclick=publish;
  $("noticeAdminRevoke").onclick=revoke;
  load();
}

async function load(){
  try{
    const snap=await getDoc(doc(db,"settings","directNotification"));
    if(!snap.exists()){ setStatus("🟢 Không có thông báo đang phát"); return; }
    const d=snap.data();
    $("noticeAdminTitle").value=d.title||"";
    $("noticeAdminMessage").value=d.message||"";
    setStatus(d.active===false?"⚪ Đã tắt":"🔴 Đang phát");
  }catch(e){ setStatus("⚠️ Không đọc được"); $("noticeAdminError").textContent=e.message; }
}
function setStatus(x){ if($("notificationAdminStatus")) $("notificationAdminStatus").textContent=x; }

async function publish(){
  const title=$("noticeAdminTitle").value.trim(), message=$("noticeAdminMessage").value.trim();
  if(!title || !message){ $("noticeAdminError").textContent="Hãy nhập cả tiêu đề và nội dung."; return; }
  $("noticeAdminError").textContent="";
  try{
    const id=crypto.randomUUID();
    await setDoc(doc(db,"settings","directNotification"),{id,title,message,active:true,sentAt:serverTimestamp(),updatedAt:serverTimestamp()});
    setStatus("🔴 Đang phát"); toast("📢 Đã phát thông báo");
  }catch(e){ $("noticeAdminError").textContent=`Không thể phát: ${e.message}`; }
}

async function revoke(){
  if(!confirm("Thu hồi thông báo hiện tại? Sau khi thu hồi, người dùng sẽ không còn thấy thông báo đó khi mở trang.")) return;
  $("noticeAdminError").textContent="";
  try{
    await deleteDoc(doc(db,"settings","directNotification"));
    setStatus("🟢 Đã thu hồi / không có thông báo");
    toast("🗑 Đã thu hồi thông báo");
  }catch(e){ $("noticeAdminError").textContent=`Không thể thu hồi: ${e.message}`; }
}

onAuthStateChanged(auth,user=>{
  if(user && ADMINS.includes(String(user.email||"").toLowerCase())) setTimeout(inject,300);
});
setTimeout(inject,1200);
