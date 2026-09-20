import{initializeApp}from"https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import{getAuth,onAuthStateChanged,signInWithPopup,signInWithRedirect,getRedirectResult,GoogleAuthProvider,signOut}from"https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import{getFirestore,collection,doc,setDoc,query,orderBy,onSnapshot,addDoc,serverTimestamp}from"https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import{firebaseConfig}from"../js/firebase-config.js";

const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),provider=new GoogleAuthProvider();
const $=id=>document.getElementById(id);
let me=null,users=[],selected=null,mode="people",profileUnsub=null,presenceUnsub=null,msgUnsub=null,presenceTimer=null,signing=false,sending=false,cooldownTimer=null;
const fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='100%25' height='100%25' rx='50%25' fill='%23242840'/%3E%3Ctext x='50%25' y='55%25' text-anchor='middle' fill='%23fff' font-size='32'%3E%F0%9F%91%A4%3C/text%3E%3C/svg%3E";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const avatar=u=>`<img class="avatar" src="${esc(u.photoURL||fallback)}" onerror="this.src='${fallback}'" alt="">`;
const chatId=(a,b)=>[a,b].sort().join("_");

function setViewport(){document.documentElement.style.setProperty("--vh",`${window.innerHeight*0.01}px`)}
setViewport();window.addEventListener("resize",setViewport,{passive:true});window.addEventListener("orientationchange",()=>setTimeout(setViewport,250),{passive:true});

async function login(){
 if(signing)return;signing=true;
 try{await signInWithPopup(auth,provider)}
 catch(e){
  if(e.code==="auth/popup-blocked"||e.code==="auth/popup-operation-not-supported"){
   try{await signInWithRedirect(auth,provider)}catch(r){console.error(r);alert("Không thể đăng nhập Google.")}
  }else if(!["auth/popup-closed-by-user","auth/cancelled-popup-request"].includes(e.code)){console.error(e);alert(e.message||"Không thể đăng nhập Google.")}
 }finally{signing=false}
}
getRedirectResult(auth).catch(e=>console.warn("Chat redirect:",e));

async function ensureProfile(){
 if(!me)return;
 await setDoc(doc(db,"chat_profiles",me.uid),{uid:me.uid,email:me.email||"",displayName:me.displayName||me.email||"Bạn",photoURL:me.photoURL||"",updatedAt:serverTimestamp()},{merge:true});
}
async function setPresence(online=true){
 if(!me)return;
 await setDoc(doc(db,"presence",me.uid),{uid:me.uid,onlineUntil:online?Date.now()+90000:0,updatedAt:serverTimestamp()},{merge:true}).catch(e=>console.warn("presence",e));
}
function startPresence(){clearInterval(presenceTimer);setPresence(true);presenceTimer=setInterval(()=>setPresence(true),30000)}
function stopPresence(){clearInterval(presenceTimer);presenceTimer=null;if(me)setPresence(false)}
function normalize(d){const x=d.data();return{uid:d.id,email:x.email||"",displayName:x.displayName||x.email||"Người dùng",photoURL:x.photoURL||""}}

function renderUsers(){
 const q=($("userSearch").value||"").trim().toLowerCase(),now=Date.now();
 if(mode==="group"){
  $("users").innerHTML=`<button class="user active" id="allGroupBtn">${avatar({})}<span class="user-main"><b>👥 Nhóm Homework Hub</b><small>${users.length+1} thành viên</small></span><span class="dot online"></span></button>`;
  $("allGroupBtn").onclick=openGroup;return;
 }
 const list=users.filter(u=>u.uid!==me?.uid).filter(u=>`${u.displayName} ${u.email}`.toLowerCase().includes(q));
 $("users").innerHTML=list.length?list.map(u=>`<button class="user ${selected?.uid===u.uid?"active":""}" data-uid="${esc(u.uid)}">${avatar(u)}<span class="user-main"><b>${esc(u.displayName)}</b><small>${esc(u.email)}</small></span><span class="dot ${Number(u.onlineUntil||0)>now?"online":""}"></span></button>`).join(""):"<span class='muted'>Chưa tìm thấy thành viên khác.</span>";
 document.querySelectorAll(".user[data-uid]").forEach(b=>b.onclick=()=>openPrivate(users.find(u=>u.uid===b.dataset.uid)));
}

