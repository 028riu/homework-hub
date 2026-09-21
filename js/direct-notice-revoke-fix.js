import { getApps, getApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const app=getApps().length?getApp():null;
if(!app) throw new Error("Homework Hub: Firebase app chưa được khởi tạo.");
const db=getFirestore(app);
const overlay=document.getElementById("directNoticeOverlay");

onSnapshot(doc(db,"settings","directNotification"),snap=>{
  if(!snap.exists()){
    if(overlay) overlay.hidden=true;
    return;
  }
  const d=snap.data();
  if(d.active===false && overlay) overlay.hidden=true;
});
