import { getApps, getApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app=getApps().length?getApp():null;
if(!app){console.warn("Homework Hub Admin Tools: Firebase app chưa sẵn sàng");}else{
const auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;","'":"&#39;"}[c]));
const num=v=>Number.isFinite(Number(v))?Number(v):0;
let users=[],homework=[];
async function load(){
 try{
  const [us,hw]=await Promise.all([getDocs(collection(db,"users")),getDocs(collection(db,"homework"))]);
  users=us.docs.map(d=>({id:d.id,...d.data()})); homework=hw.docs.map(d=>({id:d.id,...d.data()}));
  render();
 }catch(e){console.error("Admin tools:",e);const s=$("adminToolsStatus");if(s)s.textContent=`Lỗi: ${e.message}`;}
}
function render(){
 const rank=[...users].sort((a,b)=>num(b.currentStreak??b.streak)-num(a.currentStreak??a.streak)).slice(0,10);
 const box=$("adminLeaderboard");if(box)box.innerHTML=rank.length?rank.map((u,i)=>`<div class="admin-tool-rank"><b>#${i+1}</b><span>${esc(u.displayName||u.name||u.email||u.id)}</span><strong>🔥 ${num(u.currentStreak??u.streak)}</strong><small>⭐ ${num(u.totalXP)} XP · 💎 ${num(u.points)}</small></div>`).join(""):"<p class='muted'>Chưa có người dùng.</p>";
 const stats=$("adminToolsStats");if(stats)stats.innerHTML=`<div><b>${users.length}</b><small>Người dùng</small></div><div><b>${homework.length}</b><small>Bài tập</small></div><div><b>${users.filter(u=>num(u.currentStreak??u.streak)>0).length}</b><small>Có streak</small></div><div><b>${users.reduce((a,u)=>a+num(u.totalXP),0).toLocaleString('vi-VN')}</b><small>Tổng XP</small></div>`;
 const s=$("adminToolsStatus");if(s)s.textContent=`Đã tải ${users.length} người dùng và ${homework.length} bài tập.`;
}
function csv(rows){return rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");}
function download(name,text){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+text],{type:"text/csv;charset=utf-8"}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
$("adminToolsRefresh")?.addEventListener("click",load);
$("exportUsersCsv")?.addEventListener("click",()=>download("homework-hub-users.csv",csv([["UID","Email","Tên","Streak","Kỷ lục","XP","Points","Last visit"],...users.map(u=>[u.id,u.email,u.displayName||u.name||"",num(u.currentStreak??u.streak),num(u.longestStreak??u.highestStreak??u.maxStreak),num(u.totalXP),num(u.points),u.lastVisitDate||""]) ])));
$("exportHomeworkCsv")?.addEventListener("click",()=>download("homework-hub-homework.csv",csv([["ID","Tiêu đề","Môn","Hạn nộp","Ghim","Quan trọng"],...homework.map(h=>[h.id,h.title||"",h.subjectId||h.tabId||"",h.dueDate||"",h.pinned?"Có":"Không",h.important?"Có":"Không"]) ])));
$("copyAdminSummary")?.addEventListener("click',async()=>{});
onAuthStateChanged(auth,u=>{if(u)load();});
}