function subscribeUsers(){
 if(profileUnsub)profileUnsub();if(presenceUnsub)presenceUnsub();
 profileUnsub=onSnapshot(collection(db,"chat_profiles"),snap=>{
  const base=snap.docs.map(normalize);users=base;renderUsers();
  if(presenceUnsub)presenceUnsub();
  presenceUnsub=onSnapshot(collection(db,"presence"),ps=>{
   const p=new Map(ps.docs.map(d=>[d.id,d.data()]));
   users=base.map(u=>({...u,onlineUntil:p.get(u.uid)?.onlineUntil||0}));renderUsers();
   if(selected){const s=users.find(u=>u.uid===selected.uid);if(s){selected=s;header(s.displayName,Number(s.onlineUntil||0)>Date.now()?"🟢 online":"⚪ offline",s.photoURL)}}
  },e=>{console.warn("presence",e);renderUsers()})
 },e=>{$("users").innerHTML="<span class='muted'>Không đọc được danh sách thành viên. Hãy kiểm tra Firestore Rules.</span>";console.error("chat_profiles",e)});
}
function header(name,status,photo){$("chatName").textContent=name;$("chatStatus").textContent=status;$("chatAvatar").src=photo||fallback}

async function ensurePrivateChat(u){
 const id=chatId(me.uid,u.uid);
 await setDoc(doc(db,"chats",id),{type:"private",members:[me.uid,u.uid],updatedAt:serverTimestamp()},{merge:true});
 return id;
}
async function ensureGroup(){
 const members=[...new Set(users.map(u=>u.uid).concat(me.uid))];
 await setDoc(doc(db,"chats","all_members"),{type:"group",name:"Nhóm Homework Hub",members,updatedAt:serverTimestamp()},{merge:true});
 return members;
}

async function openPrivate(u){
 if(!me){showLogin();return}if(!u||u.uid===me.uid)return;
 mode="people";selected=u;$('emptyChat').hidden=true;$('chatPanel').hidden=false;$('usersPanel').classList.add('chat-open');
 header(u.displayName,Number(u.onlineUntil||0)>Date.now()?"🟢 online":"⚪ offline",u.photoURL);renderUsers();
 try{listenMessages(await ensurePrivateChat(u),false)}catch(e){console.error("openPrivate",e);$("messages").innerHTML="<div class='muted'>Không thể mở chat. Kiểm tra Firestore Rules.</div>"}
}
async function openGroup(){
 if(!me){showLogin();return}
 selected=null;mode="group";$('emptyChat').hidden=true;$('chatPanel').hidden=false;$('usersPanel').classList.add('chat-open');
 try{const members=await ensureGroup();header("👥 Nhóm Homework Hub",`${members.length} thành viên`,fallback);listenMessages("all_members",true)}catch(e){console.error("openGroup",e);$("messages").innerHTML="<div class='muted'>Không thể mở nhóm chat. Kiểm tra Firestore Rules.</div>"}
 renderUsers();
}

