import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app=getApps().length?getApp():initializeApp(firebaseConfig);
const auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;","'":"&#39;"}[c]));
const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
let timer=null;
function rankBadge(i){return i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}
function nameOf(u){return u.displayName||u.name||u.username||u.email||"Thành viên"}
function render(list){
 const box=$("streakLeaderboard"),status=$("streakLeaderboardStatus");if(!box)return;
 if(!list.length){box.innerHTML=`<div class="hh-rank-empty">🏁 Chưa có thành viên có chuỗi.</div>`;if(status)status.textContent="Chưa có dữ liệu xếp hạng.";return;}
 box.innerHTML=list.map((u,i)=>{const name=nameOf(u),streak=Math.max(0,num(u.currentStreak??u.streak)),longest=Math.max(streak,num(u.longestStreak??u.highestStreak??u.maxStreak)),xp=Math.max(0,num(u.totalXP)),me=auth.currentUser?.uid===u.id;const avatar=u.photoURL?`<img class="hh-rank-avatar" src="${esc(u.photoURL)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="hh-rank-avatar-fallback" style="display:none">${esc((name[0]||"U").toUpperCase())}</span>`:`<span class="hh-rank-avatar-fallback">${esc((name[0]||"U").toUpperCase())}</span>`;return `<div class="hh-rank-row ${me?'is-me':''}"><span class="hh-rank-place">${rankBadge(i)}</span>${avatar}<div class="hh-rank-main"><b>${esc(name)}${me?' <small class="hh-me">Bạn</small>':''}</b><small>⭐ ${xp.toLocaleString("vi-VN")} XP · kỷ lục ${longest} ngày</small></div><strong>🔥 ${streak}</strong></div>`}).join("");
 if(status)status.textContent=`Top ${Math.min(10,list.length)} thành viên theo chuỗi hiện tại · cập nhật mỗi 30 giây`;
}
async function load(){
 const box=$("streakLeaderboard");if(!box)return;
 if(!auth.currentUser){box.innerHTML=`<div class="hh-rank-login"><span>🔐</span><div><b>Đăng nhập để xem bảng xếp hạng</b><small>Chỉ thành viên Homework Hub đã đăng nhập Google mới được hiển thị.</small></div><button id="rankLoginBtn" class="hh-rank-login-btn">Đăng nhập</button></div>`;$("rankLoginBtn")?.addEventListener("click",()=>document.getElementById("googleLogin")?.click());if($("streakLeaderboardStatus"))$("streakLeaderboardStatus").textContent="";return;}
 try{const snap=await getDocs(collection(db,"users"));const list=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>{const sa=num(a.currentStreak??a.streak),sb=num(b.currentStreak??b.streak);if(sb!==sa)return sb-sa;return num(b.totalXP)-num(a.totalXP)}).slice(0,10);render(list)}catch(e){console.error("Homework Hub leaderboard:",e);box.innerHTML=`<div class="hh-rank-empty">⚠️ Không thể tải bảng xếp hạng lúc này.</div>`;if($("streakLeaderboardStatus"))$("streakLeaderboardStatus").textContent="Lỗi tải dữ liệu."}}
onAuthStateChanged(auth,()=>load());window.addEventListener("load",()=>load());timer=setInterval(()=>{if(auth.currentUser)load()},30000);
