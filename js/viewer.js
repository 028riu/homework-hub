import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore, collection, doc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app=initializeApp(firebaseConfig),db=getFirestore(app),auth=getAuth(app),$=id=>document.getElementById(id);
const googleProvider=new GoogleAuthProvider();
const now=new Date();
$("today").textContent=new Intl.DateTimeFormat("vi-VN",{dateStyle:"full"}).format(now);

let tabs=[],homework=[],active="all",search="";
const DAY=86400000;
function dayKey(d=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh"}).format(d)}
function updateStreak(){
  const key="hh_streak_v2";
  const today=dayKey();
  let data;
  try{data=JSON.parse(localStorage.getItem(key)||'{"last":"","count":0}')}catch{data={last:"",count:0}}
  if(data.last!==today){
    const prev=data.last?new Date(data.last+"T12:00:00+07:00"):null;
    const cur=new Date(today+"T12:00:00+07:00");
    const gap=prev?Math.round((cur-prev)/DAY):0;
    data.count=(data.last&&gap===1)?data.count+1:1;
    data.last=today;
    localStorage.setItem(key,JSON.stringify(data));
  }
  const count=Math.max(1,Number(data.count)||1);
  const streak=$('streakCount');
  if(streak)streak.textContent=`${count} ngày`;
  const pet=$('firePet');
  const widget=$('streakWidget');
  if(widget){
    widget.title=count>=30?'🔥 Pet lửa: cấp độ Huyền thoại!':count>=7?'🔥 Pet lửa đang rất sung!':'🔥 Pet lửa đang nghịch!';
  }
  if(pet){
    pet.dataset.level=count>=30?'legendary':count>=7?'hot':'baby';
  }
}

function renderUser(user){
 const area=$("userArea");
 if(user){
   const name=user.displayName||user.email||"Bạn";
   area.innerHTML=`<div class="user-pill"><span class="avatar">${esc((name[0]||"U").toUpperCase())}</span><div><b>${esc(name)}</b><small>🔥 Chuỗi: <span id="userStreak">0</span> ngày</small></div><button id="logoutGoogle" class="logout-mini">Đăng xuất</button></div>`;
   $("userStreak").textContent=JSON.parse(localStorage.getItem("hh_streak_v2")||'{"count":0}').count||1;
 }else{
   area.innerHTML=`<button id="googleLogin" class="google-mini">G&nbsp; Đăng nhập Google</button>`;
   $("googleLogin").onclick=()=>signInWithPopup(auth,googleProvider).catch(e=>console.error(e));
   $("streakCount").textContent="Đăng nhập để dùng";
 }
}
onAuthStateChanged(auth,user=>{
 renderUser(user);
 if(user){ $("streakCount").textContent=JSON.parse(localStorage.getItem("hh_streak_v2")||'{"count":0}').count+" ngày"; }
 else $("streakCount").textContent="—";
});
updateStreak();


let siteSettings={
  noHomeworkNoticeEnabled:true,
  oldHomeworkNoticeEnabled:true,
  noHomeworkNoticeTitle:"📚 Hôm nay không có bài tập mới",
  noHomeworkNoticeMessage:"Hôm nay chưa có bài tập mới được cập nhật.",
  oldHomeworkNoticeTitle:"📢 Bài tập chưa có cập nhật",
  oldHomeworkNoticeMessage:"Danh sách bài tập hôm nay vẫn giống ngày trước."
};

function showUpdateNotice(){
  const todayKey=dayKey(new Date());
  const dismissed=localStorage.getItem("hh_notice_dismissed");
  if(dismissed===todayKey)return;

  const latest=homework.reduce((m,h)=>{
    const d=h.createdAt?.toDate?h.createdAt.toDate():(h.createdAt?new Date(h.createdAt):null);
    return d&&(!m||d>m)?d:m;
  },null);

  let title="",text="";
  if(!homework.length){
    if(siteSettings.noHomeworkNoticeEnabled===false)return;
    title=siteSettings.noHomeworkNoticeTitle;
    text=siteSettings.noHomeworkNoticeMessage;
  }else{
    if(!latest)return;
    const latestKey=dayKey(latest);
    if(latestKey===todayKey)return;
    if(siteSettings.oldHomeworkNoticeEnabled===false)return;
    const diff=Math.max(1,Math.round((new Date(todayKey+"T12:00:00+07:00")-new Date(latestKey+"T12:00:00+07:00"))/DAY));
    title=siteSettings.oldHomeworkNoticeTitle;
    text=siteSettings.oldHomeworkNoticeMessage.replaceAll("{days}",String(diff)).replaceAll("{date}",latest.toLocaleDateString("vi-VN"));
  }
  $("noticeTitle").textContent=title;
  $("noticeText").textContent=text;
  $("updateNotice").classList.remove("hidden");
}
$("noticeClose").onclick=()=>{localStorage.setItem("hh_notice_dismissed",dayKey());$("updateNotice").classList.add("hidden")};

onSnapshot(query(collection(db,"subjects")),s=>{tabs=s.docs.map(d=>({id:d.id,...d.data()}));renderTabs();render()});
onSnapshot(query(collection(db,"homework"),orderBy("createdAt","desc")),s=>{homework=s.docs.map(d=>({id:d.id,...d.data()}));render();showUpdateNotice()});
onSnapshot(doc(db,"settings","site"),s=>{
  if(s.exists())siteSettings={...siteSettings,...s.data()};
  showUpdateNotice();
});

function renderTabs(){
 $("tabs").innerHTML=`<button class="tab ${active==="all"?"active":""}" data-tab="all">✨ Tất cả</button>`+
 tabs.map(t=>`<button class="tab ${active===t.id?"active":""}" data-tab="${t.id}">${esc(t.icon||"📚")} ${esc(t.name)}</button>`).join("");
 document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{active=b.dataset.tab;renderTabs();render()});
}
$("search").oninput=e=>{search=e.target.value.toLowerCase();$("clearSearch").classList.toggle("hidden",!search);render()};
$("clearSearch").onclick=()=>{$("search").value="";search="";$("clearSearch").classList.add("hidden");render()};
function render(){
 $("totalCount").textContent=homework.length;
 let list=homework.filter(h=>(active==="all"||h.subjectId===active)&&(!search||`${h.title} ${h.content}`.toLowerCase().includes(search)));
 $("status").textContent=`${list.length} bài tập${active==="all"?"":" trong môn đã chọn"}`;
 $("empty").classList.toggle("hidden",list.length>0);
 $("homeworkList").innerHTML=list.sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)).map((h,i)=>{
  const t=tabs.find(x=>x.id===h.subjectId),due=h.dueDate?new Date(h.dueDate):null,state=due?dueState(due):{};
  return `<article class="card ${h.pinned?"pinned":""}" style="animation-delay:${Math.min(i,10)*45}ms">
   <div class="card-top"><span class="subject">${esc(t?.icon||"📚")} ${esc(t?.name||"Chưa phân loại")}</span>
   <span class="badge ${state.cls||""}">${h.pinned?"📌 Ghim":h.important?"⭐ Quan trọng":"Mới"}</span></div>
   <h2>${esc(h.title)}</h2><div class="content">${esc(h.content)}</div>
   ${due?`<div class="due ${state.cls||""}">⏰ Hạn nộp: ${due.toLocaleString("vi-VN",{dateStyle:"medium",timeStyle:"short"})} · ${state.text}</div>`:""}
  </article>`}).join("");
}
function dueState(d){const diff=d-new Date(),day=DAY;if(diff<0)return{cls:"red",text:"Đã hết hạn"};if(diff<2*day)return{cls:"yellow",text:"Sắp hết hạn"};return{cls:"",text:"Còn hạn"}}
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
document.addEventListener("mousemove",e=>document.querySelectorAll(".card").forEach(c=>{const r=c.getBoundingClientRect();c.style.setProperty("--mx",`${e.clientX-r.left}px`);c.style.setProperty("--my",`${e.clientY-r.top}px`)}));
const firePet=$("firePet");
const streakWidget=$("streakWidget");
function petPlay(){
  if(!firePet)return;
  firePet.classList.remove("pet-play");
  void firePet.offsetWidth;
  firePet.classList.add("pet-play");
  const label=$("streakLabel");
  if(label){label.textContent="Hí hí! 🔥";clearTimeout(window.__petTimer);window.__petTimer=setTimeout(()=>label.textContent="chuỗi học tập",1400)}
}
if(streakWidget){streakWidget.addEventListener("click",petPlay);streakWidget.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();petPlay()}})}
setInterval(()=>{if(firePet&&!document.hidden)petPlay()},17000);

const themeKey="hh_theme"; if(localStorage.getItem(themeKey)==="light")document.body.classList.add("light");
$("themeBtn").onclick=()=>{document.body.classList.toggle("light");localStorage.setItem(themeKey,document.body.classList.contains("light")?"light":"dark")};