function listenMessages(id,isGroup){
 if(msgUnsub)msgUnsub();
 msgUnsub=onSnapshot(query(collection(db,"chats",id,"messages"),orderBy("createdAt","asc")),snap=>{
  const c=$("messages");c.innerHTML=snap.docs.map(d=>renderMessage(d.data(),isGroup)).join("");requestAnimationFrame(()=>{c.scrollTop=c.scrollHeight});
 },e=>{console.error("Chat messages",e);$("messages").innerHTML="<div class='muted'>Không thể tải tin nhắn. Kiểm tra Firestore Rules.</div>"});
}
function renderMessage(x,isGroup){
 const mine=x.senderId===me.uid,t=x.createdAt?.toDate?.();
 const body=x.text?`<div>${esc(x.text)}</div>`:"";
 return `<div class="msg ${mine?"mine":""}">${isGroup&&!mine?`<div class="sender">${esc(x.senderName||x.senderEmail||"Thành viên")}</div>`:""}${body}${t?`<time>${t.toLocaleString("vi-VN",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"})}</time>`:""}</div>`;
}

async function sendMessage(text){
 if(!me)return;
 const id=mode==="group"?"all_members":chatId(me.uid,selected.uid);
 const members=mode==="group"?[...new Set(users.map(u=>u.uid).concat(me.uid))]:[me.uid,selected.uid];
 await setDoc(doc(db,"chats",id),{type:mode==="group"?"group":"private",name:mode==="group"?"Nhóm Homework Hub":"",members,lastMessage:text,lastSenderId:me.uid,updatedAt:serverTimestamp()},{merge:true});
 await addDoc(collection(db,"chats",id,"messages"),{senderId:me.uid,senderName:me.displayName||me.email||"Bạn",senderEmail:me.email||"",text,createdAt:serverTimestamp()});
}

function startSendCooldown(){
 const btn=$("sendBtn");clearInterval(cooldownTimer);sending=true;btn.disabled=true;let left=5;btn.textContent=`Gửi (${left})`;
 cooldownTimer=setInterval(()=>{left--;if(left<=0){clearInterval(cooldownTimer);sending=false;btn.disabled=false;btn.textContent="Gửi"}else btn.textContent=`Gửi (${left})`},1000);
 $("sendHint").textContent="Có thể gửi tiếp sau 5 giây để tránh Firestore bị gửi dồn.";
 setTimeout(()=>{$("sendHint").textContent=""},5000);
}

$("composer").onsubmit=async e=>{
 e.preventDefault();if(sending)return;
 const input=$("messageInput"),text=input.value.trim();
 if(!me){showLogin();return}if(!selected&&mode!=="group")return;if(!text)return;if(text.length>2000)return alert("Tin nhắn tối đa 2000 ký tự.");
 startSendCooldown();input.value="";
 try{await sendMessage(text)}catch(e){console.error(e);input.value=text;alert("Không gửi được tin nhắn. Hãy thử lại sau.")}
};

$("emoji").onclick=()=>{$("emojiBar").hidden=!$("emojiBar").hidden};
document.querySelectorAll("#emojiBar button").forEach(b=>b.onclick=()=>{const i=$("messageInput");i.value+=b.textContent;i.focus()});
$("login").onclick=login;$("emptyLogin").onclick=login;$("logout").onclick=()=>signOut(auth);$("userSearch").oninput=renderUsers;
$("peopleTab").onclick=()=>{mode="people";$("peopleTab").classList.add("active");$("groupTab").classList.remove("active");renderUsers()};
$("groupTab").onclick=()=>{mode="group";$("groupTab").classList.add("active");$("peopleTab").classList.remove("active");renderUsers()};
$("backUsers").onclick=()=>{$("chatPanel").hidden=true;$('emptyChat').hidden=false;$('usersPanel').classList.remove('chat-open');selected=null;if(msgUnsub){msgUnsub();msgUnsub=null}renderUsers()};

function showLogin(){
 $("loginBox").hidden=false;$("emptyLogin").hidden=false;$("emptyChat").hidden=false;$("chatPanel").hidden=true;
}

onAuthStateChanged(auth,async u=>{
 stopPresence();me=u||null;
 if(msgUnsub){msgUnsub();msgUnsub=null}
 if(!u){
  if(profileUnsub)profileUnsub();if(presenceUnsub)presenceUnsub();profileUnsub=null;presenceUnsub=null;users=[];selected=null;
  $("loginBox").hidden=false;$("emptyLogin").hidden=false;$("logout").hidden=true;$("me").textContent="Chưa đăng nhập";$("users").innerHTML="<span class='muted'>Đăng nhập để xem danh sách thành viên Homework Hub.</span>";return;
 }
 $("loginBox").hidden=true;$("emptyLogin").hidden=true;$("logout").hidden=false;$("me").textContent=u.displayName||u.email||"Bạn";
 try{await ensureProfile();startPresence();subscribeUsers()}catch(e){console.error("Chat init",e);$("users").innerHTML="<span class='muted'>Không thể khởi tạo chat.</span>"}
});
window.addEventListener("beforeunload",stopPresence);
